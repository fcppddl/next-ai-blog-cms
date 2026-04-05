# Next.js AI Blog CMS

一个基于 Next.js 16 + React 19 构建的全功能 AI 博客内容管理系统，集成 RAG 智能问答、AI 写作助手、向量检索等能力。

## 技术栈

| 层次 | 技术 |
|------|------|
| 框架 | Next.js 16.2.1 (App Router) |
| UI | React 19、shadcn/ui、Tailwind CSS v4 |
| 数据库 | SQLite + Prisma 6 ORM |
| 认证 | NextAuth.js v4（JWT 策略） |
| AI 对话 | Kimi API（OpenAI SDK 兼容） |
| 向量嵌入 | Ollama + nomic-embed-text |
| 向量数据库 | ChromaDB |
| 字体 | Geist（npm 包，非 Google Fonts） |

---

## 目录结构

```
next-ai-blog-cms/
├── app/
│   ├── (public)          # 公开博客前台页面
│   ├── admin/            # 管理后台（受保护路由）
│   └── api/              # API 路由
│       ├── admin/        # 后台 CRUD 接口
│       ├── ai/           # AI 功能接口
│       │   ├── companion/   # RAG 问答
│       │   └── write/       # 写作助手
│       ├── auth/         # NextAuth 认证
│       └── posts/        # 公开文章接口
├── components/
│   ├── admin/            # 后台组件（编辑器、AI 助手等）
│   ├── chat/             # 浮窗聊天组件
│   ├── home/             # 首页视觉效果
│   ├── layout/           # 公共/后台布局
│   ├── markdown/         # Markdown 渲染器
│   ├── posts/            # 文章列表组件
│   └── ui/               # shadcn/ui 基础组件
├── lib/
│   ├── ai/               # AI 客户端、提示词、RAG 核心
│   └── vector/           # 向量分块、存储、索引
├── prisma/
│   ├── schema.prisma     # 数据库模型定义
│   └── seed.ts           # 初始化脚本
├── hooks/                # 自定义 Hooks
├── middleware.ts          # 路由权限中间件
├── ecosystem.config.js   # PM2 进程配置
└── nginx.conf.template   # Nginx 反向代理模板
```

---

## 快速开始

### 前置依赖

- Node.js 20+
- Ollama（本地运行，用于向量嵌入）
- Docker（用于 ChromaDB）

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制并编辑环境变量文件：

```bash
cp .env.example .env.local
```

`.env.local` 必填项：

```bash
# 数据库
DATABASE_URL="file:./prisma/dev.db"

# NextAuth
NEXTAUTH_SECRET="your-secret-key-at-least-32-characters"
NEXTAUTH_URL="http://localhost:3000"

# 初始管理员账号
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="your-password"

# AI 写作（Kimi API）
KIMI_API_KEY="your-kimi-api-key"
KIMI_BASE_URL="https://api.moonshot.cn/v1"
KIMI_MODEL="moonshot-v1-32k"

# RAG 向量嵌入（Ollama）
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_EMBEDDING_MODEL="nomic-embed-text"

# 向量数据库（ChromaDB）
CHROMADB_HOST="localhost"
CHROMADB_PORT="8000"
```

### 3. 初始化数据库

```bash
npm run db:push    # 同步 schema 到数据库
npm run db:seed    # 写入初始管理员账号及示例数据
```

### 4. 启动外部服务（RAG 功能可选）

```bash
# Ollama 嵌入模型
ollama serve
ollama pull nomic-embed-text

# ChromaDB 向量数据库
docker run -d --name chromadb -p 8000:8000 chromadb/chroma:latest
```

### 5. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看博客前台。
访问 [http://localhost:3000/admin](http://localhost:3000/admin) 进入管理后台（需登录）。

---

## 数据库命令

```bash
npm run db:generate   # 生成 Prisma Client
npm run db:push       # 将 schema 同步到数据库（开发环境）
npm run db:migrate    # 生成并运行迁移文件
npm run db:seed       # 初始化种子数据
npm run db:studio     # 打开 Prisma Studio 可视化界面
npm run db:reset      # 重置数据库并重新播种
```

---

## 项目功能

### 阶段一：项目基础搭建

- **Prisma 6 + SQLite**：定义 `User`、`Profile`、`Post`、`Category`、`Tag`、`PostTag`、`PostVectorIndex`、`Image` 数据模型
- **shadcn/ui 组件库**：Button、Card、Dialog、Select、Switch、Tabs、Form 等完整组件集
- **Tailwind CSS v4**：通过 CSS `@import` 配置（无 `tailwind.config.ts`），集成 `tailwindcss-animate`
- **Geist 字体**：通过 `geist` npm 包加载（不依赖 Google Fonts 网络请求）
- **工具函数**：`cn()`（clsx + tailwind-merge）、Prisma Client 单例

### 阶段二：身份认证

- **NextAuth.js v4**：Credentials Provider + JWT 策略，token/session 携带 `role`、`username`
- **bcryptjs** 密码哈希比对
- **路由保护中间件**：`middleware.ts` 使用 `withAuth` 拦截 `/admin` 和 `/api/admin` 路由，仅 `ADMIN` 角色可访问
- **登录页面**：`/login`，支持用户名/密码表单提交

### 阶段三：公开博客前台

- **首页** `/`：精选文章、最新文章列表、分页加载
- **文章详情** `/posts/[slug]`：Markdown 渲染、阅读时长、浏览量统计
- **关于页面** `/about`：作者资料展示
- **Markdown 渲染**：`react-markdown` + `remark-gfm` + `rehype-highlight`，支持代码高亮（highlight.js）、Mermaid 图表、GFM 语法
- **主题切换**：自定义 `ThemeProvider`，支持亮色/暗色模式
- **公开 API**：文章列表（分页/过滤）、文章详情、相关文章、分类列表、作者资料

### 阶段四：管理后台 CMS

- **仪表盘**：文章总数、已发布数、草稿数、总浏览量统计卡片
- **文章管理**：列表（搜索/状态过滤/分页）、新建/编辑/删除、一键切换发布状态
- **Markdown 编辑器**：`@uiw/react-md-editor`，支持全屏模式、实时预览
- **封面图管理**：图片上传（按文章 slug 分目录 `/public/images/posts/{slug}/`）、图片选择器
- **分类管理**：CRUD、颜色标签、文章统计
- **标签管理**：CRUD、颜色标签、文章统计
- **个人资料**：显示名、简介、头像、社交链接（GitHub、Twitter、微博等）
- **Admin API**：文章/分类/标签/图片/资料的完整 RESTful 接口

### 阶段五：AI 写作助手

> 依赖：Kimi API Key（`KIMI_API_KEY`）

- **AI 客户端**（`lib/ai/client.ts`）：基于 OpenAI SDK 对接 Kimi API，支持普通对话与 SSE 流式对话；`ollamaEmbed()` 提供文本向量化
- **提示词模块**（`lib/ai/prompts/write.ts`）：七种写作指令——标题生成、摘要生成、标签推荐、分类推荐、文章大纲、内容扩写、全文润色
- **生成 API**（`POST /api/ai/write/generate`）：受保护接口，按 `type` 分发提示词，调用 Kimi 返回结构化结果
- **AI 助手组件**（`components/admin/ai-assistant.tsx`）：集成在编辑器顶部的下拉按钮，支持六种操作，流式展示生成结果，一键回填到编辑器

### 阶段六：RAG 智能问答

> 依赖：Ollama（`nomic-embed-text`）+ ChromaDB

**向量索引流程：**

1. `lib/vector/chunker.ts`：将文章 Markdown 按段落/标题智能切块（≤800 字符），保留标题层级元数据
2. `lib/vector/store.ts`：ChromaDB 客户端封装，提供 `upsert / search / delete` 操作
3. `lib/vector/indexer.ts`：索引管理器，调用 Ollama 生成嵌入向量，写入 ChromaDB，并将状态记录到 `PostVectorIndex` 表

**RAG 问答流程（`POST /api/ai/companion/chat/stream`）：**

1. 用 Ollama 将用户问题向量化
2. 在 ChromaDB 中检索最相关的文章片段
3. 将检索结果拼入系统提示词
4. 调用 Kimi API 流式生成回答（SSE）
5. 返回带引用来源的答案

**聊天组件**（`components/chat/anime-assistant-chat.tsx`）：
- 浮窗界面，支持收起/展开
- 三种模式：了解文章 / 了解作者 / 自由聊天
- 对话历史通过 `localStorage` 持久化（最近 30 条）
- 在文章详情页自动注入当前文章作为上下文

### 阶段七：视觉效果

- **雪花背景**（`components/home/seasonal-background.tsx`）：使用 `react-snowfall`，仅在深色模式下渲染，挂载后才显示（避免 SSR 水合不匹配）
- **点击花朵特效**（`components/home/flower-click.tsx`）：Canvas 实现，点击页面空白区域生成五瓣红花粒子扩散动画，最多同时显示 5 朵，带"送你一朵小红花 ❤"浮文
- **视觉效果入口**（`components/layout/public-effects.tsx`）：通过 `usePathname()` 判断仅在公开路由激活特效，集成到根 `layout.tsx`
- **沉浸式阅读**（`components/immersive-reader.tsx`）：文章详情页顶部按钮，全屏覆盖层展示正文，支持 ESC 键退出

### 阶段八：部署配置

**PM2 进程管理**（`ecosystem.config.js`）：

```bash
# 生产环境启动
pm2 start ecosystem.config.js
pm2 logs next-ai-blog-cms
pm2 monit
```

配置项：单实例、内存超 1GB 自动重启、最多重试 5 次、日志输出到 `./logs/`

**Nginx 反向代理**（`nginx.conf.template`）：

- `/_next/` 静态资源：禁用所有缓存
- `/` 应用代理：转发至 `127.0.0.1:3000`，`proxy_read_timeout 86400` 支持 SSE 长连接
- 替换 `your-domain.com` 为实际域名后复制到 `/etc/nginx/sites-available/`

---

## 生产部署

### 构建

```bash
npm run build
npm run start
# 或使用 PM2
pm2 start ecosystem.config.js
```

生产环境变量写入 `.env.production`，PM2 配置会自动加载。

### Nginx 配置

```bash
# 替换域名后复制配置
sed 's/your-domain.com/example.com/g' nginx.conf.template \
  > /etc/nginx/sites-available/blog
ln -s /etc/nginx/sites-available/blog /etc/nginx/sites-enabled/
nginx -t && nginx -s reload
```

### HTTPS（推荐）

```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d example.com -d www.example.com
```

---

## 开发命令

```bash
npm run dev          # 启动开发服务器（Turbopack）
npm run build        # 生产构建
npm run start        # 启动生产服务器
npm run lint         # ESLint 检查
npm run type-check   # TypeScript 类型检查
```

---

## API 路由总览

### 公开接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/posts` | 文章列表（分页、分类/标签过滤） |
| GET | `/api/posts/[slug]` | 文章详情（自动累加浏览量） |
| GET | `/api/posts/[slug]/related` | 相关文章推荐 |
| GET | `/api/categories` | 分类列表 |
| GET | `/api/profile` | 作者公开资料 |
| GET | `/api/ai/companion/articles` | 已索引文章元数据 |
| POST | `/api/ai/companion/chat/stream` | RAG 流式问答（SSE） |

### 管理接口（需 ADMIN 认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/admin/posts` | 文章列表 / 新建 |
| GET/PUT/DELETE | `/api/admin/posts/[id]` | 文章详情 / 更新 / 删除 |
| PATCH | `/api/admin/posts/[id]` | 快速更新（发布状态等） |
| GET/POST | `/api/admin/categories` | 分类列表 / 新建 |
| PUT/DELETE | `/api/admin/categories/[id]` | 更新 / 删除分类 |
| GET/POST | `/api/admin/tags` | 标签列表 / 新建 |
| PUT/DELETE | `/api/admin/tags/[id]` | 更新 / 删除标签 |
| POST | `/api/admin/images/upload` | 图片上传 |
| GET/DELETE | `/api/admin/images` | 图片列表 / 删除 |
| GET/PUT | `/api/admin/profile` | 读取 / 更新个人资料 |
| POST | `/api/ai/write/generate` | AI 写作生成 |

---

## 环境要求

| 服务 | 用途 | 必须 |
|------|------|------|
| Node.js 20+ | 运行 Next.js | 是 |
| SQLite | 数据持久化 | 是（内置，无需安装） |
| Kimi API | AI 写作助手 & RAG 对话 | 否（无 Key 则禁用 AI 功能） |
| Ollama + nomic-embed-text | 文本向量化 | 否（无则无法建立向量索引） |
| ChromaDB | 向量相似度检索 | 否（无则 RAG 聊天不可用） |
