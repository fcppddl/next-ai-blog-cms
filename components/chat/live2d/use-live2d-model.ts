"use client";

import { useEffect, useRef, useState } from "react";
import type { UseLive2DModelOptions } from "./types";
import type { Application, Ticker } from "pixi.js";
import type { Live2DModel } from "pixi-live2d-display/cubism4";
import { trySetParam } from "./live2d-utils";

// 嘴巴参数：优先 ParamMouthOpenY（标准），回退 ParamA（日式口型）
const MOUTH_PARAMS = ["ParamMouthOpenY", "ParamA"];

// 加载 Cubism Core 脚本（全局唯一，避免重复加载）
let coreLoadPromise: Promise<void> | null = null;

function loadCubismCore(): Promise<void> {
  if (coreLoadPromise) return coreLoadPromise;
  coreLoadPromise = new Promise<void>((resolve, reject) => {
    if ("Live2DCubismCore" in window) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src =
      "https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("无法加载 Live2D Cubism Core"));
    script.async = true;
    script.setAttribute("fetchpriority", "high");
    document.head.appendChild(script);
  });
  return coreLoadPromise;
}

export function useLive2DModel({
  canvas,
  modelPath,
  speaking = false,
  onReady,
}: UseLive2DModelOptions) {
  const appRef = useRef<Application | null>(null);
  const modelRef = useRef<Live2DModel | null>(null);
  const tickerRef = useRef<Ticker | null>(null);
  // 模型就绪状态——供 useLive2DInteraction 作为 effect 依赖
  const [isReady, setIsReady] = useState(false);
  // 嘴巴动画相位
  const mouthPhaseRef = useRef(0);
  // 用 ref 持有 speaking/onReady，避免回调变化时重建整个模型
  const speakingRef = useRef(speaking);
  const onReadyRef = useRef(onReady);
  // React 19 在 effect 中同步 ref
  useEffect(() => {
    speakingRef.current = speaking;
  });
  useEffect(() => {
    onReadyRef.current = onReady;
  });

  // 初始化 PixiJS + Live2D 模型
  useEffect(() => {
    if (!canvas) return;

    const canvasEl = canvas;
    let disposed = false;
    setIsReady(false);

    async function init() {
      try {
        // 1. 加载 Cubism Core
        await loadCubismCore();
        if (disposed) return;

        // 2. 动态导入（避免 SSR 时报错）
        const PIXI = await import("pixi.js");
        (window as unknown as Record<string, unknown>).PIXI = PIXI;

        const { Live2DModel: Live2DModelClass } =
          await import("pixi-live2d-display/cubism4");
        if (disposed) return;

        // 3. 创建 PixiJS Application（透明背景）
        const app = new PIXI.Application({
          view: canvasEl,
          width: canvasEl.width,
          height: canvasEl.height,
          backgroundAlpha: 0,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        });
        appRef.current = app;
        if (disposed) {
          app.destroy(true);
          return;
        }

        // 4. 加载模型
        const model = await Live2DModelClass.from(modelPath, {
          autoHitTest: false,
          autoFocus: false,
        });
        modelRef.current = model;
        if (disposed) {
          model.destroy();
          return;
        }

        // 5. 定位模型
        const dpr = window.devicePixelRatio || 1;
        const cssW = canvasEl.width / dpr;
        const cssH = canvasEl.height / dpr;

        model.anchor.set(0.5, 0.5);
        model.position.set(cssW / 2, cssH * 0.35);

        const modelWidth = model.width;
        const modelHeight = model.height;
        if (modelWidth > 0 && modelHeight > 0) {
          const scale = cssW / modelWidth;
          model.scale.set(scale * 0.7);
        }

        app.stage.addChild(model);

        // 6. 启动动画循环——仅处理嘴巴动画
        // 注意：视线跟踪、悬停、空闲、点击均由 useLive2DInteraction 管理
        const ticker = new PIXI.Ticker();
        tickerRef.current = ticker;
        ticker.add(() => {
          if (disposed) return;

          try {
            // 说话状态——嘴巴正弦开合（通过 ref 读取最新值）
            if (speakingRef.current) {
              mouthPhaseRef.current += 0.15;
              const mouthValue =
                Math.abs(Math.sin(mouthPhaseRef.current)) * 0.7;
              for (const name of MOUTH_PARAMS) {
                trySetParam(model, name, mouthValue);
              }
            } else {
              // 不说话时缓慢回正嘴巴
              mouthPhaseRef.current = 0;
              for (const name of MOUTH_PARAMS) {
                trySetParam(model, name, 0);
              }
            }
          } catch {
            // 动画循环中的错误不应中断渲染
          }
        });
        ticker.start();

        // 标记就绪——触发 useLive2DInteraction 的 effect 重跑
        setIsReady(true);
        // 通知父组件加载完成
        onReadyRef.current?.();
      } catch (err) {
        console.error("Live2D 初始化失败:", err);
        if (!disposed) {
          canvasEl.dispatchEvent(
            new CustomEvent("live2d-error", { detail: err }),
          );
        }
      }
    }

    init();

    // 清理函数
    return () => {
      disposed = true;

      if (tickerRef.current) {
        tickerRef.current.destroy();
        tickerRef.current = null;
      }

      if (modelRef.current) {
        try {
          modelRef.current.destroy();
        } catch { /* 忽略销毁错误 */ }
        modelRef.current = null;
      }

      if (appRef.current) {
        try {
          appRef.current.destroy(true, {
            children: true,
            texture: true,
          });
        } catch { /* 忽略销毁错误 */ }
        appRef.current = null;
      }
    };
  }, [canvas, modelPath]);

  // 返回 modelRef 和 isReady，供 useLive2DInteraction 使用
  return { modelRef, isReady };
}
