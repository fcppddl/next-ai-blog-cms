"use client";

import { useEffect, useRef } from "react";
import type { UseLive2DModelOptions } from "./types";

// 常见模型参数名——头部和眼球跟踪
const HEAD_PARAM_X = "ParamAngleX";
const HEAD_PARAM_Y = "ParamAngleY";
const EYE_PARAM_X = "ParamEyeBallX";
const EYE_PARAM_Y = "ParamEyeBallY";
const MOUTH_PARAM = "ParamMouthOpenY";

// 尝试设置模型参数，参数名不存在则静默忽略
function trySetParam(model: any, name: string, value: number): void {
  try {
    const coreModel = model.internalModel?.coreModel;
    if (!coreModel) return;
    const params = coreModel.getParameters();
    const idx = params.getIndexByName(name);
    if (idx >= 0) {
      params.setValueByIndex(idx, value);
    }
  } catch {
    // 模型可能没有该参数，静默忽略
  }
}

// 加载 Cubism Core 脚本（全局唯一，避免重复加载）
let coreLoadPromise: Promise<void> | null = null;

function loadCubismCore(): Promise<void> {
  if (coreLoadPromise) return coreLoadPromise;
  coreLoadPromise = new Promise<void>((resolve, reject) => {
    if ((window as any).Live2DCubismCore) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    // 使用 Live2D 官方 CDN，无需手动下载 Cubism Core
    script.src =
      "https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js";
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("无法加载 Live2D Cubism Core"));
    script.async = true;
    script.setAttribute("fetchpriority", "low");
    document.head.appendChild(script);
  });
  return coreLoadPromise;
}

export function useLive2DModel({
  canvas,
  modelPath,
  onTap,
  onReady,
  speaking = false,
}: UseLive2DModelOptions) {
  const appRef = useRef<any>(null);
  const modelRef = useRef<any>(null);
  const disposedRef = useRef(false);
  // 鼠标位置（用于视线跟踪的动画循环）
  const mouseRef = useRef({ x: 0, y: 0 });
  // 嘴巴动画相位
  const mouthPhaseRef = useRef(0);
  // 用 ref 持有 speaking，避免 speaking 变化时重建整个模型
  const speakingRef = useRef(speaking);
  speakingRef.current = speaking;

  // 鼠标移动追踪（独立 effect，不依赖模型初始化）
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      // 映射到 -1..1 范围
      mouseRef.current.x =
        ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y =
        ((e.clientY - rect.top) / rect.height) * 2 - 1;
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [canvas]);

  // 初始化 PixiJS + Live2D 模型
  useEffect(() => {
    if (!canvas) return;

    // 捕获非 null 引用，避免 async 函数内 TypeScript 类型缩窄失效
    const canvasEl = canvas;

    disposedRef.current = false;
    let disposed = false;

    async function init() {
      try {
        // 1. 加载 Cubism Core
        await loadCubismCore();

        if (disposed) return;

        // 2. 动态导入（避免 SSR 时报错）
        const PIXI = await import("pixi.js");

        // pixi-live2d-display 依赖 window.PIXI
        (window as any).PIXI = PIXI;

        const { Live2DModel } = await import("pixi-live2d-display");

        if (disposed) return;

        // 3. 创建 PixiJS Application（透明背景）
        const app = new PIXI.Application({
          view: canvasEl as any,
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
        const model = await Live2DModel.from(modelPath, {
          autoInteract: false, // 手动控制交互
        });
        modelRef.current = model;

        if (disposed) {
          model.destroy();
          return;
        }

        // 5. 定位模型——居中
        model.anchor.set(0.5, 0.5);
        model.position.set(canvasEl.width / 2, canvasEl.height / 2);

        // 缩放适配 canvas
        const modelWidth = model.width;
        const modelHeight = model.height;
        if (modelWidth > 0 && modelHeight > 0) {
          const scale = Math.min(
            canvasEl.width / modelWidth,
            canvasEl.height / modelHeight,
          );
          model.scale.set(scale * 0.85);
        }

        app.stage.addChild(model);

        // 6. 点击反馈——播放 Tap 动作
        model.on("pointertap", () => {
          onTap?.();
          // 尝试常见的 tap 动作名
          const tapMotions = ["tap_01", "tap", "Tap", "Touch_head"];
          for (const name of tapMotions) {
            try {
              const defs = model.internalModel?.motionManager?.definitions;
              if (defs?.[name]) {
                model.motion(name);
                break;
              }
            } catch {
              // 忽略不存在的动作
            }
          }
        });

        // 7. 启动动画循环——处理视线跟踪和嘴巴动画
        const ticker = new PIXI.Ticker();
        ticker.add(() => {
          if (disposed) return;

          try {
            const mx = mouseRef.current.x;
            const my = mouseRef.current.y;

            // 视线跟踪——头部/眼球跟随鼠标
            trySetParam(model, HEAD_PARAM_X, mx * 25);
            trySetParam(model, HEAD_PARAM_Y, my * 20);
            trySetParam(model, EYE_PARAM_X, mx * 0.8);
            trySetParam(model, EYE_PARAM_Y, my * 0.8);

            // 说话状态——嘴巴正弦开合（通过 ref 读取最新值）
            if (speakingRef.current) {
              mouthPhaseRef.current += 0.15;
              const mouthValue =
                Math.abs(Math.sin(mouthPhaseRef.current)) * 0.7;
              trySetParam(model, MOUTH_PARAM, mouthValue);
            } else {
              // 不说话时缓慢回正嘴巴
              mouthPhaseRef.current = 0;
              trySetParam(model, MOUTH_PARAM, 0);
            }
          } catch {
            // 动画循环中的错误不应中断渲染
          }
        });
        ticker.start();

        // 保存 ticker 引用用于清理
        (app as any).__ticker = ticker;

        // 通知父组件加载完成
        onReady?.();
      } catch (err) {
        console.error("Live2D 初始化失败:", err);
        if (!disposed) {
          // 触发 canvas 自定义事件通知父组件
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
      disposedRef.current = true;

      // 停止 ticker
      if (appRef.current?.__ticker) {
        appRef.current.__ticker.destroy();
      }

      // 销毁模型
      if (modelRef.current) {
        try {
          modelRef.current.destroy();
        } catch {
          // 忽略销毁错误
        }
        modelRef.current = null;
      }

      // 销毁 PixiJS 应用
      if (appRef.current) {
        try {
          appRef.current.destroy(true, {
            children: true,
            texture: true,
          });
        } catch {
          // 忽略销毁错误
        }
        appRef.current = null;
      }
    };
    // 仅依赖 canvas 和 modelPath，回调通过 ?. 调用不受闭包影响
    // speaking 通过 ref 读取最新值
  }, [canvas, modelPath]);
}
