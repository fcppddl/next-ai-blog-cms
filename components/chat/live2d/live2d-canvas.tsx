"use client";

import { useRef, useEffect, useCallback, memo } from "react";
import { useLive2DModel } from "./use-live2d-model";

interface Live2DCanvasProps {
  /** 模型文件路径 */
  modelPath: string;
  /** Canvas 宽度（CSS 像素） */
  width: number;
  /** Canvas 高度（CSS 像素） */
  height: number;
  /** AI 是否正在流式回复 */
  streaming?: boolean;
  /** 点击回调 */
  onTap?: () => void;
  /** 模型加载成功回调 */
  onReady?: () => void;
  /** 模型加载失败回调 */
  onError?: () => void;
}

/**
 * Live2D Canvas 渲染组件
 *
 * 负责创建 WebGL Canvas 并挂载 Live2D 模型。
 * 通过 next/dynamic 延迟加载，不阻塞首屏。
 */
function Live2DCanvas({
  modelPath,
  width,
  height,
  streaming = false,
  onTap,
  onReady,
  onError,
}: Live2DCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 用 ref 持有回调函数，避免回调变化导致模型重建
  const onTapRef = useRef(onTap);
  onTapRef.current = onTap;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  // 稳定化的回调（传给 Hook 的引用不变）
  const stableOnTap = useCallback(() => onTapRef.current?.(), []);
  const stableOnReady = useCallback(() => onReadyRef.current?.(), []);

  // 监听加载错误（通过 canvas 自定义事件）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleError = () => onError?.();
    canvas.addEventListener("live2d-error", handleError);
    return () => canvas.removeEventListener("live2d-error", handleError);
  }, [onError]);

  // 初始化模型（传入稳定化的回调，避免不必要的模型重建）
  useLive2DModel({
    canvas: canvasRef.current,
    modelPath,
    onTap: stableOnTap,
    onReady: stableOnReady,
    speaking: streaming,
  });

  return (
    <canvas
      ref={canvasRef}
      width={width * (window.devicePixelRatio || 1)}
      height={height * (window.devicePixelRatio || 1)}
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
