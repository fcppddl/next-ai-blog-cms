// Docker 首次启动：无用户时创建管理员（不替代 prisma/seed 的完整种子）
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.user.count();
  if (count > 0) return;

  const username = process.env.ADMIN_USERNAME?.trim() || "admin";
  const password = process.env.ADMIN_PASSWORD?.trim() || "admin123";
  const hash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      username,
      password: hash,
      role: "ADMIN",
      profile: {
        create: {
          displayName: "博主",
          bio: "这里是博主的个人简介",
          avatar: "/images/avatar.jpeg",
        },
      },
    },
  });

  console.log("[docker-init] 已创建默认管理员:", username);
}

main()
  .catch((e) => {
    console.error("[docker-init]", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
