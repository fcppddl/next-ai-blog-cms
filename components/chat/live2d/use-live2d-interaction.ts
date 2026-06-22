"use client";

import { useEffect, useRef, useCallback } from "react";
import type { UseLive2DInteractionOptions } from "./types";

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

/** 点击后延迟打开面板的毫秒数——让点击动作有机会播放第一帧 */
const TAP_DELAY_MS = 500;

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useLive2DInteraction({
  modelRef,
  isReady,
  canvas,
  idleTimeout = DEFAULT_IDLE_TIMEOUT,
  onTap,
}: UseLive2DInteractionOptions) {
  // ── Refs ──────────────────────────────────────────────────────────────────
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTapRef = useRef(onTap);

  // 同步最新 props 到 ref
  useEffect(() => {
    onTapRef.current = onTap;
  });

  // ── 空闲计时器管理 ───────────────────────────────────────────────────────

  // 用 ref 持有递归调用的最新 startIdleTimer 引用，避免 useCallback 循环依赖
  const startIdleTimerRef = useRef<() => void>(() => {});

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  startIdleTimerRef.current = () => {
    clearIdleTimer();
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
      // 动作播完后重新启动空闲计时器（递归）
      startIdleTimerRef.current();
    }, idleTimeout);
  };

  const startIdleTimer = useCallback(() => {
    startIdleTimerRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- idleTimeout 变化由 startIdleTimerRef.current 自动同步
  }, [clearIdleTimer, idleTimeout]);

  const resetIdleTimer = useCallback(() => {
    clearIdleTimer();
    startIdleTimerRef.current();
  }, [clearIdleTimer]);

  // ── 交互事件绑定（模型就绪后执行） ──────────────────────────────────────

  useEffect(() => {
    const model = modelRef.current;
    if (!model || !canvas) return;

    // --- 鼠标移动：重置空闲计时器 ---
    const handleMouseMove = () => {
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

    // --- 点击：播放 special_01 → 延迟后触发回调 ---
    const handleTap = () => {
      // 先播放动作
      try {
        model.motion(FIDGET_GROUP, TAP_MOTION_INDEX);
      } catch {
        // motion 播放失败静默忽略
      }
      // 延迟后再打开面板，让动作有机会播放
      setTimeout(() => {
        onTapRef.current?.();
      }, TAP_DELAY_MS);
      resetIdleTimer();
    };

    // 绑定事件
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    canvas.addEventListener("mouseenter", handleMouseEnter);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    model.on("pointertap", handleTap);

    // 清理
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseenter", handleMouseEnter);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      model.off("pointertap", handleTap);
    };
  }, [isReady, canvas, resetIdleTimer]);

  // ── 启动初始空闲计时器 ───────────────────────────────────────────────────

  useEffect(() => {
    if (!isReady) return;
    startIdleTimer();
    return () => clearIdleTimer();
  }, [isReady, startIdleTimer, clearIdleTimer]);
}
