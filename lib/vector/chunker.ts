export interface Chunk {
  content: string;
  index: number;
  metadata?: Record<string, unknown>;
}

function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = text.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w)).length;
  return Math.ceil(chineseChars * 1.5 + englishWords * 1.3);
}

export function chunkPost(
  content: string,
  options: {
    maxTokens?: number;
    overlap?: number;
    maxChars?: number;
  } = {}
): Chunk[] {
  const maxTokens = options.maxTokens || 300;
  const overlap = options.overlap || 50;
  const maxChars = options.maxChars || 800;
  const chunks: Chunk[] = [];

  const paragraphs = content.split(/\n\n+/).filter((p) => p.trim());
  let currentChunk = "";
  let chunkIndex = 0;

  const hardSplitChunk = (text: string) => {
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + maxChars, text.length);
      const chunk = text.slice(start, end);
      chunks.push({ content: chunk.trim(), index: chunkIndex++ });
      start = end - Math.min(overlap, end - start);
      if (start >= text.length - overlap) {
        if (start < text.length) {
          chunks.push({ content: text.slice(start).trim(), index: chunkIndex++ });
        }
        break;
      }
    }
  };

  const splitChunk = (text: string) => {
    const sentences = text.split(/([。！？\n]|\.\s+)/).filter((s) => s.trim());
    let sentenceChunk = "";

    for (const sentence of sentences) {
      const testChunk = sentenceChunk + sentence;
      const testTokens = estimateTokens(testChunk);
      const testChars = testChunk.length;

      if ((testTokens > maxTokens || testChars > maxChars) && sentenceChunk) {
        chunks.push({ content: sentenceChunk.trim(), index: chunkIndex++ });
        const overlapText = sentenceChunk.slice(-Math.min(overlap, sentenceChunk.length));
        sentenceChunk = overlapText + sentence;
      } else {
        sentenceChunk += sentence;
      }
    }

    if (sentenceChunk.trim()) {
      const finalTokens = estimateTokens(sentenceChunk);
      const finalChars = sentenceChunk.length;
      if (finalTokens > maxTokens || finalChars > maxChars) {
        hardSplitChunk(sentenceChunk);
      } else {
        chunks.push({ content: sentenceChunk.trim(), index: chunkIndex++ });
      }
    }
  };

  const flushChunk = () => {
    if (currentChunk.trim()) {
      const chunkTokens = estimateTokens(currentChunk);
      const chunkChars = currentChunk.length;
      if (chunkTokens > maxTokens || chunkChars > maxChars) {
        splitChunk(currentChunk);
        currentChunk = "";
      } else {
        chunks.push({ content: currentChunk.trim(), index: chunkIndex++ });
        currentChunk = "";
      }
    }
  };

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para);
    const paraChars = para.length;

    if (paraTokens > maxTokens || paraChars > maxChars) {
      flushChunk();
      splitChunk(para);
    } else {
      const testChunk = currentChunk ? currentChunk + "\n\n" + para : para;
      const testTokens = estimateTokens(testChunk);
      const testChars = testChunk.length;

      if ((testTokens > maxTokens || testChars > maxChars) && currentChunk) {
        flushChunk();
        const overlapText = currentChunk.slice(-Math.min(overlap, currentChunk.length));
        currentChunk = overlapText + "\n\n" + para;
      } else {
        currentChunk = testChunk;
      }
    }
  }

  flushChunk();

  const finalChunks: Chunk[] = [];
  for (const chunk of chunks) {
    if (chunk.content.length <= maxChars && estimateTokens(chunk.content) <= maxTokens * 1.2) {
      finalChunks.push({ ...chunk, index: finalChunks.length });
    } else {
      console.warn(`[Chunker] 发现超限块（${chunk.content.length} 字符），进行硬切`);
      hardSplitChunk(chunk.content);
    }
  }

  return finalChunks;
}
