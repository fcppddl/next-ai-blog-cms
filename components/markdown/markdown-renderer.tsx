"use client";

import {
  useState,
  useEffect,
  useMemo,
  useRef,
  type FC,
  type ReactNode,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { List, ChevronRight, ChevronLeft, X } from "lucide-react";
import Mermaid from "./mermaid";
import CodeBlock from "./code-block";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface MarkdownRendererProps {
  content: string | undefined;
  showToc?: boolean;
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

function generateStableUniqueId(text: string, index: number): string {
  const baseId = text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, "")
    .replace(/\s+/g, "-");
  const hash = text.split("").reduce((acc, char) => {
    acc = (acc << 5) - acc + char.charCodeAt(0);
    return acc & acc;
  }, 0);
  return `${baseId || "heading"}-${Math.abs(hash).toString(36)}-${index}`;
}

function extractTextFromNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractTextFromNode).join("");
  if (node && typeof node === "object" && "props" in node) {
    const withProps = node as { props?: { children?: ReactNode } };
    return extractTextFromNode(withProps.props?.children ?? "");
  }
  return "";
}

function getNodeStartOffset(node: unknown): number | null {
  if (!node || typeof node !== "object") return null;
  const withPosition = node as {
    position?: { start?: { offset?: number } };
  };
  const offset = withPosition.position?.start?.offset;
  return typeof offset === "number" ? offset : null;
}

function hashCode(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export default function MarkdownRenderer({
  content,
  showToc = true,
}: MarkdownRendererProps) {
  const safeContent = content || "";
  const [activeHeading, setActiveHeading] = useState<string>("");
  const [tocOpen, setTocOpen] = useState(false);
  const [desktopTocCollapsed, setDesktopTocCollapsed] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const { toc, headingIdMap } = useMemo(() => {
    const codeBlockRegex = /```[\s\S]*?```/g;
    let contentWithoutCodeBlocks = safeContent.replace(codeBlockRegex, (m) =>
      m.replace(/[^\n]/g, " ")
    );
    const inlineCodeRegex = /`[^`]*`/g;
    contentWithoutCodeBlocks = contentWithoutCodeBlocks.replace(
      inlineCodeRegex,
      (m) => m.replace(/[^\n]/g, " ")
    );
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const headings: TocItem[] = [];
    const idMap = new Map<number, string>();
    let match;
    while ((match = headingRegex.exec(contentWithoutCodeBlocks)) !== null) {
      const level = match[1].length;
      const text = match[2].trim();
      const offset = match.index;
      const id = generateStableUniqueId(text, offset);
      headings.push({ id, text, level });
      idMap.set(offset, id);
    }
    return { toc: headings, headingIdMap: idMap };
  }, [safeContent]);

  useEffect(() => {
    let isTicking = false;
    const updateScrollState = () => {
      const headings =
        contentRef.current?.querySelectorAll<HTMLElement>(
          "h1, h2, h3, h4, h5, h6"
        ) ?? [];
      const scrollTop = window.scrollY + 100;
      const documentHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const progress =
        documentHeight <= 0
          ? 100
          : Math.min(100, Math.max(0, (window.scrollY / documentHeight) * 100));
      setReadingProgress(progress);
      let currentHeading = "";
      for (let i = headings.length - 1; i >= 0; i--) {
        if (headings[i].offsetTop <= scrollTop) {
          currentHeading = headings[i].id;
          break;
        }
      }
      setActiveHeading(currentHeading);
    };
    const scheduleUpdate = () => {
      if (isTicking) return;
      isTicking = true;
      window.requestAnimationFrame(() => {
        updateScrollState();
        isTicking = false;
      });
    };
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    updateScrollState();
    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [safeContent]);

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setTocOpen(false);
    }
  };

  const markdownComponents = useMemo<Components>(() => {
    const resolveHeadingId = (children: ReactNode, node: unknown): string => {
      const headingText = extractTextFromNode(children).trim();
      const offset = getNodeStartOffset(node);
      return (
        (offset !== null ? headingIdMap.get(offset) : undefined) ||
        generateStableUniqueId(headingText || "heading", offset ?? 0)
      );
    };

    const createHeading = (
      tag: HeadingTag
    ): FC<React.HTMLAttributes<HTMLHeadingElement> & { children?: ReactNode }> => {
      const HeadingComponent: FC<
        React.HTMLAttributes<HTMLHeadingElement> & {
          children?: ReactNode;
          node?: unknown;
        }
      > = ({ children, node, ...props }) => {
        const Tag = tag;
        return (
          <Tag id={resolveHeadingId(children, node)} className="scroll-mt-20" {...props}>
            {children}
          </Tag>
        );
      };
      HeadingComponent.displayName = `Markdown${tag.toUpperCase()}`;
      return HeadingComponent;
    };

    return {
      h1: createHeading("h1"),
      h2: createHeading("h2"),
      h3: createHeading("h3"),
      h4: createHeading("h4"),
      h5: createHeading("h5"),
      h6: createHeading("h6"),
      code: ({ className, children, ...props }) => {
        const rawCode = String(children ?? "");
        const code = rawCode.replace(/\n$/, "");
        const match = /language-(\w+)/.exec(className || "");
        const language = match ? match[1] : "text";
        const hasLanguageClass = /^language-/.test(className || "");
        const isCodeBlock = hasLanguageClass || rawCode.includes("\n");

        if (!isCodeBlock) {
          return (
            <code
              className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground"
              {...props}
            >
              {children}
            </code>
          );
        }

        if (language === "mermaid") {
          return <Mermaid chart={code} id={`mermaid-${hashCode(code)}`} />;
        }

        return (
          <CodeBlock className={className || "language-text"}>{code}</CodeBlock>
        );
      },
      a: ({ children, href, ...props }) => {
        const isExternal =
          typeof href === "string" && /^(https?:)?\/\//.test(href);
        return (
          <a
            className="font-semibold text-primary underline decoration-2 underline-offset-4 transition-all hover:text-primary/80"
            href={href}
            target={isExternal ? "_blank" : undefined}
            rel={isExternal ? "noopener noreferrer" : undefined}
            {...props}
          >
            {children}
          </a>
        );
      },
      table: ({ children, ...props }) => (
        <div className="overflow-x-auto my-8">
          <table className="min-w-full border border-border" {...props}>
            {children}
          </table>
        </div>
      ),
      th: ({ children, ...props }) => (
        <th
          className="border border-border bg-muted px-4 py-2 text-left font-bold text-foreground"
          {...props}
        >
          {children}
        </th>
      ),
      td: ({ children, ...props }) => (
        <td
          className="border border-border px-4 py-2 text-foreground"
          {...props}
        >
          {children}
        </td>
      ),
      blockquote: ({ children, ...props }) => (
        <blockquote
          className="my-8 border-l-[4px] border-primary/50 bg-muted/40 py-4 pl-6 font-serif italic text-muted-foreground"
          {...props}
        >
          {children}
        </blockquote>
      ),
      img: ({ src, alt, ...props }) => {
        const imageSrc = typeof src === "string" ? src : "";
        const imageAlt = typeof alt === "string" ? alt : "";
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc}
            alt={imageAlt}
            className="mx-auto my-12 max-w-full cursor-pointer rounded-lg border border-border shadow-sm transition-opacity hover:opacity-90"
            onClick={() => { if (imageSrc) setLightboxImage(imageSrc); }}
            {...props}
          />
        );
      },
    };
  }, [headingIdMap]);

  return (
    <>
      <Dialog open={lightboxImage !== null} onOpenChange={() => setLightboxImage(null)}>
        <DialogContent
          className="max-w-[95vw] max-h-[95vh] p-0 bg-transparent border-none shadow-none"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={() => setLightboxImage(null)}
        >
          <DialogTitle className="sr-only">图片预览</DialogTitle>
          <div className="relative flex items-center justify-center w-full h-full">
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute -top-12 right-0 p-2 text-white hover:text-gray-200 transition-colors"
              aria-label="关闭"
            >
              <X className="w-6 h-6" />
            </button>
            {lightboxImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lightboxImage}
                alt="放大图片"
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="fixed top-0 left-0 z-50 h-1 w-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-150 ease-out"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      <div className="flex gap-20 min-w-0">
        <div className="flex-1 min-w-0 overflow-x-hidden">
          {showToc && toc.length > 0 && (
            <div className="mb-6 xl:hidden">
              <button
                onClick={() => setTocOpen(!tocOpen)}
                className="inline-flex items-center space-x-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                <List className="w-4 h-4" />
                <span>目录</span>
                <ChevronRight
                  className={`w-4 h-4 transition-transform ${tocOpen ? "rotate-90" : ""}`}
                />
              </button>
              {tocOpen && (
                <div className="mt-4 max-h-80 overflow-y-auto rounded-lg border border-border bg-card">
                  <nav className="space-y-1 p-3">
                    {toc.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => scrollToHeading(item.id)}
                        className={`block w-full truncate rounded py-2 px-3 text-left text-sm transition-all ${
                          activeHeading === item.id
                            ? "bg-primary/15 font-semibold text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                        style={{ paddingLeft: `${(item.level - 1) * 12 + 12}px` }}
                        title={item.text}
                      >
                        {item.text}
                      </button>
                    ))}
                  </nav>
                </div>
              )}
            </div>
          )}

          <div
            ref={contentRef}
            className="prose prose-gray w-full min-w-0 max-w-full overflow-x-hidden break-words font-sans dark:prose-invert
              prose-headings:font-sans prose-headings:font-bold prose-headings:text-foreground
              prose-h1:mt-10 prose-h1:mb-6 prose-h1:border-b prose-h1:border-border prose-h1:pb-3 prose-h1:text-3xl
              prose-h2:mt-10 prose-h2:mb-5 prose-h2:border-l-4 prose-h2:border-primary/40 prose-h2:pl-4 prose-h2:text-2xl
              prose-h3:mt-8 prose-h3:mb-4 prose-h3:text-xl
              prose-p:mb-6 prose-p:leading-[1.7] prose-p:text-foreground
              prose-li:mb-2 prose-li:text-foreground
              prose-strong:font-bold prose-strong:text-foreground
              prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:font-mono prose-code:text-[0.9em] prose-code:text-foreground prose-code:before:content-none prose-code:after:content-none
              prose-pre:my-8 prose-pre:bg-transparent prose-pre:p-0
              prose-a:font-semibold prose-a:text-primary prose-a:underline prose-a:underline-offset-4
              [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto
            "
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {safeContent}
            </ReactMarkdown>
          </div>
        </div>

        {showToc && toc.length > 0 && (
          <div
            className={`hidden xl:block flex-shrink-0 transition-all duration-300 ${
              desktopTocCollapsed ? "w-12" : "w-64"
            }`}
          >
            <div className="sticky top-24 max-h-[calc(100vh-6rem)]">
              <div className="flex items-center justify-between mb-6">
                {!desktopTocCollapsed && (
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Table of Contents
                  </h4>
                )}
                <button
                  type="button"
                  onClick={() => setDesktopTocCollapsed(!desktopTocCollapsed)}
                  className="rounded-lg border border-border p-2 text-foreground transition-all hover:bg-muted"
                  title={desktopTocCollapsed ? "展开目录" : "折叠目录"}
                >
                  {desktopTocCollapsed ? (
                    <ChevronRight className="w-4 h-4" />
                  ) : (
                    <ChevronLeft className="w-4 h-4" />
                  )}
                </button>
              </div>
              {!desktopTocCollapsed && (
                <div className="overflow-y-auto max-h-[calc(100vh-12rem)] pr-4">
                  <nav className="space-y-1">
                    {toc.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => scrollToHeading(item.id)}
                        className={`block w-full truncate border-l-4 py-2 px-3 text-left text-sm transition-all ${
                          activeHeading === item.id
                            ? "border-primary bg-primary/10 font-semibold text-primary"
                            : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                        style={{ paddingLeft: `${(item.level - 1) * 12 + 12}px` }}
                        title={item.text}
                      >
                        {item.text}
                      </button>
                    ))}
                  </nav>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
