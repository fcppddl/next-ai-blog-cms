import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_COMPANION_SYSTEM_PERSONA,
  DEFAULT_RAG_RERANK_SCORE_THRESHOLD,
} from "@/lib/ai/companion";
import {
  AppSettingKeys,
  normalizeStoredSystemPersona,
} from "@/lib/ai/companion-settings";
import type { Session } from "next-auth";

function normalizeStoredScoreThreshold(input: string): number | null {
  const raw = input.trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n < 0 || n > 1) return null;
  return n;
}

function unauthorized() {
  return NextResponse.json({ error: "未授权" }, { status: 401 });
}

/**
 * 见 next-auth `next/index.js`：非 200 的 session 响应会 `throw`，导致整路由 500；须捕获。
 */
function getServerSessionSafe(): Promise<Session | null> {
  return getServerSession(authOptions).catch((e) => {
    console.error("[companion-settings] getServerSession:", e);
    return null;
  });
}

/** 以 userId 查库确认 ADMIN，避免旧 JWT 里未带 `role` 时误判为未授权 */
async function requireAdminSession(): Promise<Session | null> {
  const session = await getServerSessionSafe();
  if (!session?.user?.id) return null;
  if (session.user.role === "ADMIN") return session;
  try {
    const u = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (u?.role !== "ADMIN") return null;
  } catch (e) {
    console.error("[companion-settings] user lookup:", e);
    return null;
  }
  return session;
}

// GET — 读取当前 System Prompt
export async function GET() {
  const session = await requireAdminSession();
  if (!session) {
    return unauthorized();
  }

  const [systemPromptRow, thresholdRow] = await Promise.all([
    prisma.appSetting.findUnique({
      where: { key: AppSettingKeys.systemPrompt },
      select: { value: true, updatedAt: true },
    }),
    prisma.appSetting.findUnique({
      where: { key: AppSettingKeys.ragRerankScoreThreshold },
      select: { value: true, updatedAt: true },
    }),
  ]);

  const storedPrompt = systemPromptRow?.value;
  const storedThreshold = thresholdRow?.value;
  const thresholdParsed = normalizeStoredScoreThreshold(storedThreshold ?? "");
  return NextResponse.json({
    systemPrompt:
      storedPrompt && storedPrompt.trim()
        ? storedPrompt
        : DEFAULT_COMPANION_SYSTEM_PERSONA,
    ragRerankScoreThreshold:
      thresholdParsed === null
        ? DEFAULT_RAG_RERANK_SCORE_THRESHOLD
        : thresholdParsed,
    updatedAt: systemPromptRow?.updatedAt?.toISOString() ?? null,
    thresholdUpdatedAt: thresholdRow?.updatedAt?.toISOString() ?? null,
  });
}

// PUT — 保存 System Prompt
export async function PUT(request: NextRequest) {
  const session = await requireAdminSession();
  if (!session) {
    return unauthorized();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }

  const systemPromptRaw = (body as { systemPrompt?: unknown })?.systemPrompt;
  const thresholdRaw = (body as { ragRerankScoreThreshold?: unknown })
    ?.ragRerankScoreThreshold;

  const shouldUpdatePrompt = typeof systemPromptRaw === "string";
  const shouldUpdateThreshold =
    typeof thresholdRaw === "number" || typeof thresholdRaw === "string";

  if (!shouldUpdatePrompt && !shouldUpdateThreshold) {
    return NextResponse.json(
      { error: "至少需要提供 systemPrompt 或 ragRerankScoreThreshold" },
      { status: 400 },
    );
  }

  const updates: Array<Promise<{ updatedAt: Date }>> = [];
  let systemPrompt: string | undefined;
  let ragRerankScoreThreshold: number | undefined;

  if (shouldUpdatePrompt) {
    systemPrompt = normalizeStoredSystemPersona(systemPromptRaw);
    updates.push(
      prisma.appSetting.upsert({
        where: { key: AppSettingKeys.systemPrompt },
        create: { key: AppSettingKeys.systemPrompt, value: systemPrompt },
        update: { value: systemPrompt },
        select: { updatedAt: true },
      }),
    );
  }

  if (shouldUpdateThreshold) {
    const parsed =
      typeof thresholdRaw === "number"
        ? thresholdRaw
        : normalizeStoredScoreThreshold(String(thresholdRaw));
    if (
      parsed === null ||
      !Number.isFinite(parsed) ||
      parsed < 0 ||
      parsed > 1
    ) {
      return NextResponse.json(
        { error: "ragRerankScoreThreshold 必须是 0~1 的数字" },
        { status: 400 },
      );
    }
    ragRerankScoreThreshold = parsed;
    updates.push(
      prisma.appSetting.upsert({
        where: { key: AppSettingKeys.ragRerankScoreThreshold },
        create: {
          key: AppSettingKeys.ragRerankScoreThreshold,
          value: String(parsed),
        },
        update: { value: String(parsed) },
        select: { updatedAt: true },
      }),
    );
  }

  const [row1, row2] = await Promise.all(updates);
  const updatedAt =
    (row2 ?? row1)?.updatedAt?.toISOString?.() ?? new Date().toISOString();

  return NextResponse.json({
    ok: true,
    systemPrompt,
    ragRerankScoreThreshold,
    updatedAt,
  });
}
