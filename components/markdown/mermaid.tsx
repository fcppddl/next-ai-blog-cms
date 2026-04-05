"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import mermaid from "mermaid";

interface MermaidProps {
  chart: string;
  id: string;
}

const mermaidCache = new Map<string, { svg: string; theme: string }>();

export default function Mermaid({ chart, id }: MermaidProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isDark, setIsDark] = useState(false);
  const renderAttempted = useRef(false);

  const currentTheme = useMemo(() => {
    if (typeof window === "undefined") return "default";
    return document.documentElement.classList.contains("dark")
      ? "dark"
      : "default";
  }, []);

  useEffect(() => {
    setIsDark(currentTheme === "dark");
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, [currentTheme]);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      theme: isDark ? "dark" : "default",
      securityLevel: "loose",
      themeVariables: isDark
        ? {
            primaryColor: "#1f2937",
            primaryBorderColor: "#4b5563",
            primaryTextColor: "#f3f4f6",
            lineColor: "#6b7280",
            secondBkgColor: "#111827",
            tertiaryTextColor: "#d1d5db",
          }
        : undefined,
    });
  }, [isDark]);

  useEffect(() => {
    const renderChart = async () => {
      if (!chart || renderAttempted.current) return;
      const theme = isDark ? "dark" : "default";
      const cacheKey = `${chart}-${theme}`;
      const cached = mermaidCache.get(cacheKey);
      if (cached) {
        setSvg(cached.svg);
        setError("");
        return;
      }
      renderAttempted.current = true;
      try {
        setError("");
        const { svg: renderedSvg } = await mermaid.render(
          `mermaid-${id}-${Date.now()}`,
          chart
        );
        mermaidCache.set(cacheKey, { svg: renderedSvg, theme });
        setSvg(renderedSvg);
      } catch (err) {
        console.error("Mermaid render error:", err);
        setError("Failed to render diagram");
      } finally {
        renderAttempted.current = false;
      }
    };
    renderChart();
  }, [chart, id, isDark]);

  useEffect(() => {
    return () => {
      if (mermaidCache.size > 50) {
        const entries = Array.from(mermaidCache.entries());
        mermaidCache.clear();
        entries.slice(-20).forEach(([key, value]) => mermaidCache.set(key, value));
      }
    };
  }, []);

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-red-600 dark:text-red-400 text-sm">
          图表渲染失败: {error}
        </p>
        <pre className="mt-2 text-xs text-gray-600 dark:text-gray-400 overflow-x-auto">
          {chart}
        </pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="flex justify-center items-center my-4 h-20">
        <div className="flex items-center space-x-2 text-muted-foreground">
          <div className="w-4 h-4 border-2 border-border border-t-foreground rounded-full animate-spin" />
          <span className="text-sm">渲染图表中...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="flex justify-center my-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
