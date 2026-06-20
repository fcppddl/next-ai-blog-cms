"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { Bot } from "lucide-react";
import type { Live2DBotProps } from "./live2d/types";

// ─── 常量 ──────────────────────────────────────────────────────────────────

/** Live2D 角色 Canvas 显示尺寸（CSS 像素） */
const CANVAS_WIDTH = 120;
const CANVAS_HEIGHT = 160;

/** 延迟加载——等浏览器空闲后再初始化（ms） */
const IDLE_DELAY_MS = 2000;

/** 加载超时——超过此时间未就绪则回退到静态图标（ms） */
const LOAD_TIMEOUT_MS = 8000;

// ─── 动态导入 Live2D Canvas（禁止 SSR） ────────────────────────────────────

const Live2DCanvas = dynamic(
  () => import("./live2d/live2d-canvas"),
  {
    ssr: false,
    loading: () => null,
  },
);

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

// ─── 加载骨架 ──────────────────────────────────────────────────────────────

/**
 * 加载中和原 FAB 按钮一致的渐变圆圈骨架，保持视觉连续性。
 * 模型就绪后 Live2D 角色淡入替换。
 */
function LoadingSkeleton() {
  return (
    <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-700 shadow-lg ring-1 ring-white/15">
      <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.12),transparent_60%)]" />
      <span className="relative flex items-center justify-center">
        <span className="h-6 w-6 animate-pulse rounded-full bg-white/25" />
      </span>
    </span>
  );
}

// ─── 静态回退按钮 ──────────────────────────────────────────────────────────

/** 当 Live2D 不可用时显示的静态 Bot 图标 */
function StaticBot() {
  return (
    <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-700 shadow-lg ring-1 ring-white/15">
      <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.12),transparent_60%)]" />
      <Bot className="relative h-6 w-6 text-white" />
    </span>
  );
}

// ─── 主组件 ────────────────────────────────────────────────────────────────

/**
 * Live2DBot——Live2D 动画角色按钮
 *
 * 替换原有的静态 Bot 图标，显示 Live2D 动画角色。
 * 自动降级：移动端 || 加载失败 → 显示原静态 Bot 图标。
 * 低优先级加载：等页面空闲后才开始加载 SDK 和模型，不影响首屏。
 */
export default function Live2DBot({
  modelPath,
  streaming = false,
  onToggle,
}: Live2DBotProps) {
  const isMobile = useIsMobile();

  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [shouldLoad, setShouldLoad] = useState(false);

  // 超时计时器
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 延迟加载逻辑 ───────────────────────────────────────────────────

  useEffect(() => {
    // 移动端不加载 Live2D
    if (isMobile) return;

    // 使用 requestIdleCallback 等待浏览器空闲后再开始加载
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
  }, []);

  const handleError = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setStatus("error");
  }, []);

  // ── 渲染 ───────────────────────────────────────────────────────────

  // 移动端直接显示静态图标
  if (isMobile) {
    return <StaticBot />;
  }

  // 尚未开始加载（等待空闲）
  if (!shouldLoad) {
    return <LoadingSkeleton />;
  }

  // 正在加载
  if (status === "loading") {
    return <LoadingSkeleton />;
  }

  // 加载失败
  if (status === "error") {
    return <StaticBot />;
  }

  // 已就绪——渲染 Live2D 角色，带淡入效果
  return (
    <span
      className="block transition-opacity duration-500"
      style={{ opacity: status === "ready" ? 1 : 0 }}
    >
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
  );
}
