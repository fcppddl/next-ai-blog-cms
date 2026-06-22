"use client";

import { useState, useEffect, useCallback, useRef, memo } from "react";
import { useLive2DModel } from "./use-live2d-model";
import { useLive2DInteraction } from "./use-live2d-interaction";

interface Live2DCanvasProps {
  /** 模型文件路径 */
  modelPath: string;
  /** Canvas 宽度（CSS 像素） */
  width: number;
  /** Canvas 高度（CSS 像素） */
  height: number;
  /** 点击回调 */
  onTap?: () => void;
  /** 模型加载成功回调 */
  onReady?: () => void;
  /** 模型加载失败回调（传入错误信息用于诊断） */
  onError?: (message: string) => void;
}

/**
 * Live2D Canvas 渲染组件
 *
 * 负责创建 WebGL Canvas 并挂载 Live2D 模型。
 * 通过 next/dynamic 延迟加载，不阻塞首屏。
 *
 * 架构：
 *   useLive2DModel       → 模型初始化
 *   useLive2DInteraction → 悬停 + 空闲 + 点击反馈
 *   两者通过 modelRef 共享模型实例，通过 isReady 同步状态。
 */
function Live2DCanvas({
  modelPath,
  width,
  height,
  onTap,
  onReady,
  onError,
}: Live2DCanvasProps) {
  // 使用 callback ref + state 确保 canvas 非 null 时才初始化模型
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);

  // 用 ref 持有回调函数，避免回调变化导致模型重建
  const onTapRef = useRef(onTap);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onTapRef.current = onTap;
  });
  useEffect(() => {
    onReadyRef.current = onReady;
  });

  // 稳定化的回调（传给 Hook 的引用不变，避免不必要的模型重建）
  const stableOnTap = useCallback(() => onTapRef.current?.(), []);
  const stableOnReady = useCallback(() => onReadyRef.current?.(), []);

  // 监听加载错误（通过 canvas 自定义事件）
  useEffect(() => {
    if (!canvasEl) return;
    const handleError = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const msg =
        detail instanceof Error ? detail.message : String(detail ?? "未知错误");
      onError?.(msg);
    };
    canvasEl.addEventListener("live2d-error", handleError);
    return () => canvasEl.removeEventListener("live2d-error", handleError);
  }, [canvasEl, onError]);

  // 初始化模型（canvasEl 非 null 时 hook 内部的 useEffect 才会真正执行）
  const { modelRef, isReady } = useLive2DModel({
    canvas: canvasEl,
    modelPath,
    onReady: stableOnReady,
  });

  // 交互行为（悬停反应、空闲摸鱼、点击反馈）
  useLive2DInteraction({
    modelRef,
    isReady,
    canvas: canvasEl,
    onTap: stableOnTap,
  });

  // 提前计算 devicePixelRatio 避免 canvas 模糊
  const dpr =
    typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

  return (
    <canvas
      ref={setCanvasEl}
      width={width * dpr}
      height={height * dpr}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        display: "block",
        cursor: "pointer",
      }}
    />
  );
}

export default memo(Live2DCanvas);
