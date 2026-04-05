import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { indexAllPosts, indexPost, deletePostIndex } from "@/lib/vector/indexer";

// GET /api/admin/vector — 返回索引状态
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "未授权" }, { status: 401 });

  const [totalPosts, indexedPosts] = await Promise.all([
    prisma.post.count({ where: { published: true } }),
    prisma.postVectorIndex.count(),
  ]);

  const indexed = await prisma.postVectorIndex.findMany({
    select: {
      postId: true,
      chunkCount: true,
      indexedAt: true,
      updatedAt: true,
      post: { select: { title: true, slug: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    totalPosts,
    indexedCount: indexedPosts,
    pendingCount: Math.max(0, totalPosts - indexedPosts),
    posts: indexed.map((r) => ({
      postId: r.postId,
      title: r.post.title,
      slug: r.post.slug,
      chunkCount: r.chunkCount,
      indexedAt: r.indexedAt,
      updatedAt: r.updatedAt,
    })),
  });
}

// POST /api/admin/vector — 触发索引
// body: { action: "index_all" | "index_post" | "delete_post"; postId?: string; force?: boolean }
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "未授权" }, { status: 401 });

  let body: { action?: string; postId?: string; force?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }

  const { action, postId, force = false } = body;

  if (action === "index_all") {
    try {
      const result = await indexAllPosts({ force });
      return NextResponse.json({ ok: true, ...result });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: `索引失败: ${msg}` }, { status: 500 });
    }
  }

  if (action === "index_post") {
    if (!postId) return NextResponse.json({ error: "缺少 postId" }, { status: 400 });
    try {
      await indexPost(postId, { force });
      return NextResponse.json({ ok: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: `索引失败: ${msg}` }, { status: 500 });
    }
  }

  if (action === "delete_post") {
    if (!postId) return NextResponse.json({ error: "缺少 postId" }, { status: 400 });
    try {
      await deletePostIndex(postId);
      return NextResponse.json({ ok: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: `删除索引失败: ${msg}` }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "未知 action" }, { status: 400 });
}
