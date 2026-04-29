"use client";

import { useState, useEffect } from "react";
import hljs from "highlight.js";
import { useTheme } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";
import "./code-block.css";

interface CodeBlockProps {
  children: string;
  className?: string;
}

/** 兼容 HTTP / 非安全上下文：Clipboard API 仅 HTTPS 或 localhost 可用，否则降级 execCommand */
async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* 降级 */
    }
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export default function CodeBlock({ children, className }: CodeBlockProps) {
  const { theme } = useTheme();
  const [copyState, setCopyState] = useState<"idle" | "ok" | "fail">("idle");
  const [highlighted, setHighlighted] = useState<string[]>([]);

  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : undefined;

  useEffect(() => {
    let result: string;
    if (language && hljs.getLanguage(language)) {
      try {
        result = hljs.highlight(children, { language }).value;
      } catch {
        result = hljs.highlightAuto(children).value;
      }
    } else {
      result = hljs.highlightAuto(children).value;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHighlighted(result.split("\n"));
  }, [children, language]);

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(children);
    setCopyState(ok ? "ok" : "fail");
    setTimeout(() => setCopyState("idle"), 2000);
  };

  const lines = children.split("\n");
  const lineNumDigits = Math.max(1, String(lines.length).length);
  const lineGutterStyle = {
    width: `${lineNumDigits + 0.375}ch`,
    minWidth: `${lineNumDigits + 0.375}ch`,
    maxWidth: `${lineNumDigits + 0.375}ch`,
  } as const;

  return (
    <div
      data-code-theme={theme}
      className={cn(
        "not-prose relative my-4 overflow-hidden rounded-lg border text-[0.875em] leading-relaxed",
        theme === "dark"
          ? "border-[#3c3c3c] bg-[#1e1e1e]"
          : "border-black/[0.08] bg-[#f5f5f7] shadow-sm"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between border-b px-4 py-2",
          theme === "dark"
            ? "border-[#3c3c3c] bg-[#2d2d2d]"
            : "border-black/[0.06] bg-[#f0f0f3]"
        )}
      >
        <span
          className={cn(
            "text-xs font-mono",
            theme === "dark" ? "text-gray-400" : "text-neutral-600"
          )}
        >
          {language ?? "code"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            "cursor-pointer rounded px-2 py-1 text-xs transition-colors",
            theme === "dark"
              ? "text-gray-400 hover:text-gray-200"
              : "text-neutral-600 hover:text-neutral-900"
          )}
        >
          {copyState === "ok"
            ? "已复制!"
            : copyState === "fail"
              ? "复制失败"
              : "复制"}
        </button>
      </div>
      <div
        className={cn(
          "overflow-x-auto px-4 py-3",
          theme === "dark" ? "bg-[#1e1e1e]" : "bg-[#f5f5f7]"
        )}
      >
        <table className="w-full border-collapse border-spacing-0">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i}>
                <td
                  style={lineGutterStyle}
                  className={cn(
                    "select-none px-0 py-0 text-right align-top font-mono text-xs tabular-nums",
                    theme === "dark" ? "text-[#858585]" : "text-neutral-400"
                  )}
                >
                  {i + 1}
                </td>
                <td className="min-w-0 py-0 pl-2 pr-0 align-top font-mono text-sm">
                  <code
                    className="hljs !m-0 block w-full !bg-transparent !p-0"
                    dangerouslySetInnerHTML={{
                      __html:
                        i === lines.length - 1 && line === ""
                          ? "&nbsp;"
                          : (highlighted[i] ?? line),
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
