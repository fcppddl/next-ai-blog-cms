import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_COMPANION_SYSTEM_PERSONA } from "@/lib/ai/companion";
import {
  AppSettingKeys,
  normalizeStoredSystemPersona,
} from "@/lib/ai/companion-settings";
import type { Session } from "next-auth";

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

  const row = await prisma.appSetting.findUnique({
    where: { key: AppSettingKeys.systemPrompt },
    select: { value: true, updatedAt: true },
  });
  const stored = row?.value;
  return NextResponse.json({
    systemPrompt: stored && stored.trim() ? stored : DEFAULT_COMPANION_SYSTEM_PERSONA,
    updatedAt: row?.updatedAt?.toISOString() ?? null,
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

  const raw = (body as { systemPrompt?: unknown })?.systemPrompt;
  if (typeof raw !== "string") {
    return NextResponse.json(
      { error: "systemPrompt 必须是字符串" },
      { status: 400 },
    );
  }

  const systemPrompt = normalizeStoredSystemPersona(raw);

  const row = await prisma.appSetting.upsert({
    where: { key: AppSettingKeys.systemPrompt },
    create: { key: AppSettingKeys.systemPrompt, value: systemPrompt },
    update: { value: systemPrompt },
    select: { updatedAt: true },
  });

  return NextResponse.json({
    ok: true,
    systemPrompt,
    updatedAt: row.updatedAt.toISOString(),
  });
}
