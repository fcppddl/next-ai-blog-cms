import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const targetUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPasswordHash = await bcrypt.hash(
    process.env.ADMIN_PASSWORD || "admin123",
    12
  );

  const existingAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
  });

  if (!existingAdmin) {
    console.error("未找到 role 为 ADMIN 的用户，请先执行 npm run db:seed");
    process.exit(1);
  }

  if (existingAdmin.username !== targetUsername) {
    const conflict = await prisma.user.findUnique({
      where: { username: targetUsername },
    });
    if (conflict && conflict.id !== existingAdmin.id) {
      throw new Error(
        `ADMIN_USERNAME「${targetUsername}」已被其他账号占用，无法重置管理员用户名。`
      );
    }
  }

  const adminUser = await prisma.user.update({
    where: { id: existingAdmin.id },
    data: {
      username: targetUsername,
      password: adminPasswordHash,
      role: "ADMIN",
    },
  });

  console.log("✅ 已重置管理员用户名与密码:", adminUser.username);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
