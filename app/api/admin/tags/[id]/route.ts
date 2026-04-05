import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateTagSchema = z.object({
  name: z.string().min(1).max(30).optional(),
  slug: z.string().min(1).max(30).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限访问" }, { status: 403 });
  }
  const { id } = await params;

  try {
    const data = updateTagSchema.parse(await request.json());
    const tag = await prisma.tag.update({ where: { id }, data });
    return NextResponse.json(tag);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "数据验证失败" }, { status: 400 });
    }
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限访问" }, { status: 403 });
  }
  const { id } = await params;
  const existing = await prisma.tag.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "标签不存在" }, { status: 404 });
  await prisma.tag.delete({ where: { id } });
  return NextResponse.json({ message: "标签删除成功" });
}
