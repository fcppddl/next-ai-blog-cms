/**
 * 对话消息（含可选的长期记忆锚点）
 * `summary`：该条消息**之前**的对话摘要；用于滑动窗口 + 摘要压缩。
 */
export interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  /**
   * 滚动记忆锚点：表示**本条之前**的对话已压缩进该摘要正文。
   * 请求模型时只发送「本条之后」的消息 + 本字段作为 system 摘要，不包含本条正文。
   */
  summary?: string;
}

/**
 * 与 OpenAI Chat Completions 对齐的核心消息，供 `getAIClient().chat` / `chatStream` 使用。
 */
export type CoreMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};
