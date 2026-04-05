import { prisma } from "@/lib/prisma";
import { getAIClient } from "@/lib/ai/client";
import { getVectorStore } from "./store";
import { chunkPost } from "./chunker";

export interface IndexOptions {
  force?: boolean;
}

export async function indexPost(postId: string, options: IndexOptions = {}): Promise<void> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      category: true,
      tags: { include: { tag: true } },
    },
  });

  if (!post) throw new Error("文章不存在");

  const existingIndex = await prisma.postVectorIndex.findUnique({ where: { postId } });
  if (existingIndex && !options.force) {
    console.log(`[RAG] 文章 ${postId} 已索引，跳过`);
    return;
  }

  const chunks = chunkPost(post.content);
  if (chunks.length === 0) {
    console.log(`[RAG] 文章 ${postId} 内容为空，跳过`);
    return;
  }

  console.log(`[RAG] 文章 "${post.title}" 分为 ${chunks.length} 块，开始生成 embedding...`);

  const aiClient = getAIClient();
  const vectors: Array<{
    id: string;
    embedding: number[];
    metadata: Record<string, unknown>;
    document: string;
  }> = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkEmbeddings = await aiClient.embed(chunk.content);

    if (chunkEmbeddings.length === 1) {
      vectors.push({
        id: `${postId}_${chunk.index}`,
        embedding: chunkEmbeddings[0],
        metadata: {
          postId: post.id,
          chunkIndex: chunk.index,
          subChunkIndex: 0,
          title: post.title,
          slug: post.slug,
          category: post.category?.name || "",
          tags: post.tags.map((pt) => pt.tag.name).join(","),
        },
        document: chunk.content,
      });
    } else {
      console.warn(`[RAG] 块 ${chunk.index} 被切分为 ${chunkEmbeddings.length} 个子块`);

      const MAX_CHUNK_SIZE = 800;
      const chunkOverlap = 50;
      const subChunks: string[] = [];

      let start = 0;
      while (start < chunk.content.length) {
        const end = Math.min(start + MAX_CHUNK_SIZE, chunk.content.length);
        subChunks.push(chunk.content.slice(start, end));
        start = end - chunkOverlap;
        if (start >= chunk.content.length - chunkOverlap) {
          if (end < chunk.content.length) subChunks.push(chunk.content.slice(start));
          break;
        }
      }

      for (let j = 0; j < chunkEmbeddings.length; j++) {
        vectors.push({
          id: `${postId}_${chunk.index}_${j}`,
          embedding: chunkEmbeddings[j],
          metadata: {
            postId: post.id,
            chunkIndex: chunk.index,
            subChunkIndex: j,
            isSubChunk: true,
            title: post.title,
            slug: post.slug,
            category: post.category?.name || "",
            tags: post.tags.map((pt) => pt.tag.name).join(","),
          },
          document: subChunks[j] || chunk.content.slice(j * MAX_CHUNK_SIZE, (j + 1) * MAX_CHUNK_SIZE),
        });
      }
    }

    if ((i + 1) % 5 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  console.log(`[RAG] Embedding 生成完成，共 ${vectors.length} 个向量`);

  const vectorStore = getVectorStore();
  const vectorIds = await vectorStore.upsert(vectors);

  await prisma.postVectorIndex.upsert({
    where: { postId },
    create: { postId, vectorId: vectorIds[0], chunkCount: chunks.length },
    update: { vectorId: vectorIds[0], chunkCount: chunks.length, updatedAt: new Date() },
  });

  console.log(`文章 ${postId} 索引完成: ${chunks.length} 个语义块, ${vectors.length} 个向量`);
}

export async function deletePostIndex(postId: string): Promise<void> {
  const existingIndex = await prisma.postVectorIndex.findUnique({ where: { postId } });
  if (!existingIndex) return;

  const vectorStore = getVectorStore();
  const idsToDelete = Array.from({ length: existingIndex.chunkCount }, (_, i) => `${postId}_${i}`);
  await vectorStore.delete(idsToDelete);
  await prisma.postVectorIndex.delete({ where: { postId } });

  console.log(`文章 ${postId} 索引已删除`);
}

export async function indexAllPosts(options: IndexOptions = {}): Promise<{
  indexed: number;
  skipped: number;
  failed: number;
  errors?: string[];
}> {
  const posts = await prisma.post.findMany({
    where: { published: true },
    select: { id: true, title: true },
  });

  console.log(`[RAG] 开始索引，共找到 ${posts.length} 篇已发布文章`);

  let indexed = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const post of posts) {
    try {
      const existingIndex = await prisma.postVectorIndex.findUnique({ where: { postId: post.id } });
      if (existingIndex && !options.force) {
        skipped++;
        continue;
      }

      console.log(`[RAG] 正在索引: ${post.title}`);
      await indexPost(post.id, options);
      indexed++;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[RAG] 索引文章 "${post.title}" 失败:`, errorMsg);
      errors.push(`${post.title}: ${errorMsg}`);
      failed++;
    }
  }

  console.log(`[RAG] 索引完成: ${indexed} 成功, ${skipped} 跳过, ${failed} 失败`);
  return { indexed, skipped, failed, errors: errors.length > 0 ? errors : undefined };
}
