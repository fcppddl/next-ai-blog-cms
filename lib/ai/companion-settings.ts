import { prisma } from "@/lib/prisma";
import {
  DEFAULT_COMPANION_SYSTEM_PERSONA,
  DEFAULT_RAG_RERANK_SCORE_THRESHOLD,
} from "@/lib/ai/companion";

/**
 * `app_settings` 中对话相关键的约定。新增项（如对话压缩阈值、模型温度等）在此加常量即可复用同一张表。
 * @see prisma/schema.prisma `AppSetting`
 */
export const AppSettingKeys = {
  /** 助手 System Prompt 人设首段 */
  systemPrompt: "companion_system_prompt",
  /** RAG 重排后片段最低保留分（0~1，默认 0.6） */
  ragRerankScoreThreshold: "rag_rerank_score_threshold",
} as const;

export type AppSettingKey =
  (typeof AppSettingKeys)[keyof typeof AppSettingKeys];

/** 兼容历史代码 */
export const COMPANION_SYSTEM_PROMPT_KEY = AppSettingKeys.systemPrompt;

const MAX_SYSTEM_PERSONA_LEN = 12_000;

export function normalizeStoredSystemPersona(input: string): string {
  return input.trim().slice(0, MAX_SYSTEM_PERSONA_LEN);
}

function normalizeStoredScoreThreshold(input: string): number | null {
  const raw = input.trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n < 0 || n > 1) return null;
  return n;
}

/**
 * 从数据库读取 System Prompt 人设；无记录、空串则回退为 `DEFAULT_COMPANION_SYSTEM_PERSONA`。
 * 与 seed 首次写入的默认值一致。
 */
export async function getResolvedCompanionSystemPersona(): Promise<string> {
  const row = await prisma.appSetting.findUnique({
    where: { key: AppSettingKeys.systemPrompt },
    select: { value: true },
  });
  const v = (row?.value ?? "").trim();
  if (v) return v.slice(0, MAX_SYSTEM_PERSONA_LEN);
  return DEFAULT_COMPANION_SYSTEM_PERSONA;
}

/**
 * 从数据库读取 RAG 重排阈值；无记录、空串或非法值则回退为默认值 0.6。
 * 约定：app_settings.value 存字符串数字，如 "0.6"。
 */
export async function getResolvedRagRerankScoreThreshold(): Promise<number> {
  const row = await prisma.appSetting.findUnique({
    where: { key: AppSettingKeys.ragRerankScoreThreshold },
    select: { value: true },
  });
  const n = normalizeStoredScoreThreshold(row?.value ?? "");
  return n === null ? DEFAULT_RAG_RERANK_SCORE_THRESHOLD : n;
}
