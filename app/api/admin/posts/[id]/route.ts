import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updatePostSchema = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  excerpt: z.string().optional(),
  coverImage: z.string().optional().or(z.literal("")),
  published: z.boolean().optional(),
  featured: z.boolean().optional(),
  readingTime: z.number().int().optional(),
  categoryId: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限访问" }, { status: 403 });
  }
  const { id } = await params;
  const post = await prisma.post.findUnique({
    where: { id },
    include: { category: true, tags: { include: { tag: true } }, author: { include: { profile: true } } },
  });
  if (!post) return NextResponse.json({ error: "文章不存在" }, { status: 404 });
  return NextResponse.json({ ...post, categoryId: post.categoryId, tags: post.tags.map((pt) => pt.tag) });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限访问" }, { status: 403 });
  }
  const { id } = await params;

  try {
    const body = await request.json();
    const data = updatePostSchema.parse(body);

    const existing = await prisma.post.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "文章不存在" }, { status: 404 });

    if (data.slug && data.slug !== existing.slug) {
      const slugExists = await prisma.post.findUnique({ where: { slug: data.slug } });
      if (slugExists) return NextResponse.json({ error: "该 slug 已存在" }, { status: 409 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.excerpt !== undefined) updateData.excerpt = data.excerpt;
    if (data.coverImage !== undefined) updateData.coverImage = data.coverImage?.trim() || null;
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId || null;
    if (data.readingTime !== undefined) updateData.readingTime = data.readingTime;
    if (data.published !== undefined) {
      updateData.published = data.published;
      if (data.published && !existing.publishedAt) updateData.publishedAt = new Date();
      if (!data.published) updateData.publishedAt = null;
    }
    if (data.featured !== undefined) updateData.featured = data.featured;

    if (data.tags !== undefined) {
      const uniqueTagIds = Array.from(new Set(data.tags));
      updateData.tags = {
        deleteMany: {},
        ...(uniqueTagIds.length > 0
          ? { create: uniqueTagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })) }
          : {}),
      };
    }

    const updated = await prisma.post.update({
      where: { id },
      data: updateData,
      include: { category: true, tags: { include: { tag: true } } },
    });

    return NextResponse.json({ ...updated, tags: updated.tags.map((pt) => pt.tag) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "数据验证失败", details: error.issues }, { status: 400 });
    }
    console.error("更新文章失败:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限访问" }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.post.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "文章不存在" }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {};
  if (body.published !== undefined) {
    updateData.published = body.published;
    if (body.published && !existing.publishedAt) updateData.publishedAt = new Date();
    if (!body.published) updateData.publishedAt = null;
  }
  if (body.featured !== undefined) updateData.featured = body.featured;

  const updated = await prisma.post.update({ where: { id }, data: updateData });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限访问" }, { status: 403 });
  }
  const { id } = await params;
  const existing = await prisma.post.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "文章不存在" }, { status: 404 });
  await prisma.post.delete({ where: { id } });
  return NextResponse.json({ message: "文章删除成功" });
}
