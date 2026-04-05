import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const updateProfileSchema = z.object({
  username: z.string().min(1, "用户名不能为空"),
  password: z.string().optional(),
  displayName: z.string().optional(),
  bio: z.string().max(500).optional(),
  avatar: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  wechat: z.string().optional(),
  qq: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  github: z.string().optional(),
  twitter: z.string().optional(),
  weibo: z.string().optional(),
  bilibili: z.string().optional(),
  youtube: z.string().optional(),
  location: z.string().optional(),
  company: z.string().optional(),
  position: z.string().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授权访问" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { profile: true },
  });
  if (!user) return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _, ...safe } = user;
  return NextResponse.json(safe);
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授权访问" }, { status: 401 });
  }

  try {
    const data = updateProfileSchema.parse(await request.json());

    if (data.username) {
      const conflict = await prisma.user.findFirst({
        where: { username: data.username, NOT: { id: session.user.id } },
      });
      if (conflict) return NextResponse.json({ error: "用户名已被使用" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userData: any = { username: data.username };
    if (data.password?.trim()) {
      userData.password = await bcrypt.hash(data.password, 12);
    }

    const profileData = {
      displayName: data.displayName || null,
      bio: data.bio || null,
      avatar: data.avatar || null,
      email: data.email || null,
      phone: data.phone || null,
      wechat: data.wechat || null,
      qq: data.qq || null,
      website: data.website || null,
      github: data.github || null,
      twitter: data.twitter || null,
      weibo: data.weibo || null,
      bilibili: data.bilibili || null,
      youtube: data.youtube || null,
      location: data.location || null,
      company: data.company || null,
      position: data.position || null,
    };

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: { ...userData, profile: { upsert: { create: profileData, update: profileData } } },
      include: { profile: true },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...safe } = updated;
    return NextResponse.json({ message: "个人信息更新成功", user: safe });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "数据验证失败", details: error.issues }, { status: 400 });
    }
    console.error("更新个人信息失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
