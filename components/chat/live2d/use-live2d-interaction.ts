"use client";

import { useEffect, useRef, useCallback } from "react";
import type { UseLive2DInteractionOptions } from "./types";

// ─── 常量 ──────────────────────────────────────────────────────────────────────

/** 空闲触发间隔（默认 10s） */
const DEFAULT_IDLE_TIMEOUT = 10_000;

/** 悬停时使用的表情索引（exp_02 = 笑脸眼） */
const HOVER_EXPRESSION_INDEX = 1;

/** 空闲摸鱼候选动作总数（mtn_02~04、special_01~03 = 6 个） */
const FIDGET_MOTION_COUNT = 6;

// ─── 动作组发现 ────────────────────────────────────────────────────────────────

/**
 * 从模型 motionManager 中找出非 Idle 的动作组名。
 * 模型的 model3.json 中 Idle 以外的组的 key 可能是空字符串 ""，
 * pixi-live2d-display 可能无法正确处理空 key，所以动态查找实际的组名。
 */
function findFidgetGroup(model: {
  internalModel?: { motionManager?: { definitions?: Partial<Record<string, unknown[]>> } };
}): string | null {
  const defs = model.internalModel?.motionManager?.definitions;
  if (!defs) return null;
  // 找第一个不是 "Idle" 的组（不区分大小写）
  const keys = Object.keys(defs);
  // 注意：组的 key 可能是空字符串 ""，这也是合法的组名
  const fidget = keys.find((k) => k.toLowerCase() !== "idle");
  // 明确返回 null（而非 ""）表示未找到，避免空字符串被 falsy 检查误判
  return fidget !== undefined ? fidget : null;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useLive2DInteraction({
  modelRef,
  isReady,
  canvas,
  idleTimeout = DEFAULT_IDLE_TIMEOUT,
}: UseLive2DInteractionOptions) {
  // ── Refs ──────────────────────────────────────────────────────────────────
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 缓存非 idle 动作组名（模型就绪时发现，null = 未找到）
  const fidgetGroupRef = useRef<string | null>(null);

  // ── 发现动作组名 ─────────────────────────────────────────────────────────

  useEffect(() => {
    const model = modelRef.current;
    if (!model || !isReady) return;
    fidgetGroupRef.current = findFidgetGroup(model);
  }, [isReady]);

  // ── 空闲计时器管理 ───────────────────────────────────────────────────────

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
      const group = fidgetGroupRef.current;
      // group 可能是空字符串 ""（合法的组名），用 == null 检查
      if (group == null) return;
      // 随机选一个非 idle 动作播放
      try {
        const randomIndex = Math.floor(Math.random() * FIDGET_MOTION_COUNT);
        model.motion(group, randomIndex)?.catch(() => {});
      } catch {
        // motion 播放失败静默忽略
      }
      // 动作播完后重新启动空闲计时器（递归）
      startIdleTimerRef.current();
    }, idleTimeout);
  };

  const startIdleTimer = useCallback(() => {
    startIdleTimerRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      model.expression(HOVER_EXPRESSION_INDEX).catch(() => {});
      resetIdleTimer();
    };

    // --- 鼠标离开：复位表情 ---
    const handleMouseLeave = () => {
      model.expression().catch(() => {});
      resetIdleTimer();
    };

    // 绑定事件
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    canvas.addEventListener("mouseenter", handleMouseEnter);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    // 清理
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseenter", handleMouseEnter);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [isReady, canvas, resetIdleTimer]);

  // ── 启动初始空闲计时器 ───────────────────────────────────────────────────

  useEffect(() => {
    if (!isReady) return;
    startIdleTimer();
    return () => clearIdleTimer();
  }, [isReady, startIdleTimer, clearIdleTimer]);
}
