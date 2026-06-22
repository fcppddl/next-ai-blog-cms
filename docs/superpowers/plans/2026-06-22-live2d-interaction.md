# Live2D 交互行为完善 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复视线跟随 bug 并补齐悬停反应、空闲摸鱼、点击反馈三项交互行为

**Architecture:** 新增 `useLive2DInteraction` hook 负责全部交互逻辑，与 `useLive2DModel` 共享 `modelRef`；修复 `trySetParam` → `model.setParamFloat()` 的 API 路径 bug

**Tech Stack:** pixi-live2d-display (Cubism4), PixiJS v8 Ticker, React 19 hooks

---

### Task 1: 更新类型定义

**Files:**
- Modify: `components/chat/live2d/types.ts`

- [ ] **Step 1: 添加 UseLive2DInteractionOptions 和更新 UseLive2DModelOptions**

```typescript
// components/chat/live2d/types.ts 完整替换为：

// 组件对外 Props
export interface Live2DBotProps {
  /** 模型文件路径（相对于 public 目录，如 /live2d/haru/haru.model3.json） */
  modelPath: string;
  /** AI 是否正在流式回复——角色嘴巴张合 */
  streaming?: boolean;
  /** 点击角色时触发（打开/关闭聊天面板） */
  onToggle?: () => void;
  /** 模型加载就绪回调——父组件可用于隐藏加载态光晕 */
  onReady?: () => void;
}

// 内部状态
export type Live2DStatus = "loading" | "ready" | "error";

// 模型 Hook 参数
export interface UseLive2DModelOptions {
  /** 目标 canvas 元素 */
  canvas: HTMLCanvasElement | null;
  /** 模型文件路径 */
  modelPath: string;
  /** 是否处于说话状态（嘴巴张合） */
  speaking?: boolean;
  /** 模型加载成功回调 */
  onReady?: () => void;
}

// 交互 Hook 参数
export interface UseLive2DInteractionOptions {
  /** PixiJS Live2DModel 实例引用（来自 useLive2DModel） */
  modelRef: React.RefObject<import("pixi-live2d-display/cubism4").Live2DModel | null>;
  /** Canvas DOM 元素（用于监听 mouseenter/mouseleave） */
  canvas: HTMLCanvasElement | null;
  /** AI 是否正在说话（说话时暂停空闲计时器） */
  speaking?: boolean;
  /** 空闲触发间隔，默认 10_000ms */
  idleTimeout?: number;
  /** 点击角色回调 */
  onTap?: () => void;
}
```

- [ ] **Step 2: 类型检查**

```bash
npm run type-check
```
Expected: 此时会因引用不存在的 `use-live2d-interaction` 报错，忽略，后续任务会修复。

---

### Task 2: 重构 useLive2DModel —— 修复参数 API + 精简职责

**Files:**
- Modify: `components/chat/live2d/use-live2d-model.ts`

**核心改动：**
1. 删除错误的 `trySetParam` 函数和所有头/眼参数常量
2. 删除鼠标追踪 effect 和 ticker 中的视线跟踪代码
3. 删除 tap 事件处理
4. **保留**嘴巴动画（`MOUTH_PARAMS`、`mouthPhaseRef`、ticker 中嘴巴逻辑）
5. 新增返回 `modelRef` 供交互 hook 使用
6. 移除不再需要的 `onTap` 参数

- [ ] **Step 1: 替换 use-live2d-model.ts 完整内容**

```typescript
"use client";

import { useEffect, useRef } from "react";
import type { UseLive2DModelOptions } from "./types";
import type { Application, Ticker } from "pixi.js";
import type { Live2DModel } from "pixi-live2d-display/cubism4";

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
  const disposedRef = useRef(false);
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
    disposedRef.current = false;
    let disposed = false;

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
                const idx = model.getParamIndex(name);
                if (idx >= 0) model.setParamFloat(name, mouthValue);
              }
            } else {
              // 不说话时缓慢回正嘴巴
              mouthPhaseRef.current = 0;
              for (const name of MOUTH_PARAMS) {
                const idx = model.getParamIndex(name);
                if (idx >= 0) model.setParamFloat(name, 0);
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

  // 返回 modelRef，供 useLive2DInteraction 使用
  return { modelRef };
}
```

- [ ] **Step 2: 类型检查**

```bash
npm run type-check
```
Expected: 可能有 useLive2DInteraction 相关的暂时性错误，核心 model hook 无错误。

---

### Task 3: 新建 useLive2DInteraction hook

**Files:**
- Create: `components/chat/live2d/use-live2d-interaction.ts`

**关键实现细节：**
- 视线跟随：`model.setParamFloat("ParamAngleX", mx * 25)` 等
- 悬停反应：mouseenter 设 `model.expression(1)`（exp_02 笑脸眼），mouseleave 清表情
- 点击反馈：`model.motion("", 3)`（special_01），触发 `onTap`
- 空闲摸鱼：10s 无交互后从 unnamed group 随机选 motion 播放

- [ ] **Step 1: 创建 use-live2d-interaction.ts**

```typescript
"use client";

import { useEffect, useRef, useCallback } from "react";
import type { Ticker } from "pixi.js";
import type { Live2DModel } from "pixi-live2d-display/cubism4";
import type { UseLive2DInteractionOptions } from "./types";

// ─── 常量 ──────────────────────────────────────────────────────────────────────

/** 空闲触发间隔（默认 10s） */
const DEFAULT_IDLE_TIMEOUT = 10_000;

/** 悬停时使用的表情索引（exp_02 = 笑脸眼） */
const HOVER_EXPRESSION_INDEX = 1;

/** 点击时播放的动作索引（special_01 在 unnamed group 中的 index） */
const TAP_MOTION_INDEX = 3;

/** 非 idle 动作所在的 group 名（空字符串） */
const FIDGET_GROUP = "";

/** 空闲摸鱼候选动作总数（mtn_02~04 + special_01~03 = 6 个） */
const FIDGET_MOTION_COUNT = 6;

// ─── 视线跟踪参数 ─────────────────────────────────────────────────────────────

/** 视线跟踪参数名及缩放系数 */
const EYE_TRACK_PARAMS: Array<{ name: string; scale: number }> = [
  { name: "ParamAngleX", scale: 25 },
  { name: "ParamAngleY", scale: 20 },
  { name: "ParamEyeBallX", scale: 0.8 },
  { name: "ParamEyeBallY", scale: 0.8 },
];

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useLive2DInteraction({
  modelRef,
  canvas,
  speaking = false,
  idleTimeout = DEFAULT_IDLE_TIMEOUT,
  onTap,
}: UseLive2DInteractionOptions) {
  // ── Refs ──────────────────────────────────────────────────────────────────
  const mouseRef = useRef({ x: 0, y: 0 });
  const isHoveringRef = useRef(false);
  const tickerRef = useRef<Ticker | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speakingRef = useRef(speaking);
  const onTapRef = useRef(onTap);

  // 同步最新 props 到 ref（React 19 在 effect 中同步）
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

  // 重置空闲计时器（交互事件触发时调用）
  const resetIdleTimer = useCallback(() => {
    clearIdleTimer();
    startIdleTimer();
  }, [clearIdleTimer, startIdleTimer]);

  // ── 视线跟踪 + 悬停反应 ─────────────────────────────────────────────────

  useEffect(() => {
    const model = modelRef.current;
    if (!model || !canvas) return;

    // --- 鼠标移动：视线跟随 ---
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      // 映射到 -1..1 范围
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      // 重置空闲计时器
      resetIdleTimer();
    };

    // --- 鼠标进入：悬停反应 ---
    const handleMouseEnter = () => {
      isHoveringRef.current = true;
      // 尝试设置笑脸表情（exp_02）
      model.expression(HOVER_EXPRESSION_INDEX).catch(() => {
        // 表情加载失败，静默回退到参数调整
      });
      resetIdleTimer();
    };

    // --- 鼠标离开：复位 ---
    const handleMouseLeave = () => {
      isHoveringRef.current = false;
      // 清除表情，恢复默认
      model.expression().catch(() => { /* 静默忽略 */ });
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
    const ticker = new (await import("pixi.js")).Ticker();
    tickerRef.current = ticker;
    ticker.add(() => {
      const m = modelRef.current;
      if (!m) return;

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      // 应用视线跟踪参数
      for (const { name, scale } of EYE_TRACK_PARAMS) {
        const idx = m.getParamIndex(name);
        if (idx >= 0) {
          m.setParamFloat(name, (name.includes("X") ? mx : my) * scale);
        }
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
  }, [modelRef.current, canvas, resetIdleTimer]);
  // 注意：依赖 modelRef.current，当模型就绪后此 effect 运行一次
  // 回调通过 ref 读取最新值，无需重新绑定

  // ── 启动初始空闲计时器 ───────────────────────────────────────────────────

  useEffect(() => {
    if (!modelRef.current) return;
    startIdleTimer();
    return () => clearIdleTimer();
  }, [modelRef.current, startIdleTimer, clearIdleTimer]);

  // ── 说话状态变化时管理空闲计时器 ─────────────────────────────────────────

  useEffect(() => {
    if (speaking) {
      // 说话时暂停空闲计时器
      clearIdleTimer();
    } else if (modelRef.current) {
      // 说完话重置空闲计时器
      startIdleTimer();
    }
  }, [speaking, clearIdleTimer, startIdleTimer]);
}
```

**注意**：Step 1 中的 `await import("pixi.js")` 在 effect 回调中不能直接使用顶层 await。需要改为先导入 PIXI 模块。

- [ ] **Step 2: 修正 PixiJS Ticker 的导入方式**

Ticker 不能通过异步 import 在 effect 内创建。改用同步方式——PixiJS 在 useLive2DModel 的 init 中已经挂载到 `window.PIXI`，直接使用：

将 Step 1 中的 ticker 创建部分替换为：
```typescript
    // --- 创建 Ticker：逐帧应用视线跟踪参数 ---
    const PIXI = (window as unknown as Record<string, unknown>).PIXI as typeof import("pixi.js");
    const TickerClass = PIXI.Ticker;
    const ticker = new TickerClass();
```

同时文件顶部不再需要 `import type { Ticker }`（改为从全局 PIXI 获取类型）。

- [ ] **Step 3: 最终完整版本**

综合 Step 1 + Step 2 修正，最终代码：

```typescript
"use client";

import { useEffect, useRef, useCallback } from "react";
import type { Live2DModel } from "pixi-live2d-display/cubism4";
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

/** idle 动作组名 */
const IDLE_GROUP = "Idle";

/** 空闲摸鱼候选动作总数（mtn_02~04、special_01~03 = 6 个） */
const FIDGET_MOTION_COUNT = 6;

// ─── 视线跟踪参数 ─────────────────────────────────────────────────────────────

/** 视线跟踪参数名及缩放系数 */
const EYE_TRACK_PARAMS: Array<{ name: string; scale: number }> = [
  { name: "ParamAngleX", scale: 25 },
  { name: "ParamAngleY", scale: 20 },
  { name: "ParamEyeBallX", scale: 0.8 },
  { name: "ParamEyeBallY", scale: 0.8 },
];

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useLive2DInteraction({
  modelRef,
  canvas,
  speaking = false,
  idleTimeout = DEFAULT_IDLE_TIMEOUT,
  onTap,
}: UseLive2DInteractionOptions) {
  // ── Refs ──────────────────────────────────────────────────────────────────
  const mouseRef = useRef({ x: 0, y: 0 });
  const tickerRef = useRef<InstanceType<
    (typeof import("pixi.js"))["Ticker"]
  > | null>(null);
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

  // ── 交互事件绑定（仅在模型就绪后执行一次） ──────────────────────────────

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
        const idx = m.getParamIndex(name);
        if (idx >= 0) {
          m.setParamFloat(name, (name.includes("X") ? mx : my) * scale);
        }
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
  }, [modelRef.current, canvas, resetIdleTimer]);
  // 注意：依赖 modelRef.current 和 canvas，模型就绪或重试时此 effect 重新执行
  // 回调（onTap）通过 ref 读取最新值，无需重新绑定

  // ── 启动初始空闲计时器 ───────────────────────────────────────────────────

  useEffect(() => {
    if (!modelRef.current) return;
    startIdleTimer();
    return () => clearIdleTimer();
  }, [modelRef.current, startIdleTimer, clearIdleTimer]);

  // ── 说话状态变化时管理空闲计时器 ─────────────────────────────────────────

  useEffect(() => {
    if (speaking) {
      clearIdleTimer();
    } else if (modelRef.current) {
      startIdleTimer();
    }
  }, [speaking, clearIdleTimer, startIdleTimer]);
}
```

- [ ] **Step 4: 类型检查**

```bash
npm run type-check
```
Expected: 可能有 Ticker 类型推断相关问题，暂忽略，Task 4 完成后一起检查。

---

### Task 4: 更新 Live2DCanvas 组件 —— 注入交互 hook

**Files:**
- Modify: `components/chat/live2d/live2d-canvas.tsx`

- [ ] **Step 1: 替换 live2d-canvas.tsx**

```typescript
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
  /** AI 是否正在流式回复 */
  streaming?: boolean;
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
 *   useLive2DModel     → 模型初始化 + 嘴巴动画
 *   useLive2DInteraction → 视线跟随 + 悬停 + 空闲 + 点击反馈
 *   两者通过 modelRef 共享模型实例。
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
  const { modelRef } = useLive2DModel({
    canvas: canvasEl,
    modelPath,
    speaking: streaming,
    onReady: stableOnReady,
  });

  // 交互行为（视线跟随、悬停反应、空闲摸鱼、点击反馈）
  useLive2DInteraction({
    modelRef,
    canvas: canvasEl,
    speaking: streaming,
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
```

- [ ] **Step 2: 类型检查**

```bash
npm run type-check
```
Expected: 无错误。

- [ ] **Step 3: 构建检查**

```bash
npm run build
```
Expected: 构建成功，无运行时错误。

---

### Task 5: 集成验证

**Files:**
- 无新建/修改文件

- [ ] **Step 1: 启动开发服务器**

```bash
npm run dev
```

- [ ] **Step 2: 手动验证交互行为**

打开浏览器访问博客前台页面（非 `/admin` 路径），验证：

1. **待机呼吸**：角色持续微微起伏 + 眨眼（与原来一致）
2. **视线跟随**：在页面移动鼠标，角色眼睛/头部跟随鼠标位置偏转
3. **悬停反应**：鼠标悬停在角色上，眼睛变笑脸（exp_02）；移开复位
4. **点击反馈**：点击角色，播放 special_01 动作 + 打开聊天面板
5. **说话状态**：发送消息后 AI 回复时，角色嘴巴张合
6. **空闲摸鱼**：10s 不操作后，角色自动播放随机小动作

- [ ] **Step 3: 验证降级场景**

1. **移动端**：缩小浏览器窗口到 <768px，应显示静态 Bot 图标
2. **加载失败**：断网后刷新，应回退到静态 Bot 图标（最多重试 3 次）

- [ ] **Step 4: 控制台检查**

打开浏览器 DevTools Console，确认无 Live2D 相关错误或警告。

- [ ] **Step 5: 提交**

```bash
git add components/chat/live2d/
git commit -m "feat: implement Live2D interactive behaviors — eye tracking, hover reaction, idle fidget, tap feedback

- Fix eye tracking: use model.setParamFloat() instead of broken internalModel path
- Add useLive2DInteraction hook: hover expression, idle timer with random motions, tap special motion
- Refactor useLive2DModel: remove old trySetParam/tap/tracking, expose modelRef, keep mouth animation
- Update Live2DCanvas to wire interaction hook

Co-Authored-By: Claude <noreply@anthropic.com>"
```
