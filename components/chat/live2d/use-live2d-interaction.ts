"use client";

import { useEffect, useRef, useCallback } from "react";
import type { UseLive2DInteractionOptions } from "./types";
import { trySetParam } from "./live2d-utils";

// ─── 常量 ──────────────────────────────────────────────────────────────────────

/** 空闲触发间隔（默认 10s） */
const DEFAULT_IDLE_TIMEOUT = 10_000;

/** 悬停时使用的表情索引（exp_02 = 笑脸眼） */
const HOVER_EXPRESSION_INDEX = 1;

/** 点击时播放的动作索引（special_01 在 unnamed group 中的 index） */
const TAP_MOTION_INDEX = 3;

/** 非 idle 动作所在的 group 名（空字符串，模型 model3.json 中未命名的组） */
const FIDGET_GROUP = "";

/** 空闲摸鱼候选动作总数（mtn_02~04、special_01~03 = 6 个） */
const FIDGET_MOTION_COUNT = 6;

// ─── 视线跟踪参数名及缩放系数 ─────────────────────────────────────────────────

const EYE_TRACK_PARAMS: Array<{ name: string; scale: number }> = [
  { name: "ParamAngleX", scale: 25 },
  { name: "ParamAngleY", scale: 20 },
  { name: "ParamEyeBallX", scale: 0.8 },
  { name: "ParamEyeBallY", scale: 0.8 },
];

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useLive2DInteraction({
  modelRef,
  isReady,
  canvas,
  speaking = false,
  idleTimeout = DEFAULT_IDLE_TIMEOUT,
  onTap,
}: UseLive2DInteractionOptions) {
  // ── Refs ──────────────────────────────────────────────────────────────────
  const mouseRef = useRef({ x: 0, y: 0 });
  const tickerRef = useRef<{ destroy(): void } | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speakingRef = useRef(speaking);
  const onTapRef = useRef(onTap);

  // 同步最新 props 到 ref
  useEffect(() => {
    speakingRef.current = speaking;
  });
  useEffect(() => {
    onTapRef.current = onTap;
  });

  // ── 空闲计时器管理 ───────────────────────────────────────────────────────

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const startIdleTimer = useCallback(() => {
    clearIdleTimer();
    // 说话中不启动空闲计时器
    if (speakingRef.current) return;
    idleTimerRef.current = setTimeout(() => {
      const model = modelRef.current;
      if (!model) return;
      // 随机选一个非 idle 动作播放
      try {
        const randomIndex = Math.floor(Math.random() * FIDGET_MOTION_COUNT);
        model.motion(FIDGET_GROUP, randomIndex);
      } catch {
        // motion 播放失败静默忽略
      }
      // 动作播完后重新启动空闲计时器
      startIdleTimer();
    }, idleTimeout);
  }, [clearIdleTimer, idleTimeout]);

  const resetIdleTimer = useCallback(() => {
    clearIdleTimer();
    startIdleTimer();
  }, [clearIdleTimer, startIdleTimer]);

  // ── 交互事件绑定（模型就绪后执行） ──────────────────────────────────────

  useEffect(() => {
    const model = modelRef.current;
    if (!model || !canvas) return;

    // --- 鼠标移动：视线跟随 ---
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      resetIdleTimer();
    };

    // --- 鼠标进入：悬停反应 ---
    const handleMouseEnter = () => {
      // 尝试设置笑脸表情（exp_02 = 笑脸眼），失败则静默回退
      model.expression(HOVER_EXPRESSION_INDEX).catch(() => {});
      resetIdleTimer();
    };

    // --- 鼠标离开：复位表情 ---
    const handleMouseLeave = () => {
      model.expression().catch(() => {});
      resetIdleTimer();
    };

    // --- 点击：播放 special_01 + 触发回调 ---
    const handleTap = () => {
      onTapRef.current?.();
      try {
        model.motion(FIDGET_GROUP, TAP_MOTION_INDEX);
      } catch {
        // motion 播放失败静默忽略
      }
      resetIdleTimer();
    };

    // 绑定事件
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    canvas.addEventListener("mouseenter", handleMouseEnter);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    model.on("pointertap", handleTap);

    // --- 创建 Ticker：逐帧应用视线跟踪参数 ---
    const PIXI = (window as unknown as Record<string, unknown>)
      .PIXI as typeof import("pixi.js");
    const ticker = new PIXI.Ticker();
    tickerRef.current = ticker;
    ticker.add(() => {
      const m = modelRef.current;
      if (!m) return;

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      // 应用视线跟踪参数（X 参数用 mx，Y 参数用 my）
      for (const { name, scale } of EYE_TRACK_PARAMS) {
        trySetParam(m, name, (name.includes("X") ? mx : my) * scale);
      }
    });
    ticker.start();

    // 清理
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseenter", handleMouseEnter);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      model.off("pointertap", handleTap);
      if (tickerRef.current) {
        tickerRef.current.destroy();
        tickerRef.current = null;
      }
    };
  }, [isReady, canvas, resetIdleTimer]);

  // ── 启动初始空闲计时器 ───────────────────────────────────────────────────

  useEffect(() => {
    if (!isReady) return;
    startIdleTimer();
    return () => clearIdleTimer();
  }, [isReady, startIdleTimer, clearIdleTimer]);

  // ── 说话状态变化时管理空闲计时器 ─────────────────────────────────────────

  useEffect(() => {
    if (speaking) {
      clearIdleTimer();
    } else if (isReady) {
      startIdleTimer();
    }
  }, [speaking, clearIdleTimer, startIdleTimer]);
}
