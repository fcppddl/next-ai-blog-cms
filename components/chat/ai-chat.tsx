"use client";

import {
  Component,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, FileText, Loader2, SendHorizontal, Square, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type CompanionMode = "articles" | "free";
type MessageRole = "user" | "assistant";

interface MessageSource {
  slug: string;
  title: string;
}

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  isError?: boolean;
  sources?: MessageSource[];
  /** 本轮是否走了向量检索（服务端注入片段） */
  ragEnabled?: boolean;
  /** 模型声明是否依据了站内文章 */
  ragUsed?: boolean;
}

interface ArticleContext {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
}

interface SSEPayload {
  content?: string;
  message?: string;
  sources?: unknown;
  [key: string]: unknown;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "ai-chat-v1";
const MAX_STORED = 20;
const MAX_HISTORY = 10;
const FLUSH_INTERVAL_MS = 30;
const FLUSH_MIN_CHARS = 20;

// ─── Utilities ───────────────────────────────────────────────────────────────

function genId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function slugFromPath(path: string): string | null {
  const m = path.match(/^\/posts\/([^/?#]+)/);
  if (!m?.[1]) return null;
  try { return decodeURIComponent(m[1]); } catch { return m[1]; }
}

// ─── SSE ─────────────────────────────────────────────────────────────────────

function parseSSEBlock(block: string): { event: string; payload: SSEPayload | null } | null {
  const lines = block.replace(/\r/g, "").trim().split("\n");
  if (!lines.length) return null;

  let event = "message";
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("event:")) { event = line.slice(6).trim(); continue; }
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  if (!dataLines.length) return { event, payload: null };
  try {
    return { event, payload: JSON.parse(dataLines.join("\n")) as SSEPayload };
  } catch {
    return { event, payload: { message: dataLines.join("\n") } };
  }
}

async function readSSE(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: string, payload: SSEPayload | null) => void,
) {
  const reader = stream.getReader();
  const dec = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) !== -1) {
      const parsed = parseSSEBlock(buf.slice(0, i));
      buf = buf.slice(i + 2);
      if (parsed) onEvent(parsed.event, parsed.payload);
    }
  }
  if (buf.trim()) {
    const parsed = parseSSEBlock(buf);
    if (parsed) onEvent(parsed.event, parsed.payload);
  }
}

// ─── Markdown ────────────────────────────────────────────────────────────────

class MdBoundary extends Component<{ content: string; children: ReactNode }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  componentDidUpdate(prev: { content: string }) {
    if (prev.content !== this.props.content && this.state.err) this.setState({ err: false });
  }
  render() {
    if (this.state.err) {
      return <p className="whitespace-pre-wrap text-sm leading-relaxed">{this.props.content}</p>;
    }
    return this.props.children;
  }
}

function MsgMarkdown({ content }: { content: string }) {
  return (
    <MdBoundary content={content}>
      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-pre:my-2 prose-code:before:content-none prose-code:after:content-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </MdBoundary>
  );
}

// ─── Hook: article context ───────────────────────────────────────────────────

function useArticleContext(slug: string | null, enabled: boolean): ArticleContext | null {
  const [ctx, setCtx] = useState<ArticleContext | null>(null);

  useEffect(() => {
    if (!enabled || !slug) return;
    let alive = true;

    fetch(`/api/posts/${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((data: {
        post?: {
          slug?: unknown; title?: unknown; excerpt?: unknown; content?: unknown;
          category?: { name?: unknown } | null;
          tags?: Array<{ name?: unknown }>;
        };
      } | null) => {
        if (!alive || !data?.post) return;
        const p = data.post;
        if (typeof p.slug !== "string") return;
        setCtx({
          slug: p.slug,
          title: typeof p.title === "string" && p.title.trim() ? p.title.trim() : slug,
          excerpt: typeof p.excerpt === "string" ? p.excerpt.slice(0, 300) : "",
          content: typeof p.content === "string" ? p.content.slice(0, 2600) : "",
          category: typeof p.category?.name === "string" ? p.category.name : "",
          tags: Array.isArray(p.tags)
            ? p.tags.map((t) => (typeof t?.name === "string" ? t.name : "")).filter(Boolean).slice(0, 6)
            : [],
        });
      })
      .catch(() => { if (alive) setCtx(null); });

    return () => { alive = false; };
  }, [slug, enabled]);

  if (!enabled || !slug) return null;
  return ctx && ctx.slug === slug ? ctx : null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AIChatWidget() {
  const pathname = usePathname();
  const isPublic = !!pathname && !pathname.startsWith("/admin") && pathname !== "/login";
  const postSlug = isPublic ? slugFromPath(pathname) : null;
  const articleCtx = useArticleContext(postSlug, isPublic);
  const articleCtxRef = useRef(articleCtx);
  useEffect(() => { articleCtxRef.current = articleCtx; }, [articleCtx]);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const chunkBufRef = useRef("");
  const flushTimerRef = useRef<number | null>(null);

  /** 避免首帧 messages=[] 在从 localStorage 恢复前把存储覆盖成空 */
  const skipInitialPersist = useRef(true);

  // Persistence：挂载后从 localStorage 恢复（避免 SSR 与客户端首帧不一致）
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { messages?: ChatMessage[] };
      if (Array.isArray(parsed.messages)) {
        setMessages(
          parsed.messages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .slice(-MAX_STORED),
        );
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (skipInitialPersist.current) {
      skipInitialPersist.current = false;
      return;
    }

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ messages: messages.slice(-MAX_STORED) }),
      );
    } catch { /* ignore */ }
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  // Cleanup
  useEffect(() => () => {
    abortRef.current?.abort();
    if (flushTimerRef.current !== null) window.clearTimeout(flushTimerRef.current);
  }, []);

  useEffect(() => { if (!isPublic) setOpen(false); }, [isPublic]);

  // Streaming helpers
  const updateMsg = useCallback((updater: (m: ChatMessage) => ChatMessage) => {
    const id = activeIdRef.current;
    if (!id) return;
    setMessages((prev) => {
      const i = prev.findIndex((m) => m.id === id);
      if (i === -1) return prev;
      const next = updater(prev[i]);
      if (next === prev[i]) return prev;
      const arr = [...prev];
      arr[i] = next;
      return arr;
    });
  }, []);

  const clearFlush = useCallback(() => {
    if (flushTimerRef.current === null) return;
    window.clearTimeout(flushTimerRef.current);
    flushTimerRef.current = null;
  }, []);

  const flushChunk = useCallback(() => {
    clearFlush();
    const buf = chunkBufRef.current;
    if (!buf) return;
    chunkBufRef.current = "";
    updateMsg((m) => ({ ...m, content: m.content + buf }));
  }, [clearFlush, updateMsg]);

  const enqueue = useCallback((chunk: string) => {
    if (!chunk) return;
    chunkBufRef.current += chunk;
    if (chunkBufRef.current.length >= FLUSH_MIN_CHARS) { flushChunk(); return; }
    if (flushTimerRef.current !== null) return;
    flushTimerRef.current = window.setTimeout(() => {
      flushTimerRef.current = null;
      flushChunk();
    }, FLUSH_INTERVAL_MS);
  }, [flushChunk]);

  const resetStream = useCallback(() => {
    clearFlush();
    chunkBufRef.current = "";
    activeIdRef.current = null;
  }, [clearFlush]);

  const stop = () => { abortRef.current?.abort(); abortRef.current = null; setStreaming(false); };

  const clear = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    resetStream();
    setInput("");
    setMessages([]);
  };

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || streaming) return;

    const mode: CompanionMode = postSlug ? "articles" : "free";
    const history = messages.slice(-MAX_HISTORY).map((m) => ({ role: m.role, content: m.content }));
    const articleContext = postSlug ? articleCtxRef.current : null;

    const userId = genId();
    const asstId = genId();
    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content },
      { id: asstId, role: "assistant", content: "" },
    ]);
    activeIdRef.current = asstId;
    chunkBufRef.current = "";
    clearFlush();
    setInput("");
    setStreaming(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/ai/companion/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, message: content, history, articleContext }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(err?.error ?? "AI 助手暂时不可用");
      }

      await readSSE(res.body, (event, payload) => {
        if (event === "chunk") {
          enqueue(typeof payload?.content === "string" ? payload.content : "");
        } else if (event === "done") {
          flushChunk();
          const final = typeof payload?.content === "string" ? payload.content : "";
          const sources = (Array.isArray(payload?.sources) ? payload.sources as unknown[] : [])
            .filter((s): s is MessageSource =>
              !!s && typeof (s as MessageSource).slug === "string" && typeof (s as MessageSource).title === "string",
            );
          const ragEnabled = payload?.ragEnabled === true;
          const ragUsed = payload?.ragUsed === true;
          updateMsg((m) => ({
            ...m,
            content: final || m.content,
            ...(sources.length > 0 ? { sources } : { sources: undefined }),
            ragEnabled,
            ragUsed,
          }));
        } else if (event === "error") {
          throw new Error(typeof payload?.message === "string" ? payload.message : "AI 助手处理失败");
        }
      });
    } catch (err) {
      clearFlush();
      flushChunk();
      const aborted = err instanceof DOMException && err.name === "AbortError";
      if (!aborted) {
        const msg = err instanceof Error ? err.message : "AI 助手处理失败，请稍后重试";
        updateMsg((m) => ({ ...m, content: `抱歉，出错了：${msg}`, isError: true }));
      } else {
        updateMsg((m) => m.content ? m : { ...m, content: "已停止。", isError: true });
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
      resetStream();
    }
  };

  if (!isPublic) return null;

  const quickPrompts = postSlug && articleCtx
    ? [
        { label: "总结文章", prompt: `请总结《${articleCtx.title}》的核心内容，控制在 3 点以内。` },
        { label: "提炼观点", prompt: `请提炼《${articleCtx.title}》最关键的 3 个观点。` },
        { label: "行动建议", prompt: `基于《${articleCtx.title}》，给我 3 条可以马上执行的实践建议。` },
      ]
    : [
        { label: "推荐文章", prompt: "推荐 3 篇适合先看的文章，并说下推荐理由。" },
        { label: "了解作者", prompt: "简单介绍一下作者的技术背景和擅长方向。" },
        { label: "随便聊聊", prompt: "你好，先用一句话介绍你自己。" },
      ];

  return (
    <div className="fixed right-4 bottom-5 z-[70] flex flex-col items-end gap-3">

      {/* Chat panel */}
      {open && (
        <div className="w-[min(92vw,360px)] h-[min(74vh,540px)] flex flex-col rounded-2xl border border-border bg-background shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/30 flex-shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-none text-foreground">AI 助手</p>
                {postSlug && articleCtx && (
                  <p className="mt-0.5 text-[10px] text-indigo-500 leading-none truncate max-w-[180px]">
                    {articleCtx.title}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={clear}
                  disabled={streaming}
                  title="清空对话"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {postSlug && articleCtx
                    ? `正在阅读《${articleCtx.title}》，有什么想问的？`
                    : "有什么想聊的？可以问我关于文章或作者的问题。"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {quickPrompts.map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => void send(q.prompt)}
                      disabled={streaming}
                      className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-muted transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}
              >
                {msg.role === "assistant" && (
                  <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-violet-600">
                    <Bot className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted text-foreground rounded-tl-sm border border-border/50",
                    msg.isError && "bg-destructive/10 border-destructive/30 text-destructive",
                  )}
                >
                  {msg.role === "assistant" ? (
                    streaming && msg.id === activeIdRef.current && !msg.content ? (
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        思考中…
                      </span>
                    ) : (
                      <>
                        <MsgMarkdown content={msg.content} />
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-border/40">
                            <p className="text-[10px] text-muted-foreground mb-1.5 flex flex-wrap items-center gap-1.5">
                              <span>参考来源</span>
                              {msg.ragEnabled && (
                                <span className="rounded bg-muted px-1.5 py-px text-[9px] font-medium">检索</span>
                              )}
                              {msg.ragUsed && (
                                <span className="rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 px-1.5 py-px text-[9px] font-medium">
                                  模型引用
                                </span>
                              )}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {msg.sources.map((s) => (
                                <Link
                                  key={s.slug}
                                  href={`/posts/${s.slug}`}
                                  target="_blank"
                                  className="inline-flex items-center gap-1 rounded border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer max-w-[140px]"
                                >
                                  <FileText className="h-2.5 w-2.5 flex-shrink-0" />
                                  <span className="truncate">{s.title}</span>
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )
                  ) : (
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="flex-shrink-0 border-t border-border px-3 py-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-500/50 transition-all">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
                }}
                placeholder="输入问题，回车发送"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {streaming ? (
                <button
                  type="button"
                  onClick={stop}
                  title="停止"
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-muted hover:bg-accent transition-colors cursor-pointer"
                >
                  <Square className="h-3 w-3 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={!input.trim()}
                  title="发送"
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <SendHorizontal className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="group relative cursor-pointer"
        aria-label={open ? "收起 AI 助手" : "打开 AI 助手"}
      >
        <span className="absolute -inset-2 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 opacity-30 blur-md transition-all duration-300 group-hover:opacity-60 group-hover:blur-xl group-hover:-inset-3" />
        <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-700 shadow-lg ring-1 ring-white/15 transition-transform duration-200 group-hover:scale-105">
          <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.12),transparent_60%)]" />
          {open
            ? <X className="relative h-5 w-5 text-white/90" />
            : <Bot className="relative h-6 w-6 text-white" />
          }
          {streaming && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-violet-400 ring-2 ring-background">
              <Loader2 className="h-2.5 w-2.5 animate-spin text-white" />
            </span>
          )}
        </span>
      </button>
    </div>
  );
}
