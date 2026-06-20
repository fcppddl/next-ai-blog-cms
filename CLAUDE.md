# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 版本警告

**本项目使用 Next.js 16.2**，API、约定和文件结构与你的训练数据可能不同。编写任何 Next.js 相关代码前，先查阅 `node_modules/next/dist/docs/` 中的对应指南，注意废弃提示。

---

## 常用命令

```bash
npm run dev              # 开发服务器（Turbopack）
npm run build            # 生产构建
npm run start            # 启动生产构建
npm run lint             # ESLint
npm run type-check       # tsc --noEmit 类型检查

# 数据库（均通过 dotenv -e .env.local 加载环境变量）
npm run db:generate      # 生成 Prisma Client
npm run db:push          # Schema 推送到 SQLite（开发常用）
npm run db:migrate       # 创建并执行迁移
npm run db:seed          # 写入管理员账号和示例数据
npm run db:studio        # 打开 Prisma Studio
npm run db:reset         # 清空重建 + seed（破坏性）
npm run db:reset-admin   # 重置管理员密码
npm run db:push:seed     # seed + push 合并执行
```

生产环境：
```bash
npm run db:push:prod           # 生产数据库同步（--accept-data-loss）
npm run db:push:seed:prod      # 生产 seed + push
```

---

## 技术栈与关键约定

### 核心框架
- **Next.js 16.2 App Router**：所有页面和 API 都在 `app/` 下，使用 Route Handlers 和 Server Components。
- **React 19**：客户端交互组件。
- **TypeScript 5**：严格模式，路径别名 `@/*` 指向项目根目录（非 `src/`）。

### 样式系统
- **Tailwind CSS v4**：通过 `app/globals.css` 中的 `@import "tailwindcss"` 引入，**没有** `tailwind.config.ts`。
- 主题变量在 `@theme inline` 块中定义，CSS 变量在 `:root` / `.dark` 中赋值。
- 暗色模式通过 `@custom-variant dark (&:is(.dark *))` 实现。
- 使用 `@plugin "@tailwindcss/typography"` 提供文章 `prose` 样式。
- shadcn/ui 风格的组件在 `components/ui/`，使用 `cn()` 工具函数（`clsx` + `tailwind-merge`）。

### 数据库
- **SQLite** + **Prisma 6**，schema 位于 `prisma/schema.prisma`。
- `npm install` 后自动执行 `prisma generate`（`postinstall`）。
- Prisma 单例：`lib/prisma.ts` 在开发环境下缓存到 `globalThis`，避免热重载时创建多个实例。

### 认证与路由保护
- **NextAuth.js v4**（`lib/auth.ts`）：Credentials Provider + JWT 策略，仅允许 `role === "ADMIN"` 的用户登录。
- **`middleware.ts`**：使用 `withAuth` 拦截 `/admin/**`、`/api/admin/**` 和 `/login`。已登录用户访问 `/login` 时重定向到 `/admin`。
- JWT 载荷：`id`、`username`、`role`、`displayName`；session 有效期 30 天。
- 密码通过 `bcryptjs` 哈希比对。

---

## 项目架构

### 目录结构（关键路径）

```
app/                       # App Router：页面与 API Route Handlers
  admin/                   # 后台 CMS 页面（受 middleware 保护）
  posts/[slug]/            # 博客文章详情页（公开）
  api/
    auth/[...nextauth]/    # NextAuth 处理器
    ai/                    # AI 相关 API（流式 SSE + 压缩等）
      write/               #   AI 写作（generate、complete）
      companion/           #   AI 助手对话（chat/stream、context/compress、knowledge）
    admin/                 # 管理端 CRUD（需登录态）
components/
  admin/                   # 后台组件（编辑器、AI 助手侧栏、布局等）
  chat/                    # 前台 AI 聊天组件
  markdown/                # Markdown 渲染、代码块、Mermaid
  posts/                   # 文章列表、相关文章等
  ui/                      # shadcn/ui 基础组件
lib/
  auth.ts                  # NextAuth 配置
  prisma.ts                # Prisma 客户端单例
  utils.ts                 # cn() 等工具函数
  ai/                      # AI 子系统
    client.ts              #   AIClient 接口 + ChatClient（OpenAI 兼容 SDK 单例）
    knowledge-route.ts     #   意图路由：闲聊 vs 文章问答分类
    companion-settings.ts  #   AppSetting 持久化配置读取（如压缩阈值）
    rerank.ts              #   RAG 重排序（qwen3-rerank 兼容接口）
    prompts/               #   System prompt 模板
  chat/                    # 对话上下文管理
    context.ts             #   buildContext、trimContext、compressMessages、ContextManager
    index.ts               #   统一导出
  vector/                  # 向量子系统
    chunker.ts             #   文章分块
    store.ts               #   ChromaDB 客户端封装
    indexer.ts             #   向量索引构建
    embedding-dim.ts       #   嵌入维度配置
  editor/                  # Tiptap 编辑器 AI 扩展
  posts/                   # 已发布文章查询辅助
hooks/                     # React Hooks
types/                     # TypeScript 类型定义
  chat.ts                  #   Message、CoreMessage 类型
prisma/                    # Schema、migrations、seed
```

### API 约定
- **公开接口**：`app/api/<resource>/route.ts`，如 `posts`、`categories`、`profile`。
- **管理端接口**：`app/api/admin/<resource>/route.ts`，受 middleware 保护，需要有效会话。
- **AI 流式接口**：使用 `Content-Type: text/event-stream`（SSE），如写作生成/补全、助手对话流。
- **AI 非流式接口**：`POST /api/ai/companion/context/compress`（对话摘要压缩）。

### 认证流
1. 用户 POST 到 `/api/auth/...`（NextAuth 处理器）。
2. `lib/auth.ts` 中的 `authorize` 查询 `User` 表，仅允许 `role === "ADMIN"`。
3. 成功后 JWT 中写入 `id`、`username`、`role`、`displayName`。
4. `middleware.ts` 检查 `/admin/**` 和 `/api/admin/**` 路径的 token。
5. Server Component / Route Handler 中通过 `getServerSession(authOptions)` 获取会话。

---

## AI 子系统详解

### AIClient（`lib/ai/client.ts`）
- `getAIClient()` 返回全局单例 `ChatClient`，基于 OpenAI 兼容 SDK。
- 环境变量：`CHAT_API_KEY`（必需）、`CHAT_BASE_URL`、`CHAT_MODEL`。
- 提供 `chat()`（非流式）、`chatStream()`（SSE 流式，默认开启 `enable_search`）、`embed()`（向量嵌入）。
- **`embed()` 自动选择**：若配置 `EMBEDDING_MODEL`，使用 DashScope 兼容 Embeddings API；否则回退到 Ollama HTTP API。
- **注意**：对话用 `compatible-mode` 路径，重排序用 `compatible-api` 路径，两者不同，不可混用。

### 对话上下文管理（`lib/chat/context.ts`）
核心概念：**滚动记忆锚点**——`Message.summary` 字段表示该条消息之前的历史已压缩进摘要。

主要函数和常量：
| 函数/常量 | 作用 |
|-----------|------|
| `buildContext(systemPrompt, messages)` | 组装上下文：系统提示 → 摘要（若存在）→ 仅锚点之后的消息 |
| `trimContext(messages, prefixLength, options)` | Token 超限时从对话段**头部**逐条删除，绝不删除系统提示和摘要 |
| `compressMessages(messages, newSummary)` | 清空旧摘要，将新摘要写在锚点+6 偏移的消息上 |
| `ContextManager` | 封装 build + trim 的类，便于 Route 中单例使用 |
| `COMPRESS_MESSAGE_THRESHOLD = 10` | 锚点后满 10 条触发压缩 |
| `COMPRESS_INPUT_ROUNDS = 3` | 摘要模型参考最近 3 轮（6 条） |

### RAG 检索流程（知识路由）
1. **意图分类**：`lib/ai/knowledge-route.ts` 的 `classifyCompanionKnowledgeIntent()` 在流式对话前判定 `chit_chat` / `article_qa`。
2. **向量检索**：若为 `article_qa`，从 ChromaDB 检索相关文章块。
3. **重排序**（可选）：`lib/ai/rerank.ts` 的 `rerankWithQwen3Rerank()` 使用 qwen3-rerank 对召回结果排序。受 `RAG_RERANK_*` 环境变量控制。
4. **上下文注入**：检索结果注入到 `buildContext` 的 system prompt 中。
5. **引用来源**：前端聊天组件可展示引用（白名单过滤 RAG citations）。

### 文章向量索引
- `lib/vector/chunker.ts`：将文章按段落/语义分块。
- `lib/vector/store.ts`：ChromaDB 客户端封装，管理 collection。
- `lib/vector/indexer.ts`：协调整篇文章的嵌入生成和存储。
- `PostVectorIndex` 模型（Prisma）记录每篇文章的向量索引状态。

### AI 编辑器扩展
- `lib/editor/ai-completion-extension.ts`：Tiptap 的 AI 补全扩展，调用 `/api/ai/write/complete`。
- 后台编辑器在 `components/admin/tiptap-editor.tsx`，支持 Markdown 与富文本双向流转（`tiptap-markdown`）。

---

## 数据模型要点

- **User** / **Profile**：一对一，管理员通过 `role === "ADMIN"` 识别。
- **Post**：文章，通过 `authorId` 关联 User，通过 `categoryId` 关联 Category，通过 `PostTag` 多对多关联 Tag。
- **PostVectorIndex**：一对一关联 Post，记录向量索引状态（`vectorId`、`chunkCount`）。
- **AppSetting**：键值对存储站点级配置（对话压缩阈值、RAG 分数阈值等），业务键在 `lib/ai/companion-settings.ts` 约定。
- **Image**：文章图片，通过 `postId` 关联 Post，区分 `COVER` / `CONTENT` 类型。文件存储在 `public/images/posts/{slug}/`。

---

## 环境变量

开发环境变量放在 `.env.local`，生产用 `.env.production` 或进程管理器注入。`.env.example` 包含所有可用变量的完整说明。关键变量：

- `DATABASE_URL`：SQLite 文件路径（默认 `file:./prisma/dev.db`）
- `NEXTAUTH_SECRET`、`NEXTAUTH_URL`：认证必需
- `ADMIN_USERNAME`、`ADMIN_PASSWORD`：seed 时创建管理员
- `CHAT_API_KEY`、`CHAT_BASE_URL`、`CHAT_MODEL`：AI 对话功能
- `OLLAMA_BASE_URL` / `EMBEDDING_*`：向量嵌入（二选一）
- `CHROMADB_HOST`、`CHROMADB_PORT`：向量数据库
- `RAG_RERANK_*`：重排序（可选）
- `COMPANION_MAX_CONTEXT_TOKENS`：对话上下文 token 上限（默认 8192）

---

## 部署

- `ecosystem.config.js`：PM2 配置。
- `nginx.conf.template`：反向代理模板（含 SSE 长连接超时配置）。
- 确保生产环境 `NEXTAUTH_URL` 与公网域名一致，`AUTH_TRUST_HOST=true`。
