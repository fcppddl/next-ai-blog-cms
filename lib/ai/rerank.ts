import OpenAI from "openai";
import type { RetrievedChunk } from "@/lib/ai/companion";
import { getResolvedRagRerankScoreThreshold } from "@/lib/ai/companion-settings";

/**
 * 重排序 OpenAI 兼容接口在 **compatible-api**（与 chat 的 compatible-mode 不同）。
 * 文档：POST .../compatible-api/v1/reranks
 */
const DEFAULT_RAG_RERANK_BASE_URL =
  "https://dashscope.aliyuncs.com/compatible-api/v1";
const DEFAULT_RAG_RERANK_MODEL = "qwen3-rerank";

let dashscopeClientCache: {
  apiKey: string;
  baseURL: string;
  client: OpenAI;
} | null = null;

function getDashscopeRerankClient(apiKey: string): OpenAI {
  const baseURL =
    process.env.RAG_RERANK_BASE_URL?.trim() || DEFAULT_RAG_RERANK_BASE_URL;
  if (
    dashscopeClientCache &&
    dashscopeClientCache.apiKey === apiKey &&
    dashscopeClientCache.baseURL === baseURL
  ) {
    return dashscopeClientCache.client;
  }
  const client = new OpenAI({
    apiKey,
    baseURL,
    maxRetries: 1,
  });
  dashscopeClientCache = { apiKey, baseURL, client };
  return client;
}

/** 向量库多召回条数：仅在已配置 RAG_RERANK_API_KEY 且未禁用 rerank 时大于 finalTopK */
export function getRagVectorRecallLimit(finalTopK: number): number {
  const apiKey = process.env.RAG_RERANK_API_KEY?.trim();
  if (!apiKey || process.env.RAG_RERANK_DISABLED === "true") {
    return finalTopK;
  }
  const raw = parseInt(process.env.RAG_RERANK_RECALL_K || "10", 10);
  const n = Number.isFinite(raw) ? raw : 10;
  return Math.max(finalTopK, Math.min(n, 500));
}

/** 单条文档约 4000 token 上限的保守字符截断（中文为主） */
const RERANK_DOC_MAX_CHARS = 8000;

const DEFAULT_RERANK_INSTRUCT =
  "Given a web search query, retrieve relevant passages that answer the query.";

function truncateDoc(text: string): string {
  const t = text.trim();
  if (!t) return "(空片段)";
  return t.length <= RERANK_DOC_MAX_CHARS
    ? t
    : t.slice(0, RERANK_DOC_MAX_CHARS);
}

function parseRerankResults(data: unknown): Array<{
  index: number;
  relevance_score: number;
}> | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;
  if (typeof root.code === "string" && root.code && root.code !== "") {
    return null;
  }
  let results: unknown;
  if (root.output && typeof root.output === "object") {
    results = (root.output as Record<string, unknown>).results;
  } else {
    results = root.results;
  }
  if (!Array.isArray(results) || results.length === 0) return null;

  const out: Array<{ index: number; relevance_score: number }> = [];
  for (const item of results) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const index =
      typeof o.index === "number" && Number.isFinite(o.index) ? o.index : -1;
    const score =
      typeof o.relevance_score === "number"
        ? o.relevance_score
        : typeof o.score === "number"
          ? o.score
          : NaN;
    if (index < 0 || !Number.isFinite(score)) continue;
    out.push({ index, relevance_score: score });
  }
  return out.length ? out : null;
}

/**
 * 使用阿里云百炼 qwen3-rerank 对召回片段重排序（OpenAI 兼容 SDK → POST /reranks）。
 * 需配置 RAG_RERANK_API_KEY；可设 RAG_RERANK_DISABLED=true 关闭。
 */
export async function rerankWithQwen3Rerank(params: {
  query: string;
  chunks: RetrievedChunk[];
  topN: number;
  signal?: AbortSignal;
}): Promise<RetrievedChunk[] | null> {
  const { query, chunks, topN, signal } = params;
  const apiKey = process.env.RAG_RERANK_API_KEY?.trim();

  if (!apiKey || process.env.RAG_RERANK_DISABLED === "true") {
    return null;
  }
  if (!query.trim() || chunks.length === 0 || topN < 1) {
    return null;
  }

  const model =
    process.env.RAG_RERANK_MODEL?.trim() || DEFAULT_RAG_RERANK_MODEL;
  const instruct = DEFAULT_RERANK_INSTRUCT;

  const documents = chunks.map((c) => truncateDoc(c.document));
  const body = {
    model,
    query: query.trim().slice(0, 12000),
    documents,
    top_n: Math.min(topN, documents.length),
    instruct,
  };

  try {
    const client = getDashscopeRerankClient(apiKey);
    const data = (await client.post("/reranks", {
      body,
      signal,
    })) as unknown;

    const parsed = parseRerankResults(data);
    if (!parsed) {
      console.warn("[RAG] qwen3-rerank 响应无法解析");
      return null;
    }

    const scoreThreshold = await getResolvedRagRerankScoreThreshold();

    const reranked: RetrievedChunk[] = [];
    for (const row of parsed) {
      const chunk = chunks[row.index];
      if (!chunk) continue;
      const score = row.relevance_score;
      if (!Number.isFinite(score) || score < scoreThreshold) {
        continue;
      }
      reranked.push({ ...chunk, score });
      if (reranked.length >= topN) break;
    }

    return reranked.length > 0 ? reranked : null;
  } catch (e) {
    if (signal?.aborted) return null;
    const msg =
      e instanceof OpenAI.APIError
        ? `${e.status} ${e.message}`
        : e instanceof Error
          ? e.message
          : String(e);
    console.warn("[RAG] qwen3-rerank 调用失败:", msg);
    return null;
  }
}
