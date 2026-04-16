/**
 * 当前嵌入配置对应的向量维度：需与 `embed()` 输出一致，并用于 Chroma 集合名后缀，避免换模型后维度冲突。
 * 百炼：EMBEDDING_DIMENSIONS（默认 1024）；Ollama nomic：OLLAMA_EMBEDDING_DIMENSIONS（默认 768）。
 */
export function getExpectedEmbeddingDimensions(): number {
  if (process.env.EMBEDDING_MODEL?.trim()) {
    const n = parseInt(process.env.EMBEDDING_DIMENSIONS || "1024", 10);
    return Number.isFinite(n) ? n : 1024;
  }
  const n = parseInt(process.env.OLLAMA_EMBEDDING_DIMENSIONS || "768", 10);
  return Number.isFinite(n) ? n : 768;
}
