import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    include: { profile: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const [postCount, viewCount] = await Promise.all([
    prisma.post.count({ where: { published: true } }),
    prisma.post.aggregate({ _sum: { views: true } }),
  ]);

  const email = user.profile?.email?.trim() || user.email?.trim() || undefined;
  const phone = user.profile?.phone?.trim() || undefined;

  return NextResponse.json({
    username: user.username,
    displayName: user.profile?.displayName ?? user.username,
    bio: user.profile?.bio,
    avatar: user.profile?.avatar,
    email,
    phone,
    github: user.profile?.github,
    twitter: user.profile?.twitter,
    website: user.profile?.website,
    stats: {
      posts: postCount,
      views: viewCount._sum.views ?? 0,
    },
  });
}
