import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createCategorySchema = z.object({
  name: z.string().min(1, "分类名称不能为空").max(50),
  slug: z.string().min(1, "URL slug不能为空").max(50),
  description: z.string().max(200).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(50).optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限访问" }, { status: 403 });
  }

  const includeStats = new URL(request.url).searchParams.get("includeStats") === "true";

  if (includeStats) {
    const cats = await prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { posts: { select: { id: true, published: true } } },
    });
    return NextResponse.json({
      categories: cats.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        color: c.color,
        icon: c.icon,
        sortOrder: c.sortOrder,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        stats: {
          totalPosts: c.posts.length,
          publishedPosts: c.posts.filter((p) => p.published).length,
        },
      })),
    });
  }

  const cats = await prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return NextResponse.json({ categories: cats });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限访问" }, { status: 403 });
  }

  try {
    const data = createCategorySchema.parse(await request.json());
    const existing = await prisma.category.findFirst({
      where: { OR: [{ name: data.name }, { slug: data.slug }] },
    });
    if (existing) {
      return NextResponse.json(
        { error: existing.name === data.name ? "分类名称已存在" : "slug已存在" },
        { status: 400 }
      );
    }
    const cat = await prisma.category.create({ data });
    return NextResponse.json(cat, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "数据验证失败", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
