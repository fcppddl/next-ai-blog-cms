import { prisma } from "@/lib/prisma";

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

/** 默认 System Prompt 人设首段；与 `app_settings.companion_system_prompt` 未配置时的运行时回退、以及 seed 写入内容一致 */
export const DEFAULT_COMPANION_SYSTEM_PERSONA =
  "你是个人博客网站的智能助手。你的语气亲切、有边界、不过度夸张。";

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
  author: AuthorSummary;
  articles: PublicArticleMeta[];
  /** 系统提示最前部的人设/语气段，一般来自 `app_settings` 或 `DEFAULT_COMPANION_SYSTEM_PERSONA` */
  systemPersona: string;
}): string {
  const { author, articles, systemPersona } = params;
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

  return `${systemPersona}

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

/**
 * 闲聊/轻量模式：不注入全站文章目录；结合下方作者信息与（若有）当前页上下文使用。
 * 不触发向量库检索时不附加 __RAG_META__ 要求。
 */
export function buildChitChatSystemPrompt(params: {
  author: AuthorSummary;
  systemPersona: string;
  articleTitle?: string;
  articleSlug?: string;
  articleBody?: string;
}): string {
  const { author, systemPersona, articleTitle, articleSlug, articleBody } =
    params;

  return `${systemPersona}

${formatAuthorPromptSection(author)}

${
  articleTitle || articleSlug || articleBody
    ? `【当前文章（页面上下文）】
- 标题：${articleTitle || "未知"}
- slug：${articleSlug || ""}
- 正文：${articleBody || "（正文为空）"}
`
    : ""
}
【回答规则】
1. 你当前未持有「全站已发布文章标题+摘要」列表，不要编造不存在的篇目与 slug。若用户需要系统推荐多篇文章，可建议其使用界面上「推荐文章」快捷问题。
2. 如用户问到你不知道的细节，直说在提供的信息中未找到，不要猜。
3. 回答使用简洁 Markdown，不输出 HTML 标签。
`;
}

/** 首页-推荐文章按钮：只注入「已发布文章标题+摘要」，不注入作者信息，不触发 RAG。 */
export function buildPublishedArticleCatalogSystemPrompt(params: {
  articles: PublicArticleMeta[];
  systemPersona: string;
}): string {
  const { articles, systemPersona } = params;
  const promptArticles = articles.slice(0, PROMPT_ARTICLE_LIMIT);
  const lines = promptArticles.map((a, i) => {
    const ex = a.excerpt ? a.excerpt.replace(/\s+/g, " ").trim() : "";
    return `${i + 1}. ${a.title}（slug: ${a.slug}${ex ? `；摘要：${ex}` : ""}）`;
  });

  return `${systemPersona}

【文章标题与摘要（已发布）】
共 ${articles.length} 篇：
${lines.length ? lines.join("\n") : "当前暂无公开文章。"}

【回答规则】
1. 不要编造不存在的文章或摘要内容；如果用户问到正文细节而摘要不足以支持，请明确说明无法从摘要判断。
2. 推荐时给出标题与 slug，最多 3 篇，并说明推荐理由。
3. 回答使用简洁 Markdown，不输出 HTML 标签。
`;
}

/** 文章详情页：仅注入「当前文章正文」，不注入作者信息、不注入全站目录、不触发 RAG。 */
export function buildCurrentArticleBodyOnlySystemPrompt(params: {
  systemPersona: string;
  articleTitle: string;
  articleSlug: string;
  articleBody: string;
}): string {
  const { systemPersona, articleTitle, articleSlug, articleBody } = params;
  return `${systemPersona}

当前用户正在阅读一篇文章。请只基于下面提供的「文章正文」回答，不要引入站内其它文章、作者信息或外部事实。

【当前文章】
- 标题：${articleTitle}
- slug：${articleSlug}
- 正文：${articleBody || "（正文为空）"}

【回答规则】
1. 不要编造正文里没有的内容；如果正文不足以回答，就明确说明。
2. 回答使用简洁 Markdown，不输出 HTML 标签。
`;
}

/** 非闲聊且需要 RAG：只注入检索片段（rag 相关信息），不注入作者/全站目录/当前页正文。 */
export function buildRAGOnlySystemPrompt(params: {
  chunks: RetrievedChunk[];
  systemPersona: string;
  articleTitle?: string;
  articleSlug?: string;
  articleBody?: string;
}): string {
  const { chunks, systemPersona, articleTitle, articleSlug, articleBody } =
    params;

  const chunkBlocks = chunks
    .map((chunk, i) => {
      const title = chunk.metadata.title || "未知文章";
      const slug = chunk.metadata.slug || "";
      return `--- 片段 ${i + 1}（来自《${title}》，slug: ${slug}）---\n${chunk.document}`;
    })
    .join("\n\n");

  return `${systemPersona}

${COMPANION_RAG_META_REMINDER_OPEN}

${
  articleTitle || articleSlug || articleBody
    ? `【当前文章（页面上下文）】
- 标题：${articleTitle || "未知"}
- slug：${articleSlug || ""}
- 正文：${articleBody || "（正文为空）"}
`
    : ""
}
【检索到的相关内容】
${chunks.length > 0 ? chunkBlocks : "未检索到与问题直接相关的文章内容。"}

【回答规则】
1. 只基于上方检索片段回答，不要编造片段中没有的信息。
2. 如果检索内容不足以回答，明确说明"我在检索到的站内内容里没找到"。
3. 引用或推荐文章时给出标题和 slug，最多推荐 3 篇。
4. 回答使用简洁 Markdown，不输出 HTML 标签。
${COMPANION_RAG_META_RULE}`;
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
  author: AuthorSummary;
  chunks: RetrievedChunk[];
  systemPersona: string;
}): string {
  const { author, chunks, systemPersona } = params;

  const chunkBlocks = chunks
    .map((chunk, i) => {
      const title = chunk.metadata.title || "未知文章";
      const slug = chunk.metadata.slug || "";
      return `--- 片段 ${i + 1}（来自《${title}》，slug: ${slug}）---\n${chunk.document}`;
    })
    .join("\n\n");

  return `${systemPersona}
  
${COMPANION_RAG_META_REMINDER_OPEN}

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
