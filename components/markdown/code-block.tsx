"use client";

import { useState, useEffect } from "react";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css";

interface CodeBlockProps {
  children: string;
  className?: string;
}

export default function CodeBlock({ children, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
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
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = children.split("\n");

  return (
    <div className="not-prose relative my-4 overflow-hidden rounded-md border border-border bg-[#1e1e1e]">
      <div className="flex items-center justify-between border-b border-border bg-[#2d2d2d] px-4 py-2">
        <span className="text-xs text-gray-400 font-mono">
          {language ?? "code"}
        </span>
        <button
          onClick={handleCopy}
          className="text-xs text-gray-400 hover:text-gray-200 transition-colors px-2 py-1 rounded"
        >
          {copied ? "已复制!" : "复制"}
        </button>
      </div>
      <div className="overflow-x-auto px-4 py-3 text-[0.875em] leading-relaxed">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i}>
                <td className="w-12 min-w-[3rem] select-none px-0 py-0 text-right align-top font-mono text-xs text-[#858585]">
                  {i + 1}
                </td>
                <td className="py-0 pl-4 pr-0 align-top font-mono text-sm">
                  <code
                    className="hljs !m-0 block w-full !bg-transparent !p-0 text-[#d4d4d4]"
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
