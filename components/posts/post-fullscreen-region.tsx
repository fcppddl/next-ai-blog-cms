"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Maximize2, Minimize2 } from "lucide-react";

type FullscreenContextValue = {
  toggle: () => Promise<void>;
  isFullscreen: boolean;
};

const PostFullscreenContext = createContext<FullscreenContextValue | null>(null);

/** 包裹正文区域，对该 DOM 节点请求浏览器全屏（不含顶栏导航） */
export function PostFullscreenRegion({ children }: { children: ReactNode }) {
  const regionRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const syncFullscreen = useCallback(() => {
    const el = regionRef.current;
    setIsFullscreen(el != null && document.fullscreenElement === el);
  }, []);

  useEffect(() => {
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, [syncFullscreen]);

  const toggle = useCallback(async () => {
    const el = regionRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch (err) {
      console.log("全屏切换失败:", err);
    }
  }, []);

  return (
    <PostFullscreenContext.Provider value={{ toggle, isFullscreen }}>
      <div
        ref={regionRef}
        className="mx-auto max-w-5xl bg-background px-4 pt-5 pb-10 [&:fullscreen]:box-border [&:fullscreen]:min-h-screen [&:fullscreen]:overflow-y-auto [&:fullscreen]:pt-6"
      >
        {children}
      </div>
    </PostFullscreenContext.Provider>
  );
}

export function PostFullscreenToggle() {
  const ctx = useContext(PostFullscreenContext);
  if (!ctx) {
    throw new Error("PostFullscreenToggle 必须在 PostFullscreenRegion 内使用");
  }
  const { toggle, isFullscreen } = ctx;

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      className="inline-flex cursor-pointer items-center justify-center rounded-lg p-2 transition-colors hover:bg-accent"
      title={isFullscreen ? "退出全屏" : "全屏阅读"}
      aria-label={isFullscreen ? "退出全屏" : "全屏阅读"}
    >
      {isFullscreen ? (
        <Minimize2 className="h-4 w-4 text-foreground" strokeWidth={2} />
      ) : (
        <Maximize2 className="h-4 w-4 text-foreground" strokeWidth={2} />
      )}
    </button>
  );
}
