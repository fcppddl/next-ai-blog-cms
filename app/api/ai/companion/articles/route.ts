import { NextResponse } from "next/server";
import { getPublicArticleMeta } from "@/lib/ai/companion";

export async function GET() {
  try {
    const articles = await getPublicArticleMeta();
    return NextResponse.json({ articles, total: articles.length });
  } catch (error) {
    console.error("获取 AI 助手文章元信息失败:", error);
    return NextResponse.json({ error: "获取文章元信息失败" }, { status: 500 });
  }
}
