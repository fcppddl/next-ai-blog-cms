"use client";

import { useEffect, useRef, useCallback } from "react";
import type { UseLive2DInteractionOptions } from "./types";

// ─── 常量 ──────────────────────────────────────────────────────────────────────

/** 空闲触发间隔（默认 15s） */
const DEFAULT_IDLE_TIMEOUT = 15_000;

/** 悬停时使用的表情索引（exp_02 = 笑脸眼） */
const HOVER_EXPRESSION_INDEX = 1;

/** 空闲摸鱼候选动作总数（mtn_02~04、special_01~03 = 6 个） */
const FIDGET_MOTION_COUNT = 6;

// ─── 动作组发现 ────────────────────────────────────────────────────────────────

/**
 * 从模型 motionManager 中找出非 Idle 的动作组名。
 * 模型的 model3.json 中 Idle 以外的组的 key 可能是空字符串 ""，
 * 必须用 == null 检查而非 !falsy，因为 "" 是合法的组名。
 */
function findFidgetGroup(model: {
  internalModel?: { motionManager?: { definitions?: Partial<Record<string, unknown[]>> } };
}): string | null {
  const defs = model.internalModel?.motionManager?.definitions;
  if (!defs) return null;
  const keys = Object.keys(defs);
  const fidget = keys.find((k) => k.toLowerCase() !== "idle");
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
  // 用 ref 持有 idleTimeout，避免 useCallback 依赖变化
  const idleTimeoutRef = useRef(idleTimeout);
  useEffect(() => {
    idleTimeoutRef.current = idleTimeout;
  });

  // ── 发现动作组名 ─────────────────────────────────────────────────────────

  useEffect(() => {
    const model = modelRef.current;
    if (!model || !isReady) return;
    fidgetGroupRef.current = findFidgetGroup(model);
  }, [isReady]);

  // ── 空闲计时器管理 ───────────────────────────────────────────────────────

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  // 用 ref 持有最新的回调，避免递归 useCallback 循环依赖
  const startIdleCountdownRef = useRef<() => void>(() => {});

  // 在 effect 中赋值 ref.current，避免 render 期间访问 ref（react-hooks/refs）
  useEffect(() => {
    startIdleCountdownRef.current = () => {
      clearIdleTimer();
      idleTimerRef.current = setTimeout(() => {
        // 触发随机动作
        const model = modelRef.current;
        const group = fidgetGroupRef.current;
        if (model && group != null) {
          const randomIndex = Math.floor(Math.random() * FIDGET_MOTION_COUNT);
          model.motion(group, randomIndex)?.catch(() => {});
        }
        // 立即启动下一轮倒计时（固定间隔，不等待动作播完）
        startIdleCountdownRef.current();
      }, idleTimeoutRef.current);
    };
  }, [clearIdleTimer]);

  /** 重置空闲计时器——交互事件发生时调用 */
  const resetIdleTimer = useCallback(() => {
    clearIdleTimer();
    startIdleCountdownRef.current();
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
    startIdleCountdownRef.current();
    return () => clearIdleTimer();
  }, [isReady, clearIdleTimer]);
}
