import { NextRequest, NextResponse } from "next/server";
import { getAIClient, type ChatMessage } from "@/lib/ai/client";
import { ContextManager } from "@/lib/chat/context";
import {
  ASSISTANT_RAG_META_MARKER,
  buildCurrentArticleBodyOnlySystemPrompt,
  buildChitChatSystemPrompt,
  buildPublishedArticleCatalogSystemPrompt,
  buildRAGOnlySystemPrompt,
  getAuthorSummary,
  getPublicArticleMeta,
  parseAssistantRagMeta,
  visibleFinalPrefixLen,
  visibleStreamingPrefixLen,
  type RetrievedChunk,
} from "@/lib/ai/companion";
import { classifyCompanionKnowledgeIntent } from "@/lib/ai/knowledge-route";
import {
  isKnowledgeRouteHint,
  type KnowledgeRouteHint,
} from "@/lib/ai/knowledge-route-hint";
import type { Message } from "@/types/chat";
import {
  rerankWithQwen3Rerank,
  getRagVectorRecallLimit,
} from "@/lib/ai/rerank";
import { getVectorStore } from "@/lib/vector/store";
import { getResolvedCompanionSystemPersona } from "@/lib/ai/companion-settings";

const MAX_CONTEXT_TOKENS = parseInt(
  process.env.COMPANION_MAX_CONTEXT_TOKENS || "8192",
  10,
);
const MAX_HISTORY_ITEMS = 120;
const MAX_HISTORY_MESSAGE_LENGTH = 1200;
const MAX_SUMMARY_LENGTH = 16000;

interface CompanionArticleContext {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
}

const MAX_USER_MESSAGE_LENGTH = 2000;
const STREAM_CHUNK_FLUSH_INTERVAL_MS = 45;
const STREAM_CHUNK_FLUSH_MIN_CHARS = 48;
const RAG_TOP_K = parseInt(process.env.RAG_TOP_K || "3", 10);

function normalizeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizeHistory(value: unknown): Message[] {
  if (!Array.isArray(value)) return [];

  const normalized: Message[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: unknown }).role;
    if (role !== "user" && role !== "assistant") continue;
    const content = normalizeText(
      (item as { content?: unknown }).content,
      MAX_HISTORY_MESSAGE_LENGTH,
    );
    if (!content) continue;
    const summaryRaw = (item as { summary?: unknown }).summary;
    const summary =
      typeof summaryRaw === "string"
        ? summaryRaw.trim().slice(0, MAX_SUMMARY_LENGTH)
        : undefined;
    const id = (item as { id?: unknown }).id;
    normalized.push({
      role,
      content,
      ...(summary ? { summary } : {}),
      ...(typeof id === "string" ? { id } : {}),
    });
  }
  return normalized.slice(-MAX_HISTORY_ITEMS);
}

function normalizeArticleContext(
  value: unknown,
): CompanionArticleContext | null {
  if (!value || typeof value !== "object") return null;

  const context = value as {
    slug?: unknown;
    title?: unknown;
    excerpt?: unknown;
    content?: unknown;
    category?: unknown;
    tags?: unknown;
  };

  const slug = normalizeText(context.slug, 120);
  const title = normalizeText(context.title, 160);
  if (!slug || !title) return null;

  const tags = Array.isArray(context.tags)
    ? context.tags
        .map((item) =>
          typeof item === "string" ? item.trim().slice(0, 30) : "",
        )
        .filter(Boolean)
        .slice(0, 8)
    : [];

  return {
    slug,
    title,
    excerpt: normalizeText(context.excerpt, 400),
    content: normalizeText(context.content, 3200),
    category: normalizeText(context.category, 50),
    tags,
  };
}

function formatSSEEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || "请求失败，请稍后重试";
  return "请求失败，请稍后重试";
}

// 尝试向量检索，失败则返回 null（降级）
async function tryVectorSearch(
  query: string,
  aiClient: ReturnType<typeof getAIClient>,
  signal?: AbortSignal,
): Promise<RetrievedChunk[] | null> {
  try {
    const embeddings = await aiClient.embed(query);
    if (!embeddings.length || !embeddings[0].length) return null;

    const vectorStore = getVectorStore();
    const recallLimit = getRagVectorRecallLimit(RAG_TOP_K);
    const results = await vectorStore.search(embeddings[0], {
      limit: recallLimit,
    });
    // console.log("results", results);

    if (!results.length) return null;

    const chunks: RetrievedChunk[] = results.map((r) => ({
      id: r.id,
      document: r.document || "",
      score: r.score,
      metadata: {
        postId:
          typeof r.metadata.postId === "string" ? r.metadata.postId : undefined,
        title:
          typeof r.metadata.title === "string" ? r.metadata.title : undefined,
        slug: typeof r.metadata.slug === "string" ? r.metadata.slug : undefined,
        category:
          typeof r.metadata.category === "string"
            ? r.metadata.category
            : undefined,
        tags: typeof r.metadata.tags === "string" ? r.metadata.tags : undefined,
        chunkIndex:
          typeof r.metadata.chunkIndex === "number"
            ? r.metadata.chunkIndex
            : undefined,
      },
    }));

    const reranked = await rerankWithQwen3Rerank({
      query,
      chunks,
      topN: RAG_TOP_K,
      signal,
    });
    // console.log("reranked", reranked);

    if (reranked && reranked.length > 0) {
      return reranked;
    }

    return chunks.slice(0, RAG_TOP_K);
  } catch (error) {
    console.warn(
      "[RAG] 向量检索失败，降级到元信息模式:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }

  const message = normalizeText(
    (body as { message?: unknown })?.message,
    MAX_USER_MESSAGE_LENGTH,
  );
  const history = normalizeHistory((body as { history?: unknown })?.history);
  const articleContext = normalizeArticleContext(
    (body as { articleContext?: unknown })?.articleContext,
  );
  const knowledgeFromQuick =
    (body as { knowledgeFromQuick?: unknown })?.knowledgeFromQuick === true;

  const rawRouteHint = (body as { knowledgeRouteHint?: unknown })
    .knowledgeRouteHint;
  let knowledgeRouteHint: KnowledgeRouteHint = isKnowledgeRouteHint(
    rawRouteHint,
  )
    ? rawRouteHint
    : "auto";
  if (knowledgeRouteHint === "current_page" && !articleContext) {
    knowledgeRouteHint = "auto";
  }

  if (!message) {
    return NextResponse.json({ error: "message 不能为空" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let bufferedChunk = "";
      let chunkFlushTimer: ReturnType<typeof setTimeout> | null = null;

      const clearChunkFlushTimer = () => {
        if (chunkFlushTimer === null) return;
        clearTimeout(chunkFlushTimer);
        chunkFlushTimer = null;
      };

      const close = () => {
        clearChunkFlushTimer();
        if (!closed) {
          closed = true;
          controller.close();
        }
      };

      const sendEvent = (event: string, data: unknown) => {
        if (closed || request.signal.aborted) return;
        controller.enqueue(encoder.encode(formatSSEEvent(event, data)));
      };

      const flushBufferedChunk = () => {
        clearChunkFlushTimer();
        if (!bufferedChunk) return;
        sendEvent("chunk", { content: bufferedChunk });
        bufferedChunk = "";
      };

      const scheduleChunkFlush = () => {
        if (chunkFlushTimer !== null || closed || request.signal.aborted)
          return;
        chunkFlushTimer = setTimeout(() => {
          chunkFlushTimer = null;
          flushBufferedChunk();
        }, STREAM_CHUNK_FLUSH_INTERVAL_MS);
      };

      const handleAbort = () => close();
      request.signal.addEventListener("abort", handleAbort);

      try {
        sendEvent("start", { startedAt: new Date().toISOString() });

        const aiClient = getAIClient();

        const onArticlePage = Boolean(articleContext);
        const isQuick = knowledgeFromQuick === true;

        type Scenario =
          | "HOME_QUICK_RECOMMEND"
          | "HOME_QUICK_OTHER"
          | "HOME_TYPED_CHIT"
          | "HOME_TYPED_RAG"
          | "POST_QUICK"
          | "POST_TYPED_CHIT"
          | "POST_TYPED_RAG";

        function resolveScenario(input: {
          onArticlePage: boolean;
          isQuick: boolean;
          knowledgeRouteHint: KnowledgeRouteHint;
          intent: "chit_chat" | "article_qa" | null;
        }): Scenario {
          const { onArticlePage, isQuick, knowledgeRouteHint, intent } = input;
          if (!onArticlePage) {
            if (isQuick) {
              return knowledgeRouteHint === "site_articles"
                ? "HOME_QUICK_RECOMMEND"
                : "HOME_QUICK_OTHER";
            }
            return intent === "chit_chat" ? "HOME_TYPED_CHIT" : "HOME_TYPED_RAG";
          }
          if (isQuick) return "POST_QUICK";
          return intent === "chit_chat" ? "POST_TYPED_CHIT" : "POST_TYPED_RAG";
        }

        // 只有「非快捷」才进行知识路由
        let intentFromLlm: "chit_chat" | "article_qa" | null = null;
        if (!isQuick) {
          intentFromLlm = await classifyCompanionKnowledgeIntent(
            message,
            aiClient,
            { signal: request.signal },
          );
        }

        const scenario = resolveScenario({
          onArticlePage,
          isQuick,
          knowledgeRouteHint,
          intent: intentFromLlm,
        });

        const needAuthor =
          scenario === "HOME_QUICK_OTHER" ||
          scenario === "HOME_TYPED_CHIT" ||
          scenario === "POST_TYPED_CHIT";
        const needPublishedCatalog = scenario === "HOME_QUICK_RECOMMEND";
        const needRag = scenario === "HOME_TYPED_RAG" || scenario === "POST_TYPED_RAG";

        const [author, publishedArticles, systemPersona] = await Promise.all([
          needAuthor ? getAuthorSummary() : Promise.resolve(null),
          needPublishedCatalog ? getPublicArticleMeta() : Promise.resolve([]),
          getResolvedCompanionSystemPersona(),
        ]);

        const ragChunks = needRag
          ? await tryVectorSearch(message, aiClient, request.signal)
          : null;
        const usingRAG = needRag && ragChunks !== null && ragChunks.length > 0;

        sendEvent("context", {
          scenario,
          onArticlePage,
          knowledgeFromQuick,
          knowledgeRouteHint,
          llmIntent: intentFromLlm,
          author: author?.displayName ?? undefined,
          publishedArticleCount: needPublishedCatalog ? publishedArticles.length : 0,
          ragEnabled: usingRAG,
          ragChunkCount: ragChunks?.length ?? 0,
        });

        let systemPrompt: string;
        if (scenario === "HOME_QUICK_RECOMMEND") {
          systemPrompt = buildPublishedArticleCatalogSystemPrompt({
            articles: publishedArticles,
            systemPersona,
          });
        } else if (scenario === "HOME_QUICK_OTHER") {
          systemPrompt = buildChitChatSystemPrompt({
            author: author!,
            systemPersona,
          });
        } else if (scenario === "HOME_TYPED_CHIT") {
          systemPrompt = buildChitChatSystemPrompt({
            author: author!,
            systemPersona,
          });
        } else if (scenario === "HOME_TYPED_RAG") {
          systemPrompt = buildRAGOnlySystemPrompt({
            chunks: ragChunks ?? [],
            systemPersona,
          });
        } else if (scenario === "POST_QUICK") {
          systemPrompt = buildCurrentArticleBodyOnlySystemPrompt({
            systemPersona,
            articleTitle: articleContext?.title ?? "未知",
            articleSlug: articleContext?.slug ?? "",
            articleBody: articleContext?.content ?? "",
          });
        } else if (scenario === "POST_TYPED_CHIT") {
          systemPrompt = buildChitChatSystemPrompt({
            author: author!,
            systemPersona,
          });
          systemPrompt += `\n\n【当前文章正文】\n${articleContext?.content || "（正文为空）"}`;
        } else {
          // POST_TYPED_RAG
          systemPrompt = buildRAGOnlySystemPrompt({
            chunks: ragChunks ?? [],
            systemPersona,
          });
        }

        /** 上下文：主 systemPrompt（人设+RAG 等）→ 若有 summary 锚点则注入第二条 system（摘要）→ 仅「锚点之后」的 history + 本轮 user；再按 token 裁剪近期段。 */
        const contextManager = new ContextManager({
          maxTokens: MAX_CONTEXT_TOKENS,
        });
        const messages: ChatMessage[] = contextManager.prepareForRequest(
          systemPrompt,
          history,
          message,
        );
        console.log("messages", messages);

        let streamedContent = "";
        let lastVisibleSentLen = 0;
        // console.log("systemPrompt", message, systemPrompt);

        const response = await aiClient.chatStream(
          messages,
          {
            temperature: 0.7,
            maxTokens: 1100,
            signal: request.signal,
          },
          (chunk) => {
            streamedContent += chunk;
            const visEnd = visibleStreamingPrefixLen(
              streamedContent,
              ASSISTANT_RAG_META_MARKER,
            );
            const visible = streamedContent.slice(0, visEnd);
            const delta = visible.slice(lastVisibleSentLen);
            lastVisibleSentLen = visible.length;
            if (!delta) return;
            bufferedChunk += delta;

            if (bufferedChunk.length >= STREAM_CHUNK_FLUSH_MIN_CHARS) {
              flushBufferedChunk();
              return;
            }
            scheduleChunkFlush();
          },
        );
        console.log("streamedContent", streamedContent);

        const finalVisEnd = visibleFinalPrefixLen(
          streamedContent,
          ASSISTANT_RAG_META_MARKER,
        );
        const finalVisible = streamedContent.slice(0, finalVisEnd);
        const tailDelta = finalVisible.slice(lastVisibleSentLen);
        lastVisibleSentLen = finalVisible.length;
        if (tailDelta) bufferedChunk += tailDelta;
        flushBufferedChunk();

        const rawFull = (response.content || streamedContent).trimEnd();
        const parsed = parseAssistantRagMeta(rawFull);

        const serverFallbackSources =
          usingRAG && ragChunks
            ? Array.from(
                ragChunks.reduce((map, chunk) => {
                  const slug = chunk.metadata.slug;
                  if (slug && !map.has(slug)) {
                    map.set(slug, {
                      slug,
                      title: chunk.metadata.title || slug,
                    });
                  }
                  return map;
                }, new Map<string, { slug: string; title: string }>()),
              ).map(([, v]) => v)
            : [];

        // 解析成功时完全信任模型：ragUsed 为 false 则不展示参考列表；不为 articles 使用向量兜底。
        // 仅当 __RAG_META__ 解析失败（parseOk 为 false）时，才用检索结果作为兜底列表。
        let sources: Array<{ slug: string; title: string }> = [];
        if (parsed.parseOk) {
          if (parsed.ragUsed && parsed.articles.length > 0) {
            sources = parsed.articles;
          }
        } else if (serverFallbackSources.length > 0) {
          sources = serverFallbackSources;
        }

        const displayContent = parsed.displayText;

        const ragUsedOut = parsed.parseOk ? parsed.ragUsed : false;

        sendEvent("done", {
          content: displayContent,
          tokensUsed: response.tokensUsed,
          finishedAt: new Date().toISOString(),
          ragEnabled: usingRAG,
          ragUsed: ragUsedOut,
          sources,
        });
      } catch (error) {
        if (!request.signal.aborted) {
          flushBufferedChunk();
          console.error("AI 对话流式对话失败:", error);
          sendEvent("error", { message: getErrorMessage(error) });
        }
      } finally {
        request.signal.removeEventListener("abort", handleAbort);
        close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
