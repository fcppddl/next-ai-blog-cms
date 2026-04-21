import { getEncoding, type Tiktoken } from "js-tiktoken";
import type { CoreMessage, Message } from "@/types/chat";

/** 触发压缩：summary 锚点之后累计满 5 轮对话（10 条消息） */
export const COMPRESS_MESSAGE_THRESHOLD = 10;

/** 参与摘要模型的最近轮数（3 轮 = 6 条） */
export const COMPRESS_INPUT_ROUNDS = 3;

/** 新摘要相对「旧 summary 锚点」的偏移：3 轮 = 6 条消息之后 */
export const SUMMARY_ANCHOR_OFFSET_MESSAGES = 6;

const SUMMARY_SYSTEM_LABEL = "【历史对话摘要】";

let cachedEncoding: Tiktoken | null = null;

function getDefaultEncoding(): Tiktoken {
  if (!cachedEncoding) {
    cachedEncoding = getEncoding("cl100k_base");
  }
  return cachedEncoding;
}

/**
 * 唯一 summary 锚点：约定同一时间只有一条消息带 `summary`（滚动记忆节点）。
 * 取「从后往前」第一个有摘要的索引，即当前锚点。
 */
function findLastSummaryIndex(messages: Message[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const s = messages[i]?.summary;
    if (typeof s === "string" && s.trim().length > 0) {
      return i;
    }
  }
  return -1;
}

/** 供摘要 API 使用：旧摘要文本 + 锚点之后「离摘要最近」的若干条（从紧邻锚点的下一条起共 n 条） */
export function getCompressionPromptParts(messages: Message[]): {
  oldSummary: string;
  lastRounds: Message[];
} {
  const idx = findLastSummaryIndex(messages);
  const recent = idx >= 0 ? messages.slice(idx + 1) : [...messages];
  const oldSummary =
    idx >= 0 ? String(messages[idx]!.summary ?? "").trim() : "";
  const n = COMPRESS_INPUT_ROUNDS * 2;
  const lastRounds = recent.slice(0, n);
  return { oldSummary, lastRounds };
}

export interface BuildContextResult {
  coreMessages: CoreMessage[];
  /** 固定保留的前缀条数：主系统提示 + 可选摘要系统提示 */
  prefixLength: number;
  summaryText: string | null;
}

/**
 * 组装上下文：系统人设 → 摘要（系统级）→ **仅** summary 锚点**之后**的消息（不含锚点本条正文）。
 * 锚点上的 `summary` 文本表示该条之前的历史已被压缩进摘要。
 */
export function buildContext(
  systemPrompt: string,
  messages: Message[],
): BuildContextResult {
  const idx = findLastSummaryIndex(messages);
  const summaryText =
    idx >= 0 ? (messages[idx]!.summary as string).trim() : null;
  const recent = idx >= 0 ? messages.slice(idx + 1) : [...messages];

  const coreMessages: CoreMessage[] = [
    { role: "system", content: systemPrompt },
  ];
  if (summaryText) {
    coreMessages.push({
      role: "system",
      content: `${SUMMARY_SYSTEM_LABEL}\n${summaryText}`,
    });
  }
  for (const m of recent) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    const content = typeof m.content === "string" ? m.content : "";
    if (!content.trim()) continue;
    coreMessages.push({ role: m.role, content });
  }

  const prefixLength = summaryText ? 2 : 1;
  return { coreMessages, prefixLength, summaryText };
}

function countCoreTokens(
  messages: CoreMessage[],
  encode: (text: string) => Uint32Array | number[],
): number {
  let n = 0;
  for (const m of messages) {
    n += encode(`${m.role}\n${m.content}`).length;
    n += 4;
  }
  return n;
}

export interface TrimContextOptions {
  maxTokens: number;
  /** 从尾部保留的消息条数（通常为 1，即当前用户输入） */
  tailPreserve?: number;
  encoding?: Tiktoken;
}

/**
 * 若总 Token 超过上限，从「近期对话」段**头部**逐条删除；绝不删除摘要与主系统提示。
 */
export function trimContext(
  messages: CoreMessage[],
  prefixLength: number,
  options: TrimContextOptions,
): CoreMessage[] {
  const {
    maxTokens,
    tailPreserve = 1,
    encoding = getDefaultEncoding(),
  } = options;
  const encode = (text: string) => encoding.encode(text);

  if (messages.length <= prefixLength + tailPreserve) {
    return messages;
  }

  const head = messages.slice(0, prefixLength);
  const tail = messages.slice(-tailPreserve);
  let middle = messages.slice(prefixLength, messages.length - tailPreserve);

  const assembled = () => [...head, ...middle, ...tail];

  while (
    middle.length > 0 &&
    countCoreTokens(assembled(), encode) > maxTokens
  ) {
    middle = middle.slice(1);
  }

  return assembled();
}

export function countContextTokens(
  messages: CoreMessage[],
  encoding: Tiktoken = getDefaultEncoding(),
): number {
  const encode = (text: string) => encoding.encode(text);
  return countCoreTokens(messages, encode);
}

/** 是否应在保存后触发摘要压缩 */
export function shouldCompressConversation(messages: Message[]): boolean {
  const idx = findLastSummaryIndex(messages);
  const recent = idx >= 0 ? messages.slice(idx + 1) : [...messages];
  return recent.length >= COMPRESS_MESSAGE_THRESHOLD;
}

/**
 * 压缩完成后：
 * 1. 清空**所有**消息上的旧 `summary`；
 * 2. 将新摘要写在「旧锚点下标 + 6」（3 轮）的那条消息上；若越界则写在**最后一条**。
 * 首次压缩（尚无锚点）时，新摘要写在第 6 条（下标 5）或最后一条（更短时）。
 */
export function compressMessages(messages: Message[], newSummary: string): Message[] {
  const idx = findLastSummaryIndex(messages);
  const text = newSummary.trim();
  if (!text) return messages;

  const cleared: Message[] = messages.map((m) => {
    const { summary: _s, ...rest } = m;
    return rest;
  });

  let targetIdx: number;
  if (idx < 0) {
    targetIdx =
      cleared.length <= SUMMARY_ANCHOR_OFFSET_MESSAGES
        ? Math.max(0, cleared.length - 1)
        : SUMMARY_ANCHOR_OFFSET_MESSAGES - 1;
  } else {
    targetIdx = idx + SUMMARY_ANCHOR_OFFSET_MESSAGES;
    if (targetIdx >= cleared.length) {
      targetIdx = cleared.length - 1;
    }
  }

  return cleared.map((m, i) =>
    i === targetIdx ? { ...m, summary: text } : m,
  );
}

export interface ContextManagerOptions {
  maxTokens: number;
  /** 与 `js-tiktoken` 一致，默认 cl100k_base */
  encodingName?: "cl100k_base" | "o200k_base";
}

/**
 * 封装 build + trim，便于在 Route 中单例使用。
 */
export class ContextManager {
  private readonly encoding: Tiktoken;

  constructor(private readonly opts: ContextManagerOptions) {
    this.encoding = getEncoding(opts.encodingName ?? "cl100k_base");
  }

  prepareForRequest(
    systemPrompt: string,
    history: Message[],
    currentUserText: string,
  ): CoreMessage[] {
    const { coreMessages, prefixLength } = buildContext(systemPrompt, history);
    const withUser: CoreMessage[] = [
      ...coreMessages,
      { role: "user", content: currentUserText },
    ];
    return trimContext(withUser, prefixLength, {
      maxTokens: this.opts.maxTokens,
      tailPreserve: 1,
      encoding: this.encoding,
    });
  }
}
