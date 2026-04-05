import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createPostSchema = z.object({
  title: z.string().trim().min(1, "标题不能为空"),
  slug: z.string().trim().min(1, "URL slug不能为空"),
  content: z.string().trim().min(1, "内容不能为空"),
  excerpt: z.string().trim().optional(),
  coverImage: z.string().trim().optional(),
  published: z.boolean().default(false),
  featured: z.boolean().default(false),
  readingTime: z.number().int().optional(),
  categoryId: z.string().trim().optional(),
  tags: z.array(z.string().trim()).optional(),
});

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限访问" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "10")));
  const search = searchParams.get("search")?.trim() || null;
  const status = searchParams.get("status");
  const categoryId = searchParams.get("categoryId");
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  const and = [];

  if (search) {
    and.push({ OR: [{ title: { contains: search } }, { excerpt: { contains: search } }] });
  }
  if (status === "published") and.push({ published: true });
  if (status === "draft") and.push({ published: false });
  if (categoryId && categoryId !== "all") where.categoryId = categoryId;
  if (and.length > 0) where.AND = and;

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: "desc" },
      include: {
        category: true,
        tags: { include: { tag: true } },
        author: { include: { profile: true } },
      },
    }),
    prisma.post.count({ where }),
  ]);

  return NextResponse.json({
    posts: posts.map((p) => ({
      ...p,
      tags: p.tags.map((pt) => pt.tag),
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限访问" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = createPostSchema.parse(body);

    const existing = await prisma.post.findUnique({ where: { slug: data.slug } });
    if (existing) {
      return NextResponse.json({ error: "该 slug 已存在" }, { status: 409 });
    }

    const uniqueTagIds = Array.from(new Set(data.tags ?? []));

    const post = await prisma.post.create({
      data: {
        title: data.title,
        slug: data.slug,
        content: data.content,
        excerpt: data.excerpt,
        coverImage: data.coverImage || null,
        published: data.published,
        featured: data.featured,
        readingTime: data.readingTime,
        publishedAt: data.published ? new Date() : null,
        authorId: session.user.id,
        categoryId: data.categoryId || null,
        tags: uniqueTagIds.length
          ? { create: uniqueTagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })) }
          : undefined,
      },
      include: { category: true, tags: { include: { tag: true } } },
    });

    return NextResponse.json({ ...post, tags: post.tags.map((pt) => pt.tag) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "数据验证失败", details: error.issues }, { status: 400 });
    }
    console.error("创建文章失败:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
