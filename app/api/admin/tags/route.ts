import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createTagSchema = z.object({
  name: z.string().min(1, "标签名称不能为空").max(30),
  slug: z.string().min(1, "URL slug不能为空").max(30),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限访问" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const includeStats = searchParams.get("includeStats") === "true";
  const search = searchParams.get("search");
  const where = search
    ? { OR: [{ name: { contains: search } }, { slug: { contains: search } }] }
    : {};

  if (includeStats) {
    const tags = await prisma.tag.findMany({
      where,
      orderBy: { name: "asc" },
      include: { posts: { select: { id: true, post: { select: { published: true } } } } },
    });
    return NextResponse.json({
      tags: tags.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        color: t.color,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        stats: {
          totalPosts: t.posts.length,
          publishedPosts: t.posts.filter((pt) => pt.post.published).length,
        },
      })),
    });
  }

  const tags = await prisma.tag.findMany({ where, orderBy: { name: "asc" } });
  return NextResponse.json({ tags });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限访问" }, { status: 403 });
  }

  try {
    const data = createTagSchema.parse(await request.json());
    const existing = await prisma.tag.findFirst({
      where: { OR: [{ name: data.name }, { slug: data.slug }] },
    });
    if (existing) {
      return NextResponse.json(
        { error: existing.name === data.name ? "标签名称已存在" : "slug已存在" },
        { status: 400 }
      );
    }
    const tag = await prisma.tag.create({ data });
    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "数据验证失败", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
