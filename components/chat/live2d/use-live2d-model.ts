"use client";

import { useEffect, useRef } from "react";
import type { UseLive2DModelOptions } from "./types";
import type { Application, Ticker } from "pixi.js";
import type { Live2DModel } from "pixi-live2d-display/cubism4";

// Cubism 4 核心模型参数接口——trySetParam 需要访问 getParameters()
interface Cubism4Parameters {
  getIndexByName(name: string): number;
  setValueByIndex(idx: number, value: number): void;
}

interface Cubism4CoreModel {
  getParameters(): Cubism4Parameters;
}

// 常见模型参数名——头部和眼球跟踪
const HEAD_PARAM_X = "ParamAngleX";
const HEAD_PARAM_Y = "ParamAngleY";
const EYE_PARAM_X = "ParamEyeBallX";
const EYE_PARAM_Y = "ParamEyeBallY";
// 嘴巴参数：优先 ParamMouthOpenY（标准），回退 ParamA（日式口型）
const MOUTH_PARAMS = ["ParamMouthOpenY", "ParamA"];

// 尝试设置模型参数，参数名不存在则静默忽略
function trySetParam(model: Live2DModel, name: string, value: number): void {
  try {
    const coreModel = model.internalModel?.coreModel as
      | Cubism4CoreModel
      | undefined;
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
    if ("Live2DCubismCore" in window) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    // 使用 Live2D 官方 CDN，无需手动下载 Cubism Core
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
  onTap,
  onReady,
  speaking = false,
}: UseLive2DModelOptions) {
  const appRef = useRef<Application | null>(null);
  const modelRef = useRef<Live2DModel | null>(null);
  const tickerRef = useRef<Ticker | null>(null);
  const disposedRef = useRef(false);
  // 鼠标位置（用于视线跟踪的动画循环）
  const mouseRef = useRef({ x: 0, y: 0 });
  // 嘴巴动画相位
  const mouthPhaseRef = useRef(0);
  // 用 ref 持有 speaking/onTap/onReady，避免回调变化时重建整个模型
  const speakingRef = useRef(speaking);
  const onTapRef = useRef(onTap);
  const onReadyRef = useRef(onReady);
  // 在 effect 中同步 ref（React 19 不在 render 期间写入 ref）
  useEffect(() => {
    speakingRef.current = speaking;
  });
  useEffect(() => {
    onTapRef.current = onTap;
  });
  useEffect(() => {
    onReadyRef.current = onReady;
  });

  // 鼠标移动追踪（独立 effect，不依赖模型初始化）
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      // 映射到 -1..1 范围
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
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

        // pixi-live2d-display 依赖 window.PIXI，挂载到全局
        (window as unknown as Record<string, unknown>).PIXI = PIXI;

        // 使用 cubism4 子模块，避免主入口检查 Cubism 2 运行时（我们只加载了 Cubism 4）
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
        // autoInteract 已在 v0.5.0 废弃，改用 autoHitTest + autoFocus
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
        // canvasEl.width/height 是物理像素（含 DPR），PixiJS autoDensity 用 CSS 像素坐标系
        // 所以坐标和缩放都必须除以 DPR
        const dpr = window.devicePixelRatio || 1;
        const cssW = canvasEl.width / dpr;
        const cssH = canvasEl.height / dpr;

        model.anchor.set(0.5, 0.5);
        // 模型中心放在画布上半部分，让头部落在 56×56 圆形区域内
        model.position.set(cssW / 2, cssH * 0.35);

        const modelWidth = model.width;
        const modelHeight = model.height;
        if (modelWidth > 0 && modelHeight > 0) {
          // 按宽度缩放——确保头部在圆形区域内足够大
          const scale = cssW / modelWidth;
          model.scale.set(scale * 0.7);
        }

        app.stage.addChild(model);

        // 6. 点击反馈——播放 Tap 动作
        model.on("pointertap", () => {
          onTapRef.current?.();
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
        tickerRef.current = ticker;
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
            // 尝试多个嘴巴参数名以兼容不同模型（ParamMouthOpenY / ParamA）
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

        // 通知父组件加载完成
        onReadyRef.current?.();
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

      // 停止并销毁 ticker
      if (tickerRef.current) {
        tickerRef.current.destroy();
        tickerRef.current = null;
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
    // 仅依赖 canvas 和 modelPath，回调/状态通过 ref 读取最新值，避免不必要的重建
  }, [canvas, modelPath]);
}
