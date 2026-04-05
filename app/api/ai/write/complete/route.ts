import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAIClient } from "@/lib/ai/client";
import {
  COMPLETION_SYSTEM_MESSAGE,
  buildCompletionPrompt,
} from "@/lib/ai/prompts/completion";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const body = await request.json();
    const { content, cursorPosition } = body;

    if (!content) {
      return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
    }

    const beforeCursor = content.slice(0, cursorPosition ?? content.length);
    const recentContext = beforeCursor.slice(-500);

    const prompt = buildCompletionPrompt(recentContext);

    const aiClient = getAIClient();
    const response = await aiClient.chat(
      [
        { role: "system", content: COMPLETION_SYSTEM_MESSAGE },
        { role: "user", content: prompt },
      ],
      { maxTokens: 100, temperature: 0.7 }
    );

    const suggestion = response.content.trim();

    if (!suggestion || suggestion.length > 200) {
      return NextResponse.json({ suggestions: [] });
    }

    return NextResponse.json({
      suggestions: [{ text: suggestion }],
    });
  } catch (error) {
    console.error("AI 补全错误:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "补全失败" },
      { status: 500 }
    );
  }
}
