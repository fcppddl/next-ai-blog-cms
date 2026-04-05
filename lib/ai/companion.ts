import { prisma } from "@/lib/prisma";

export type CompanionMode = "articles" | "author" | "free";

export interface PublicArticleMeta {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  publishedAt: string | null;
  readingTime: number | null;
  category: { name: string; slug: string } | null;
  tags: Array<{ name: string; slug: string }>;
}

export interface AuthorSummary {
  displayName: string;
  username: string;
  bio: string;
  location: string;
  company: string;
  position: string;
  profileLinks: string[];
  postsCount: number;
}

const PROMPT_ARTICLE_LIMIT = 120;

function normalizeText(value: string | null | undefined, fallback = "未知"): string {
  const cleaned = (value || "").trim();
  return cleaned || fallback;
}

export async function getPublicArticleMeta(): Promise<PublicArticleMeta[]> {
  const posts = await prisma.post.findMany({
    where: { published: true },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      publishedAt: true,
      readingTime: true,
      category: { select: { name: true, slug: true } },
      tags: { select: { tag: { select: { name: true, slug: true } } } },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });

  return posts.map((post) => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: (post.excerpt || "").slice(0, 220),
    publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
    readingTime: post.readingTime ?? null,
    category: post.category ? { name: post.category.name, slug: post.category.slug } : null,
    tags: post.tags.map((item) => ({ name: item.tag.name, slug: item.tag.slug })),
  }));
}

export async function getAuthorSummary(): Promise<AuthorSummary> {
  const [admin, postsCount] = await Promise.all([
    prisma.user.findFirst({
      where: { role: "ADMIN" },
      select: {
        username: true,
        profile: {
          select: {
            displayName: true,
            bio: true,
            location: true,
            company: true,
            position: true,
            website: true,
            github: true,
            bilibili: true,
            weibo: true,
            youtube: true,
          },
        },
      },
    }),
    prisma.post.count({ where: { published: true } }),
  ]);

  const profile = admin?.profile;
  const links = [
    profile?.website ? `个人网站: ${profile.website}` : "",
    profile?.github ? `GitHub: ${profile.github}` : "",
    profile?.bilibili ? `Bilibili: ${profile.bilibili}` : "",
    profile?.weibo ? `微博: ${profile.weibo}` : "",
    profile?.youtube ? `YouTube: ${profile.youtube}` : "",
  ].filter(Boolean);

  return {
    displayName: normalizeText(profile?.displayName, "博主"),
    username: normalizeText(admin?.username, "admin"),
    bio: normalizeText(profile?.bio, "热爱技术的开发者。"),
    location: normalizeText(profile?.location, "中国"),
    company: normalizeText(profile?.company, "互联网行业"),
    position: normalizeText(profile?.position, "开发工程师"),
    profileLinks: links,
    postsCount,
  };
}

export function buildCompanionSystemPrompt(params: {
  mode: CompanionMode;
  author: AuthorSummary;
  articles: PublicArticleMeta[];
}): string {
  const { mode, author, articles } = params;
  const promptArticles = articles.slice(0, PROMPT_ARTICLE_LIMIT);

  const articleLines = promptArticles.map((article, index) => {
    const tagText = article.tags.slice(0, 4).map((tag) => tag.name).join("、");
    const categoryText = article.category?.name || "未分类";
    const publishedAtText = article.publishedAt ? article.publishedAt.slice(0, 10) : "未知日期";
    const readingTimeText = article.readingTime ? `${article.readingTime} 分钟` : "未知";
    const excerptText = article.excerpt
      ? `；摘要：${article.excerpt.slice(0, 80).replace(/\s+/g, " ")}`
      : "";
    return `${index + 1}. ${article.title}（slug: ${article.slug}，发布日期: ${publishedAtText}，阅读: ${readingTimeText}，分类: ${categoryText}${tagText ? `，标签: ${tagText}` : ""}${excerptText}）`;
  });

  const modeInstruction =
    mode === "articles"
      ? `当前是"了解文章"模式：优先基于文章列表回答，推荐时给出标题和 slug。`
      : mode === "author"
        ? `当前是"了解作者"模式：优先介绍作者经历、兴趣、技术背景。`
        : `当前是"自由聊天"模式：可以日常对话，但保持友好并尽量结合站点内容。`;

  return `你是网站前台的智能助手「小春」。你的语气亲切、有边界、不过度夸张。

${modeInstruction}

【作者信息】
- 昵称：${author.displayName}
- 用户名：${author.username}
- 简介：${author.bio}
- 所在地：${author.location}
- 公司：${author.company}
- 职位：${author.position}
- 已发布文章数：${author.postsCount}
- 对外链接：${author.profileLinks.length > 0 ? author.profileLinks.join("；") : "暂无"}

【文章列表（公开内容）】
共 ${articles.length} 篇公开文章${articles.length > promptArticles.length ? `，以下展示最近 ${promptArticles.length} 篇：` : "："}
${articleLines.length > 0 ? articleLines.join("\n") : "当前暂无公开文章。"}

【回答规则】
1. 严禁编造不存在的文章、经历或外部事实。
2. 如果用户问到站点里没有的信息，要明确说明"我在站内信息里没找到"。
3. 推荐文章时给出标题和 slug，最多推荐 3 篇。
4. 回答使用简洁 Markdown，段落清晰，不输出 HTML 标签。`;
}

// ─── RAG ────────────────────────────────────────────────────────────────────

export interface RetrievedChunk {
  id: string;
  document: string;
  score: number;
  metadata: {
    postId?: string;
    title?: string;
    slug?: string;
    category?: string;
    tags?: string;
    chunkIndex?: number;
  };
}

export function buildRAGSystemPrompt(params: {
  mode: CompanionMode;
  author: AuthorSummary;
  chunks: RetrievedChunk[];
  totalArticles: number;
}): string {
  const { mode, author, chunks, totalArticles } = params;

  const modeInstruction =
    mode === "articles"
      ? `当前是"了解文章"模式：优先基于检索到的文章内容回答，推荐时给出标题和 slug。`
      : mode === "author"
        ? `当前是"了解作者"模式：优先介绍作者经历、兴趣、技术背景。`
        : `当前是"自由聊天"模式：可以日常对话，但优先结合检索到的内容回答。`;

  // 去重：同一篇文章只取最高分的 chunk 做来源引用
  const seenSlugs = new Set<string>();
  const sourceLines: string[] = [];
  for (const chunk of chunks) {
    const slug = chunk.metadata.slug;
    if (slug && !seenSlugs.has(slug)) {
      seenSlugs.add(slug);
      sourceLines.push(`- 《${chunk.metadata.title || slug}》（slug: ${slug}）`);
    }
  }

  const chunkBlocks = chunks
    .map((chunk, i) => {
      const title = chunk.metadata.title || "未知文章";
      const slug = chunk.metadata.slug || "";
      return `--- 片段 ${i + 1}（来自《${title}》，slug: ${slug}）---\n${chunk.document}`;
    })
    .join("\n\n");

  return `你是网站前台的智能助手「小春」。你的语气亲切、有边界、不过度夸张。

${modeInstruction}

【作者信息】
- 昵称：${author.displayName}
- 用户名：${author.username}
- 简介：${author.bio}
- 所在地：${author.location}
- 公司：${author.company}
- 职位：${author.position}
- 已发布文章数：${totalArticles}
- 对外链接：${author.profileLinks.length > 0 ? author.profileLinks.join("；") : "暂无"}

【检索到的相关内容】
${chunks.length > 0 ? chunkBlocks : "未检索到与问题直接相关的文章内容。"}

【涉及文章来源】
${sourceLines.length > 0 ? sourceLines.join("\n") : "无"}

【回答规则】
1. 优先基于上方"检索到的相关内容"回答，不要编造其中没有的信息。
2. 如果检索内容不足以回答，明确说明"我在站内信息里没找到"，不要猜测。
3. 引用或推荐文章时给出标题和 slug，最多推荐 3 篇。
4. 回答使用简洁 Markdown，段落清晰，不输出 HTML 标签。`;
}
