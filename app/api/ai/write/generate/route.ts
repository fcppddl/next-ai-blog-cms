import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAIClient } from "@/lib/ai/client";
import { prisma } from "@/lib/prisma";
import {
  buildTitlePrompt,
  buildExcerptPrompt,
  buildTagsPrompt,
  buildCategoryPrompt,
  buildOutlinePrompt,
  buildExpandPrompt,
  buildPolishPrompt,
} from "@/lib/ai/prompts/write";
import { AI_GENERATION_TYPES } from "@/lib/ai/constants";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const body = await request.json();
    const { type, content, options } = body;

    if (!type || !content) {
      return NextResponse.json({ error: "类型和内容不能为空" }, { status: 400 });
    }

    const aiClient = getAIClient();
    let prompt = "";

    switch (type) {
      case AI_GENERATION_TYPES.TITLE:
        prompt = buildTitlePrompt(content, {
          count: options?.count,
          style: options?.style,
        });
        break;

      case AI_GENERATION_TYPES.EXCERPT:
        prompt = buildExcerptPrompt(content);
        break;

      case AI_GENERATION_TYPES.TAGS: {
        const existingTags = await prisma.tag.findMany({
          select: { name: true },
          orderBy: { name: "asc" },
        });
        prompt = buildTagsPrompt(content, existingTags.map((t) => t.name));
        break;
      }

      case AI_GENERATION_TYPES.CATEGORY: {
        const existingCategories = await prisma.category.findMany({
          select: { name: true },
          orderBy: { name: "asc" },
        });
        prompt = buildCategoryPrompt(content, existingCategories.map((c) => c.name));
        break;
      }

      case AI_GENERATION_TYPES.OUTLINE:
        prompt = buildOutlinePrompt(content);
        break;

      case AI_GENERATION_TYPES.EXPAND:
        prompt = buildExpandPrompt(content);
        break;

      case AI_GENERATION_TYPES.POLISH:
        prompt = buildPolishPrompt(content, options?.customPrompt);
        break;

      default:
        return NextResponse.json({ error: "不支持的类型" }, { status: 400 });
    }

    const response = await aiClient.chat([{ role: "user", content: prompt }], {
      maxTokens: 1000,
      temperature: 0.7,
    });

    let results: string | string[] | { existing: string[]; new: string[] };

    if (
      type === AI_GENERATION_TYPES.TAGS ||
      type === AI_GENERATION_TYPES.CATEGORY
    ) {
      try {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          results = {
            existing: Array.isArray(parsed.existing) ? parsed.existing : [],
            new: Array.isArray(parsed.new) ? parsed.new : [],
          };
        } else {
          results = { existing: [], new: [] };
        }
      } catch {
        results = { existing: [], new: [] };
      }
    } else if (type === AI_GENERATION_TYPES.TITLE) {
      try {
        const jsonMatch = response.content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          results = JSON.parse(jsonMatch[0]);
        } else {
          results = response.content
            .split("\n")
            .map((line) => line.replace(/^[-*•\d.]\s*/, "").trim())
            .filter(Boolean);
        }
      } catch {
        results = response.content
          .split("\n")
          .map((line) => line.replace(/^[-*•\d.]\s*/, "").trim())
          .filter(Boolean);
      }
    } else {
      results = response.content;
    }

    return NextResponse.json({ results, tokensUsed: response.tokensUsed });
  } catch (error) {
    console.error("AI 生成错误:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI 生成失败" },
      { status: 500 }
    );
  }
}
