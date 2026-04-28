import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  DEFAULT_COMPANION_SYSTEM_PERSONA,
  DEFAULT_RAG_RERANK_SCORE_THRESHOLD,
} from "../lib/ai/companion";
import { AppSettingKeys } from "../lib/ai/companion-settings";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 开始数据库种子...");

  await prisma.appSetting.upsert({
    where: { key: AppSettingKeys.systemPrompt },
    update: {},
    create: {
      key: AppSettingKeys.systemPrompt,
      value: DEFAULT_COMPANION_SYSTEM_PERSONA,
    },
  });
  console.log("✅ 对话默认 System Prompt 已写入 app_settings");

  await prisma.appSetting.upsert({
    where: { key: AppSettingKeys.ragRerankScoreThreshold },
    update: {},
    create: {
      key: AppSettingKeys.ragRerankScoreThreshold,
      value: String(DEFAULT_RAG_RERANK_SCORE_THRESHOLD),
    },
  });
  console.log(
    `✅ RAG rerank 阈值默认值已写入 app_settings（${DEFAULT_RAG_RERANK_SCORE_THRESHOLD}）`,
  );

  // 创建默认管理员用户
  const adminPassword = await bcrypt.hash(
    process.env.ADMIN_PASSWORD || "admin123",
    12,
  );

  const adminUser = await prisma.user.upsert({
    where: { username: process.env.ADMIN_USERNAME || "admin" },
    update: {},
    create: {
      username: process.env.ADMIN_USERNAME || "admin",
      password: adminPassword,
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

  console.log("✅ 创建管理员用户:", adminUser.username);

  // 创建默认分类
  const categories = [
    {
      name: "AI",
      slug: "ai",
      description: "人工智能、大模型、机器学习相关内容",
      icon: "🤖",
    },
    {
      name: "前端",
      slug: "frontend",
      description: "前端开发技术、框架、工具分享",
      icon: "🌐",
    },
    {
      name: "编程",
      slug: "programming",
      description: "编程基础知识、算法、数据结构",
      icon: "💻",
    },
    {
      name: "随笔",
      slug: "essays",
      description: "生活感悟、思考随笔、日常记录",
      icon: "📝",
    },
  ];

  for (const categoryData of categories) {
    const category = await prisma.category.upsert({
      where: { slug: categoryData.slug },
      update: {
        name: categoryData.name,
        description: categoryData.description,
        icon: categoryData.icon,
      },
      create: categoryData,
    });
    console.log("✅ 创建分类:", category.name);
  }

  // 创建示例标签
  const tags = [
    { name: "TypeScript", slug: "ts" },
    { name: "Next.js", slug: "nextjs" },
    { name: "React", slug: "react" },
    { name: "Node.js", slug: "node" },
    { name: "Prisma", slug: "prisma" },
    { name: "Prompt", slug: "prompt" },
    { name: "RAG", slug: "rag" },
    { name: "Agent", slug: "agent" },
  ];

  for (const tagData of tags) {
    const tag = await prisma.tag.upsert({
      where: { slug: tagData.slug },
      update: { name: tagData.name },
      create: tagData,
    });
    console.log("✅ 创建标签:", tag.name);
  }

  // 创建欢迎文章
  const aiCategory = await prisma.category.findUnique({
    where: { slug: "ai" },
  });
  const nextjsTag = await prisma.tag.findUnique({ where: { slug: "nextjs" } });
  const tsTag = await prisma.tag.findUnique({ where: { slug: "ts" } });

  if (aiCategory) {
    const welcomePost = await prisma.post.upsert({
      where: { slug: "welcome-to-my-blog" },
      update: {},
      create: {
        title: "欢迎来到我的博客",
        slug: "welcome-to-my-blog",
        content: `# 欢迎来到我的博客 👋

这是一个基于 **Next.js** 和 **Prisma** 构建的全栈 AI 博客系统。

## 功能特性

- 📝 **Markdown 编辑器**：支持富文本编辑
- 🤖 **AI 写作助手**：集成 AI 功能辅助创作
- 🔍 **RAG 智能问答**：基于文章内容的智能对话
- 🏷️ **分类标签**：灵活的内容组织方式
- 🖼️ **图片管理**：完善的图片上传系统

欢迎探索，Happy Coding! 🚀`,
        excerpt:
          "欢迎来到这个基于 Next.js 构建的 AI 博客系统，支持 AI 写作助手和 RAG 智能问答。",
        published: true,
        featured: true,
        categoryId: aiCategory.id,
        authorId: adminUser.id,
      },
    });
    console.log("✅ 创建文章:", welcomePost.title);

    if (nextjsTag) {
      await prisma.postTag.upsert({
        where: {
          postId_tagId: { postId: welcomePost.id, tagId: nextjsTag.id },
        },
        update: {},
        create: { postId: welcomePost.id, tagId: nextjsTag.id },
      });
    }
    if (tsTag) {
      await prisma.postTag.upsert({
        where: { postId_tagId: { postId: welcomePost.id, tagId: tsTag.id } },
        update: {},
        create: { postId: welcomePost.id, tagId: tsTag.id },
      });
    }
  }

  console.log("🎉 数据库种子完成!");
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
