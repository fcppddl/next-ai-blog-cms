import { NextRequest, NextResponse } from "next/server";
import { getPublishedPostForPublic } from "@/lib/posts/published-post";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const post = await getPublishedPostForPublic(slug);

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  return NextResponse.json(post);
}
