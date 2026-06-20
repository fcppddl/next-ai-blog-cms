"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { Bot } from "lucide-react";
import type { Live2DBotProps } from "./live2d/types";

// ─── 常量 ──────────────────────────────────────────────────────────────────

/** Live2D 角色 Canvas 显示尺寸（CSS 像素）- 诊断用 */
const CANVAS_WIDTH = 100;
const CANVAS_HEIGHT = 125;

/** 延迟加载——等浏览器空闲后再初始化（ms） */
const IDLE_DELAY_MS = 2000;

/** 加载超时——超过此时间未就绪则回退到静态图标（ms） */
const LOAD_TIMEOUT_MS = 15000;

// ─── 动态导入 Live2D Canvas（禁止 SSR） ────────────────────────────────────

const Live2DCanvas = dynamic(() => import("./live2d/live2d-canvas"), {
  ssr: false,
  loading: () => null,
});

// ─── 移动端检测 ────────────────────────────────────────────────────────────

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 768px)");
    setMobile(mql.matches);
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
  const [errorMessage, setErrorMessage] = useState<string>("");

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 延迟加载逻辑 ───────────────────────────────────────────────────

  useEffect(() => {
    if (isMobile) return;

    const idleId =
      typeof requestIdleCallback !== "undefined"
        ? requestIdleCallback(
            () => {
              setShouldLoad(true);
              setStatus("loading");
            },
            { timeout: IDLE_DELAY_MS },
          )
        : setTimeout(() => {
            setShouldLoad(true);
            setStatus("loading");
          }, IDLE_DELAY_MS);

    return () => {
      if (typeof idleId === "number") {
        cancelIdleCallback(idleId);
      } else {
        clearTimeout(idleId);
      }
    };
  }, [isMobile]);

  // ── 加载超时 ───────────────────────────────────────────────────────

  useEffect(() => {
    if (status !== "loading") return;

    timeoutRef.current = setTimeout(() => {
      setErrorMessage("加载超时（15s）");
      setStatus("error");
    }, LOAD_TIMEOUT_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [status]);

  // ── 回调 ───────────────────────────────────────────────────────────

  const handleReady = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setStatus("ready");
    onReadyProp?.();
  }, [onReadyProp]);

  const handleError = useCallback((msg: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setErrorMessage(msg);
    setStatus("error");
  }, []);

  // ── 渲染 ───────────────────────────────────────────────────────────

  if (isMobile) {
    return <StaticBot />;
  }

  // 加载失败——显示原始机器人图标按钮
  if (status === "error") {
    return (
      <span className="relative block">
        <StaticBot />
        {errorMessage && (
          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-red-100 px-2 py-0.5 text-[10px] text-red-700 dark:bg-red-900/50 dark:text-red-300">
            {errorMessage}
          </span>
        )}
      </span>
    );
  }

  // 已开始加载——后台渲染 canvas（不可见），就绪后淡入，保持挂载避免重建模型
  if (shouldLoad) {
    return (
      <span className="relative block h-14 w-14">
        {/* Live2D Canvas——绝对定位居中，不裁剪溢出 */}
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

  // 初始 idle——不显示占位，保留可点击区域
  return <span className="relative block h-14 w-14" />;
}
