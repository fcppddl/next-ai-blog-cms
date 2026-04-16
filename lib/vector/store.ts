import { ChromaClient, Collection, type EmbeddingFunction } from "chromadb";
import { getExpectedEmbeddingDimensions } from "@/lib/vector/embedding-dim";

/**
 * 占位嵌入函数：向量在应用内（Ollama 等）计算后传入 upsert/query。
 * 使用普通对象序列化为 Chroma 的 legacy 配置，且满足 `embeddingFunction ?? getEmbeddingFunction()` 中
 * 左侧为真值，避免客户端再去加载 DefaultEmbeddingFunction（@chroma-core/default-embed）并打警告。
 */
function createApplicationSideEmbeddingFunction(): EmbeddingFunction {
  return {
    name: "application-side-precomputed",
    getConfig: () => ({}),
    async generate() {
      throw new Error(
        "Embeddings are computed in the application; Chroma only stores provided vectors.",
      );
    },
  };
}

export interface VectorStore {
  upsert(vectors: Vector[]): Promise<string[]>;
  search(
    queryVector: number[],
    options?: SearchOptions,
  ): Promise<SearchResult[]>;
  delete(ids: string[]): Promise<void>;
}

export interface Vector {
  id?: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  document?: string;
}

export interface SearchOptions {
  limit?: number;
  filters?: Record<string, unknown>;
}

export interface SearchResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
  document?: string;
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  onTimeout: () => Error,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(onTimeout()), ms);
  });
  return Promise.race([
    promise.finally(() => {
      if (timer !== undefined) clearTimeout(timer);
    }),
    timeoutPromise,
  ]);
}

class ChromaVectorStore implements VectorStore {
  private client: ChromaClient;
  private collection: Collection | null = null;
  private collectionName: string;
  private initialized = false;
  private chromaHost: string;
  private chromaPort: number;

  constructor() {
    const host =
      process.env.CHROMADB_HOST || process.env.CHROMA_HOST || "localhost";
    const port = parseInt(
      process.env.CHROMADB_PORT || process.env.CHROMA_PORT || "8000",
      10,
    );
    this.chromaHost = host;
    this.chromaPort = port;
    const base = process.env.CHROMA_COLLECTION_NAME?.trim() || "blog_posts";
    const dim = getExpectedEmbeddingDimensions();
    // 集合名带维度，避免 nomic(768) 与 text-embedding-v4(1024) 共用旧集导致 upsert 报错
    this.collectionName = `${base}_d${dim}`;
    this.client = new ChromaClient({ host, port });
  }

  private async initialize() {
    if (this.initialized) return;

    const connectMs = parseInt(
      process.env.CHROMADB_CONNECT_TIMEOUT_MS || "12000",
      10,
    );
    const timeoutErr = () =>
      new Error(
        `无法在 ${connectMs / 1000}s 内连接 ChromaDB（${this.chromaHost}:${this.chromaPort}）。请确认 Docker 中 Chroma 已启动，或检查 CHROMADB_HOST / CHROMADB_PORT。`,
      );

    try {
      this.collection = await withTimeout(
        this.client.getOrCreateCollection({
          name: this.collectionName,
          embeddingFunction: createApplicationSideEmbeddingFunction(),
        }),
        Number.isFinite(connectMs) && connectMs > 0 ? connectMs : 12000,
        timeoutErr,
      );
      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize Chroma collection:", error);
      throw error;
    }
  }

  async upsert(vectors: Vector[]): Promise<string[]> {
    await this.initialize();

    const expectedDim = getExpectedEmbeddingDimensions();
    for (const v of vectors) {
      if (v.embedding.length !== expectedDim) {
        throw new Error(
          `向量维度为 ${v.embedding.length}，当前配置期望 ${expectedDim}（集合 ${this.collectionName}）。请核对 EMBEDDING_DIMENSIONS / OLLAMA_EMBEDDING_DIMENSIONS，或重建索引。`,
        );
      }
    }

    const ids = vectors.map((v, i) => v.id || `vec_${Date.now()}_${i}`);
    const embeddings = vectors.map((v) => v.embedding);
    const metadatas = vectors.map(
      (v) => v.metadata as Record<string, string | number | boolean>,
    );
    const documents = vectors.map((v) => v.document || "");

    await this.collection!.upsert({ ids, embeddings, metadatas, documents });
    return ids;
  }

  async search(
    queryVector: number[],
    options: SearchOptions = {},
  ): Promise<SearchResult[]> {
    await this.initialize();

    const expectedDim = getExpectedEmbeddingDimensions();
    if (queryVector.length !== expectedDim) {
      throw new Error(
        `查询向量维度为 ${queryVector.length}，当前集合期望 ${expectedDim}（${this.collectionName}）。`,
      );
    }

    const results = await this.collection!.query({
      queryEmbeddings: [queryVector],
      nResults: options.limit || 5,
      where: options.filters as
        | Record<string, string | number | boolean>
        | undefined,
    });

    return (results.ids[0] || []).map((id, i) => ({
      id: id as string,
      score: 1 - (results.distances?.[0]?.[i] || 0),
      metadata: (results.metadatas?.[0]?.[i] as Record<string, unknown>) || {},
      document: results.documents?.[0]?.[i] as string,
    }));
  }

  async delete(ids: string[]): Promise<void> {
    await this.initialize();
    await this.collection!.delete({ ids });
  }
}

export function createVectorStore(): VectorStore {
  const provider = process.env.VECTOR_DB_PROVIDER || "chroma";

  switch (provider) {
    case "chroma":
      return new ChromaVectorStore();
    default:
      throw new Error(`Unsupported vector store: ${provider}`);
  }
}

let vectorStoreInstance: VectorStore | null = null;

export function getVectorStore(): VectorStore {
  if (!vectorStoreInstance) {
    vectorStoreInstance = createVectorStore();
  }
  return vectorStoreInstance;
}
