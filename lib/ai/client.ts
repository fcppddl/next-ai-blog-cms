import OpenAI from "openai";
import { getExpectedEmbeddingDimensions } from "@/lib/vector/embedding-dim";

const DEFAULT_EMBEDDING_BASE_URL =
  "https://dashscope.aliyuncs.com/compatible-mode/v1";

function getEmbeddingApiKey(): string | undefined {
  const k = process.env.EMBEDDING_API_KEY?.trim();
  return k || undefined;
}

function getEmbeddingBaseUrl(): string {
  return process.env.EMBEDDING_BASE_URL?.trim() || DEFAULT_EMBEDDING_BASE_URL;
}

async function createDashscopeEmbedding(
  client: OpenAI,
  model: string,
  dimensions: number,
  input: string,
): Promise<number[]> {
  let retries = 3;
  let lastError: Error | null = null;

  while (retries > 0) {
    try {
      const params: OpenAI.Embeddings.EmbeddingCreateParams = {
        model,
        input,
        encoding_format: "float",
      };
      if (
        model.includes("text-embedding-v3") ||
        model.includes("text-embedding-v4")
      ) {
        params.dimensions = dimensions;
      }

      const response = await client.embeddings.create(params);
      const emb = response.data[0]?.embedding;
      if (!emb || !Array.isArray(emb)) {
        throw new Error("百炼兼容接口返回的 embedding 数据无效");
      }
      return emb;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      retries--;
      if (retries > 0) {
        console.warn(
          `[Embedding] 请求失败，剩余重试 ${retries}，错误: ${lastError.message}`,
        );
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  throw new Error(
    `向量模型调用失败: ${lastError?.message}，请检查 EMBEDDING_API_KEY / EMBEDDING_BASE_URL / EMBEDDING_MODEL`,
  );
}

/** 百炼 OpenAI 兼容 Embeddings（如 text-embedding-v4） */
async function dashscopeCompatibleEmbed(
  text: string | string[],
  model: string,
): Promise<number[][]> {
  const apiKey = getEmbeddingApiKey();
  if (!apiKey) {
    throw new Error("已配置 EMBEDDING_MODEL，请配置 EMBEDDING_API_KEY");
  }

  const client = new OpenAI({
    apiKey,
    baseURL: getEmbeddingBaseUrl(),
  });
  const dimensions = getExpectedEmbeddingDimensions();
  const texts = Array.isArray(text) ? text : [text];
  const embeddings: number[][] = [];

  const MAX_CHUNK_SIZE = 800;
  const chunkOverlap = 50;

  for (const t of texts) {
    if (t.length <= MAX_CHUNK_SIZE) {
      const embedding = await createDashscopeEmbedding(
        client,
        model,
        dimensions,
        t,
      );
      embeddings.push(embedding);
    } else {
      const chunks: string[] = [];
      let start = 0;

      while (start < t.length) {
        const end = Math.min(start + MAX_CHUNK_SIZE, t.length);
        chunks.push(t.slice(start, end));
        start = end - chunkOverlap;
        if (start >= t.length - chunkOverlap) {
          if (end < t.length) chunks.push(t.slice(start));
          break;
        }
      }

      for (const chunk of chunks) {
        const embedding = await createDashscopeEmbedding(
          client,
          model,
          dimensions,
          chunk,
        );
        embeddings.push(embedding);
      }
    }
  }

  return embeddings;
}

export interface AIClient {
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;
  chatStream(
    messages: ChatMessage[],
    options?: ChatOptions,
    onChunk?: (chunk: string) => void,
  ): Promise<ChatResponse>;
  embed(text: string | string[]): Promise<number[][]>;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  response_format?: OpenAI.ChatCompletionCreateParamsNonStreaming["response_format"];
}

export interface ChatResponse {
  content: string;
  tokensUsed?: number;
}

async function getEmbeddingWithRetry(
  baseUrl: string,
  model: string,
  text: string,
  maxRetries: number,
): Promise<number[]> {
  let retries = maxRetries;
  let lastError: Error | null = null;

  while (retries > 0) {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${baseUrl}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt: text }),
        signal: controller.signal,
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Ollama embedding 失败: ${response.statusText} - ${errorText}`,
        );
      }

      const data = await response.json();
      if (!data.embedding || !Array.isArray(data.embedding)) {
        throw new Error("Ollama 返回的 embedding 数据无效");
      }

      return data.embedding;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      retries--;

      if (retries > 0) {
        console.warn(
          `[Ollama] Embedding 失败，剩余重试次数: ${retries}，错误: ${lastError.message}`,
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } finally {
      if (timeoutId !== null) clearTimeout(timeoutId);
    }
  }

  throw new Error(
    `Ollama embedding 失败: ${lastError?.message}，请确保 Ollama 服务已启动`,
  );
}

async function ollamaEmbed(text: string | string[]): Promise<number[][]> {
  const texts = Array.isArray(text) ? text : [text];
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const model = process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text";
  const embeddings: number[][] = [];

  for (const t of texts) {
    const MAX_CHUNK_SIZE = 800;

    if (t.length <= MAX_CHUNK_SIZE) {
      const embedding = await getEmbeddingWithRetry(baseUrl, model, t, 3);
      embeddings.push(embedding);
    } else {
      const chunks: string[] = [];
      const chunkOverlap = 50;
      let start = 0;

      while (start < t.length) {
        const end = Math.min(start + MAX_CHUNK_SIZE, t.length);
        chunks.push(t.slice(start, end));
        start = end - chunkOverlap;
        if (start >= t.length - chunkOverlap) {
          if (end < t.length) chunks.push(t.slice(start));
          break;
        }
      }

      for (const chunk of chunks) {
        const embedding = await getEmbeddingWithRetry(baseUrl, model, chunk, 3);
        embeddings.push(embedding);
      }
    }
  }

  return embeddings;
}

class ChatClient implements AIClient {
  private client: OpenAI;

  constructor() {
    const apiKey = process.env.CHAT_API_KEY;
    if (!apiKey) {
      throw new Error("请配置 CHAT_API_KEY 环境变量");
    }

    if (!process.env.CHAT_BASE_URL) {
      throw new Error("请配置 CHAT_BASE_URL 环境变量");
    }

    if (!process.env.CHAT_MODEL) {
      throw new Error("请配置 CHAT_MODEL 环境变量");
    }

    // 对话补全须用 compatible-mode；compatible-api 为重排序等接口，误用会 404
    this.client = new OpenAI({
      apiKey,
      baseURL: process.env.CHAT_BASE_URL,
    });
  }

  async chat(
    messages: ChatMessage[],
    options: ChatOptions = {},
  ): Promise<ChatResponse> {
    const response = await this.client.chat.completions.create({
      ...options,
      model: options.model || process.env.CHAT_MODEL || "",
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2000,
      enable_thinking: false,
    } as OpenAI.ChatCompletionCreateParamsNonStreaming);

    return {
      content: response.choices[0]?.message?.content || "",
      tokensUsed: response.usage?.total_tokens,
    };
  }

  async chatStream(
    messages: ChatMessage[],
    options: ChatOptions = {},
    onChunk?: (chunk: string) => void,
  ): Promise<ChatResponse> {
    // 阿里云 compatible-mode 支持 enable_search，但 OpenAI SDK 类型未包含该字段，需与流式参数做交集
    const streamBody: OpenAI.ChatCompletionCreateParamsStreaming & {
      enable_search?: boolean;
      enable_thinking?: boolean;
    } = {
      model: options.model || process.env.CHAT_MODEL || "",
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2000,
      stream: true,
      enable_search: true,
      enable_thinking: false,
    };
    const stream = await this.client.chat.completions.create(
      streamBody,
      options.signal ? { signal: options.signal } : undefined,
    );

    let fullContent = "";
    let tokensUsed = 0;

    for await (const chunk of stream) {
      if (options.signal?.aborted) break;

      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        fullContent += content;
        onChunk?.(content);
      }

      if (chunk.usage?.total_tokens) {
        tokensUsed = chunk.usage.total_tokens;
      }
    }

    return { content: fullContent, tokensUsed: tokensUsed || undefined };
  }

  async embed(text: string | string[]): Promise<number[][]> {
    const model = process.env.EMBEDDING_MODEL?.trim();
    if (model) {
      return dashscopeCompatibleEmbed(text, model);
    }
    return ollamaEmbed(text);
  }
}

let aiClientInstance: AIClient | null = null;

export function getAIClient(): AIClient {
  if (!aiClientInstance) {
    aiClientInstance = new ChatClient();
  }
  return aiClientInstance;
}
