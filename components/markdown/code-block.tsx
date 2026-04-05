"use client";

import { useState, useEffect } from "react";
import hljs from "highlight.js";

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
    <div className="relative my-4 rounded-lg overflow-hidden bg-[#1e1e1e] border border-border">
      <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-border">
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
      <div className="overflow-x-auto">
        <table className="w-full">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="hover:bg-white/5">
                <td className="select-none text-right text-gray-600 text-xs font-mono px-4 py-0 w-12 min-w-[3rem]">
                  {i + 1}
                </td>
                <td className="font-mono text-sm py-0 pr-4">
                  <code
                    className="hljs"
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
