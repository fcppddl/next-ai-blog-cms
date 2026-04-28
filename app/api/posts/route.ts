import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "10");
  const category = searchParams.get("category");
  const tag = searchParams.get("tag");
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { published: true };

  if (category) {
    where.category = { slug: category };
  }

  if (tag) {
    where.tags = { some: { tag: { slug: tag } } };
  }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        coverImage: true,
        featured: true,
        readingTime: true,
        views: true,
        createdAt: true,
        category: { select: { name: true, slug: true, icon: true } },
        tags: { select: { tag: { select: { name: true, slug: true } } } },
      },
    }),
    prisma.post.count({ where }),
  ]);

  return NextResponse.json({
    posts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
