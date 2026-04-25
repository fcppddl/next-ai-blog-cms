import type { AIClient, ChatMessage } from "@/lib/ai/client";

export type CompanionKnowledgeIntent = "chit_chat" | "article_qa";

/** 默认策略：拿不准时视为文章/站点向问答，以便注入全站目录或检索 */
export const DEFAULT_COMPANION_KNOWLEDGE_INTENT: CompanionKnowledgeIntent =
  "article_qa";

function tryParseIntentJson(
  text: string,
): CompanionKnowledgeIntent | null {
  const trimmed = text.trim();
  const oneLine =
    trimmed.split("\n").find((l) => l.includes("{") && l.includes("}")) ??
    trimmed;
  const start = oneLine.indexOf("{");
  const end = oneLine.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const data = JSON.parse(oneLine.slice(start, end + 1)) as {
      intent?: unknown;
    };
    if (data.intent === "chit_chat" || data.intent === "article_qa")
      return data.intent;
  } catch {
    /* 解析失败则回退 */
  }
  return null;
}

/**
 * 在流式主对话之前调用的轻量分类：判断闲聊 / 文章问答；拿不准时 article_qa。
 * 仅根据用户本轮问句判断，不依赖站内文章目录。
 */
export async function classifyCompanionKnowledgeIntent(
  userMessage: string,
  aiClient: AIClient,
  options?: { signal?: AbortSignal },
): Promise<CompanionKnowledgeIntent> {
  const { signal } = options ?? {};

  const system: ChatMessage = {
    role: "system",
    content: `你是路由分类器。仅根据用户**本轮问题**判断其意图，输出**仅一行**可 JSON.parse 的 JSON，不要其他文字、不要 Markdown 代码块。

两档意图：
- "chit_chat"：问候、寒暄、感谢、你是谁、与博客文章推荐/内容无关的泛泛闲聊、不要求参考站内某篇文章时也能回答的闲聊。
- "article_qa"：与博客已发布内容、技术主题、需要结合或引用站内某篇文章/摘要的提问、推荐类需求；**拿不准、有困难判断时，一律输出 "article_qa"**。

严格输出格式：{"intent":"chit_chat"} 或 {"intent":"article_qa"}`,
  };
  const user: ChatMessage = {
    role: "user",
    content: `用户说：\n${userMessage.slice(0, 2000)}`,
  };

  try {
    const res = await aiClient.chat([system, user], {
      temperature: 0,
      maxTokens: 80,
      signal,
    });
    const intent = tryParseIntentJson(res.content);
    if (intent) return intent;
  } catch (e) {
    console.warn(
      "[knowledge-route] 意图分类失败，使用默认文章问答：",
      e instanceof Error ? e.message : e,
    );
  }
  return DEFAULT_COMPANION_KNOWLEDGE_INTENT;
}
