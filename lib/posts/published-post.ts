import { prisma } from "@/lib/prisma";

const publishedInclude = {
  category: { select: { name: true, slug: true, icon: true } },
  tags: { select: { tag: { select: { name: true, slug: true } } } },
} as const;

export async function getPublishedPostMeta(slug: string) {
  return prisma.post.findUnique({
    where: { slug, published: true },
    select: { title: true, excerpt: true, coverImage: true },
  });
}

export async function getPublishedPostForPublic(slug: string) {
  return prisma.post.findUnique({
    where: { slug, published: true },
    include: publishedInclude,
  });
}

export async function getPublishedPostAndIncrementViews(slug: string) {
  const post = await getPublishedPostForPublic(slug);
  if (!post) return null;
  await prisma.post.update({
    where: { id: post.id },
    data: { views: { increment: 1 } },
  });
  return { ...post, views: post.views + 1 };
}
