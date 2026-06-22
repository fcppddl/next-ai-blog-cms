"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { Bot } from "lucide-react";
import type { Live2DBotProps } from "./live2d/types";

// ─── 常量 ──────────────────────────────────────────────────────────────────

/** Live2D 角色 Canvas 显示尺寸（CSS 像素）- 诊断用 */
const CANVAS_WIDTH = 100;
const CANVAS_HEIGHT = 125;

/** 延迟加载——等浏览器空闲后再初始化（ms），缩短以加快线上加载速度 */
const IDLE_DELAY_MS = 200;

/** 单次加载超时——超过此时间未就绪则重试（ms） */
const LOAD_TIMEOUT_MS = 60_000;

/** 最大重试次数（超时或加载失败后自动重试，超过后才回退到静态图标） */
const MAX_RETRIES = 3;

// ─── 动态导入 Live2D Canvas（禁止 SSR） ────────────────────────────────────

const Live2DCanvas = dynamic(() => import("./live2d/live2d-canvas"), {
  ssr: false,
  loading: () => null,
});

// ─── 移动端检测 ────────────────────────────────────────────────────────────

function useIsMobile(): boolean {
  // 惰性初始化——在 useState 中同步读取当前值，避免 effect 中同步 setState
  const [mobile, setMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 768px)").matches;
  });
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 768px)");
    // 只订阅变更，初始值已在 useState 中设置
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return mobile;
}

// ─── 静态回退按钮 ──────────────────────────────────────────────────────────

function StaticBot() {
  return (
    <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-700 shadow-lg ring-1 ring-white/15">
      <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.12),transparent_60%)]" />
      <Bot className="relative h-6 w-6 text-white" />
    </span>
  );
}

// ─── 主组件 ────────────────────────────────────────────────────────────────

export default function Live2DBot({
  modelPath,
  streaming = false,
  onToggle,
  onReady: onReadyProp,
}: Live2DBotProps) {
  const isMobile = useIsMobile();

  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [shouldLoad, setShouldLoad] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 当前已重试次数（就绪后归零） */
  const retryCountRef = useRef(0);
  /** 每次重试递增，作为 canvas key 强制重建模型 */
  const [retryKey, setRetryKey] = useState(0);

  // ── 延迟加载逻辑 ───────────────────────────────────────────────────

  useEffect(() => {
    if (isMobile) return;

    // Safari 不支持 requestIdleCallback / cancelIdleCallback，使用 setTimeout 回退
    if (typeof requestIdleCallback !== "undefined") {
      const idleId = requestIdleCallback(
        () => {
          setShouldLoad(true);
          setStatus("loading");
        },
        { timeout: IDLE_DELAY_MS },
      );
      return () => cancelIdleCallback(idleId);
    } else {
      const idleId = setTimeout(() => {
        setShouldLoad(true);
        setStatus("loading");
      }, IDLE_DELAY_MS);
      return () => clearTimeout(idleId);
    }
  }, [isMobile]);

  // ── 加载超时（含重试逻辑） ─────────────────────────────────────────

  useEffect(() => {
    if (status !== "loading") return;

    timeoutRef.current = setTimeout(() => {
      if (retryCountRef.current < MAX_RETRIES) {
        // 超时后重试：增加计数，通过 key 变化强制卸载旧 canvas 并重新加载模型
        retryCountRef.current += 1;
        console.warn(
          `[Live2D] 加载超时（${LOAD_TIMEOUT_MS / 1000}s），第 ${retryCountRef.current}/${MAX_RETRIES} 次重试…`,
        );
        setRetryKey((k) => k + 1);
        // status 保持 "loading"，retryKey 变化触发本 effect 重跑启动新计时器
      } else {
        // 超过最大重试次数，仅打印控制台，UI 静默回退到静态图标（不显示任何文字）
        console.warn(
          `[Live2D] 已超时重试 ${MAX_RETRIES} 次，回退到静态图标`,
        );
        setStatus("error");
      }
    }, LOAD_TIMEOUT_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [status, retryKey]);

  // ── 回调 ───────────────────────────────────────────────────────────

  const handleReady = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    retryCountRef.current = 0; // 加载成功，重置重试计数
    setStatus("ready");
    onReadyProp?.();
  }, [onReadyProp]);

  const handleError = useCallback((message: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (retryCountRef.current < MAX_RETRIES) {
      // 模型加载失败也自动重试，仅打印控制台不显示 UI 文字
      retryCountRef.current += 1;
      console.warn(
        `[Live2D] 加载失败：${message}，第 ${retryCountRef.current}/${MAX_RETRIES} 次重试…`,
      );
      setRetryKey((k) => k + 1);
    } else {
      // 已重试多次仍失败，仅打印控制台，UI 静默回退
      console.warn(
        `[Live2D] 加载失败（已重试 ${MAX_RETRIES} 次）：${message}`,
      );
      setStatus("error");
    }
  }, []);

  // ── 渲染 ───────────────────────────────────────────────────────────

  if (isMobile) {
    return <StaticBot />;
  }

  // 加载失败——静默回退到机器人图标按钮
  if (status === "error") {
    return <StaticBot />;
  }

  // 已开始加载——StaticBot 可见在前，canvas 后台预加载（不可见），就绪后交叉淡入淡出
  if (shouldLoad) {
    return (
      <span className="relative block h-14 w-14">
        {/* 静态机器人图标——加载中可见，就绪后淡出 */}
        <span
          className="absolute inset-0 transition-opacity duration-500"
          style={{ opacity: status === "ready" ? 0 : 1 }}
        >
          <StaticBot />
        </span>
        {/* Live2D Canvas——加载中不可见，就绪后淡入，绝对定位居中不裁剪溢出 */}
        <span
          className="absolute block transition-opacity duration-500"
          style={{
            opacity: status === "ready" ? 1 : 0,
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
          }}
        >
          <span style={{ pointerEvents: "auto" }}>
            <Live2DCanvas
              key={retryKey}
              modelPath={modelPath}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              streaming={streaming}
              onTap={onToggle}
              onReady={handleReady}
              onError={handleError}
            />
          </span>
        </span>
      </span>
    );
  }

  // 初始 idle——显示机器人图标按钮，等待延迟加载触发
  return <StaticBot />;
}
