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

/** 助手回复末尾的机器可读标记，用于解析是否参考站内文章及引用列表 */
export const ASSISTANT_RAG_META_MARKER = "__RAG_META__";

/** 每条回复必须声明 ragUsed：是否在撰写本回答时实际依据了站内文章材料（与后台是否做向量检索无关） */
const COMPANION_RAG_META_REMINDER_OPEN = `
【置顶提醒】系统依赖你回复最末尾的一行机器可读数据。无论回答长短、是否拒绝、是否仅打招呼，都不可省略该行。`;

const COMPANION_RAG_META_RULE = `
5. 【硬性要求】在全部面向用户的正文结束后，必须另起一行输出元数据，且该行整行格式唯一允许为（ragUsed 只能为英文小写 true 或 false）：
   ${ASSISTANT_RAG_META_MARKER}{"ragUsed":true,"articles":[{"slug":"示例slug","title":"示例标题"}]}
   或 ${ASSISTANT_RAG_META_MARKER}{"ragUsed":false,"articles":[]}
   - 该行必须以 ${ASSISTANT_RAG_META_MARKER} 开头，其后紧跟合法 JSON 对象，整行无其它前缀、后缀、空格说明；不要用 Markdown 代码块包裹该行。
   - 字段 ragUsed（必填，只能填英文小写 true / false）：表示你在写本段回答时是否实际依据了上方提供的「文章列表」或「检索到的相关内容」中的具体篇目。依据了任一篇的具体内容则 true；若完全未依据具体篇目（例如纯闲聊、只谈作者概况而未点名文章、或声明找不到信息），则 false。
   - 字段 articles：当 ragUsed 为 true 时，列出你实际依据的篇目（slug、title 与站内一致，最多 3 篇）；当 ragUsed 为 false 时，articles 必须为 []。
   - JSON 须可被标准 JSON.parse 解析：布尔值为 true/false，字符串内双引号须转义为 \\"，禁止尾逗号，该 JSON 不要换行截断。
   合法示例：
   ${ASSISTANT_RAG_META_MARKER}{"ragUsed":true,"articles":[{"slug":"welcome-to-my-blog","title":"欢迎来到我的博客"}]}
   ${ASSISTANT_RAG_META_MARKER}{"ragUsed":false,"articles":[]}

【发送前自检】最后一行是否恰好一条且以 ${ASSISTANT_RAG_META_MARKER} 开头？ragUsed 是否已根据「是否依据具体篇目」诚实填写？`;

function normalizeText(
  value: string | null | undefined,
  fallback = "未知",
): string {
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
    category: post.category
      ? { name: post.category.name, slug: post.category.slug }
      : null,
    tags: post.tags.map((item) => ({
      name: item.tag.name,
      slug: item.tag.slug,
    })),
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

/** 两种 companion 提示词共用的【作者信息】段落 */
function formatAuthorPromptSection(author: AuthorSummary): string {
  return `【作者信息】
- 昵称：${author.displayName}
- 用户名：${author.username}
- 简介：${author.bio}
- 所在地：${author.location}
- 公司：${author.company}
- 职位：${author.position}
- 已发布文章数：${author.postsCount}
- 对外链接：${author.profileLinks.length > 0 ? author.profileLinks.join("；") : "暂无"}`;
}

export function buildCompanionSystemPrompt(params: {
  mode: CompanionMode;
  author: AuthorSummary;
  articles: PublicArticleMeta[];
}): string {
  const { mode, author, articles } = params;
  const promptArticles = articles.slice(0, PROMPT_ARTICLE_LIMIT);

  const articleLines = promptArticles.map((article, index) => {
    const tagText = article.tags
      .slice(0, 4)
      .map((tag) => tag.name)
      .join("、");
    const categoryText = article.category?.name || "未分类";
    const publishedAtText = article.publishedAt
      ? article.publishedAt.slice(0, 10)
      : "未知日期";
    const readingTimeText = article.readingTime
      ? `${article.readingTime} 分钟`
      : "未知";
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

  return `你是个人博客网站的智能助手。你的语气亲切、有边界、不过度夸张。

${modeInstruction}

${formatAuthorPromptSection(author)}

【文章列表（公开内容）】
共 ${articles.length} 篇公开文章${articles.length > promptArticles.length ? `，以下展示最近 ${promptArticles.length} 篇：` : "："}
${articleLines.length > 0 ? articleLines.join("\n") : "当前暂无公开文章。"}

【回答规则】
1. 严禁编造不存在的文章、经历或外部事实。
2. 如果用户问到站点里没有的信息，要明确说明"我在站内信息里没找到"。
3. 推荐文章时给出标题和 slug，最多推荐 3 篇。
4. 回答使用简洁 Markdown，段落清晰，不输出 HTML 标签。
`;
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

export interface ParsedAssistantRagMeta {
  displayText: string;
  ragUsed: boolean;
  articles: Array<{ slug: string; title: string }>;
  parseOk: boolean;
}

/** 流式输出时：若末尾可能是标记的前缀则暂不输出该后缀，避免半段标记出现在界面上 */
export function visibleStreamingPrefixLen(
  text: string,
  marker: string,
): number {
  const idx = text.indexOf(marker);
  if (idx !== -1) return idx;
  const n = text.length;
  const max = Math.min(marker.length - 1, n);
  for (let len = max; len >= 1; len--) {
    if (marker.startsWith(text.slice(-len))) return n - len;
  }
  return n;
}

/** 流结束时的可见前缀长度（无完整标记则释放此前悬置的后缀） */
export function visibleFinalPrefixLen(text: string, marker: string): number {
  const idx = text.indexOf(marker);
  return idx !== -1 ? idx : text.length;
}

/** 从完整助手文本中剥离末尾 __RAG_META__ 行并解析 JSON */
export function parseAssistantRagMeta(
  fullText: string,
): ParsedAssistantRagMeta {
  const marker = ASSISTANT_RAG_META_MARKER;
  const idx = fullText.lastIndexOf(marker);
  if (idx === -1) {
    return {
      displayText: fullText.trimEnd(),
      ragUsed: false,
      articles: [],
      parseOk: false,
    };
  }
  const jsonPart = fullText.slice(idx + marker.length).trim();
  const displayText = fullText.slice(0, idx).trimEnd();
  try {
    const data = JSON.parse(jsonPart) as {
      ragUsed?: unknown;
      articles?: unknown;
    };
    const ragUsed = data.ragUsed === true;
    const articles: Array<{ slug: string; title: string }> = [];
    if (Array.isArray(data.articles)) {
      for (const a of data.articles) {
        if (!a || typeof a !== "object") continue;
        const o = a as { slug?: unknown; title?: unknown };
        const slug = typeof o.slug === "string" ? o.slug.trim() : "";
        if (!slug) continue;
        const title =
          typeof o.title === "string" && o.title.trim() ? o.title.trim() : slug;
        articles.push({ slug, title });
      }
    }
    return {
      displayText,
      ragUsed,
      articles: articles.slice(0, 5),
      parseOk: true,
    };
  } catch {
    return {
      displayText: fullText.trimEnd(),
      ragUsed: false,
      articles: [],
      parseOk: false,
    };
  }
}

export function buildRAGSystemPrompt(params: {
  mode: CompanionMode;
  author: AuthorSummary;
  chunks: RetrievedChunk[];
}): string {
  const { mode, author, chunks } = params;

  const modeInstruction =
    mode === "articles"
      ? `当前是"了解文章"模式：优先基于检索到的文章内容回答，推荐时给出标题和 slug。`
      : mode === "author"
        ? `当前是"了解作者"模式：优先介绍作者经历、兴趣、技术背景。`
        : `当前是"自由聊天"模式：可以日常对话，但优先结合检索到的内容回答。`;

  const chunkBlocks = chunks
    .map((chunk, i) => {
      const title = chunk.metadata.title || "未知文章";
      const slug = chunk.metadata.slug || "";
      return `--- 片段 ${i + 1}（来自《${title}》，slug: ${slug}）---\n${chunk.document}`;
    })
    .join("\n\n");

  return `你是个人博客网站的智能助手。你的语气亲切、有边界、不过度夸张。
  
${COMPANION_RAG_META_REMINDER_OPEN}

${modeInstruction}

${formatAuthorPromptSection(author)}

【检索到的相关内容】
${chunks.length > 0 ? chunkBlocks : "未检索到与问题直接相关的文章内容。"}

【回答规则】
1. 优先基于上方"检索到的相关内容"回答，不要编造其中没有的信息。
2. 如果检索内容不足以回答，明确说明"我在站内信息里没找到"，不要猜测。
3. 引用或推荐文章时给出标题和 slug，最多推荐 3 篇。
4. 回答使用简洁 Markdown，段落清晰，不输出 HTML 标签。
${COMPANION_RAG_META_RULE}`;
}
