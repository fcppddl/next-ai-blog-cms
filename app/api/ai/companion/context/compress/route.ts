import { NextRequest, NextResponse } from "next/server";
import { getAIClient, type ChatMessage } from "@/lib/ai/client";
import {
  compressMessages,
  getCompressionPromptParts,
  shouldCompressConversation,
} from "@/lib/chat/context";
import type { Message } from "@/types/chat";

const MAX_BODY_MESSAGES = 120;
const MAX_CONTENT_LEN = 12000;
const MAX_SUMMARY_LEN = 16000;

function normalizeMessages(value: unknown): Message[] {
  if (!Array.isArray(value)) return [];
  const out: Message[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: unknown }).role;
    if (role !== "user" && role !== "assistant") continue;
    const content = String((item as { content?: unknown }).content ?? "")
      .trim()
      .slice(0, MAX_CONTENT_LEN);
    if (!content) continue;
    const summaryRaw = (item as { summary?: unknown }).summary;
    const summary =
      typeof summaryRaw === "string"
        ? summaryRaw.trim().slice(0, MAX_SUMMARY_LEN)
        : undefined;
    const id = (item as { id?: unknown }).id;
    const m: Message = {
      role,
      content,
      ...(summary ? { summary } : {}),
      ...(typeof id === "string" ? { id } : {}),
    };
    out.push(m);
  }
  return out.slice(-MAX_BODY_MESSAGES);
}

function formatRoundsForPrompt(msgs: Message[]): string {
  return msgs
    .map((m, i) => {
      const label = m.role === "user" ? "用户" : "助手";
      return `[${i + 1}] ${label}：${m.content}`;
    })
    .join("\n\n");
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }

  const messages = normalizeMessages(
    (body as { messages?: unknown })?.messages,
  );

  if (!shouldCompressConversation(messages)) {
    return NextResponse.json({ compressed: false, messages });
  }

  const { oldSummary, lastRounds } = getCompressionPromptParts(messages);
  if (lastRounds.length === 0) {
    return NextResponse.json({ compressed: false, messages });
  }

  const userBlock = [
    oldSummary
      ? `【既有摘要】\n${oldSummary}`
      : "【既有摘要】\n（尚无，以下为首次压缩）",
    "",
    "【最近三轮对话（用于融合进新摘要）】",
    formatRoundsForPrompt(lastRounds),
    "",
    "请输出一段新的中文摘要：合并既有摘要与上述对话中的关键信息（事实、偏好、未决问题等），避免复述原文，不超过 800 字。只输出摘要正文，不要标题或引号包裹。",
  ].join("\n");

  try {
    const ai = getAIClient();
    const chatMessages: ChatMessage[] = [
      {
        role: "system",
        content: "你是对话记忆压缩助手，只输出精炼摘要正文，使用简体中文。",
      },
      { role: "user", content: userBlock },
    ];

    const response = await ai.chat(chatMessages, {
      temperature: 0.3,
      maxTokens: 1200,
      signal: request.signal,
    });

    const newSummary = (response.content || "").trim();
    if (!newSummary) {
      return NextResponse.json({ error: "摘要生成结果为空" }, { status: 502 });
    }
    console.log("newSummary", newSummary);

    const next = compressMessages(messages, newSummary);
    return NextResponse.json({ compressed: true, messages: next });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "摘要压缩失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
