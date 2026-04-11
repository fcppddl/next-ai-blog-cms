# Next AI Blog CMS

基于 **Next.js App Router** 的博客与后台一体化项目：公开前台、管理员 CMS、AI 写作助手，以及基于向量检索（RAG）的站内智能问答。

---

## 技术栈

### 核心运行时

| 类别 | 技术 | 说明 |
|------|------|------|
| 框架 | **Next.js 16.2** | App Router、服务端组件与 Route Handlers |
| UI 库 | **React 19** | 客户端交互与组件 |
| 语言 | **TypeScript 5** | 全项目类型检查：`npm run type-check` |

### 样式与组件

| 类别 | 技术 | 说明 |
|------|------|------|
| CSS | **Tailwind CSS v4** | 在 `app/globals.css` 中通过 `@import "tailwindcss"` 引入，**无** `tailwind.config.ts`；主题用 `@theme inline` |
| 组件 | **shadcn/ui 风格 + Radix** | `components/ui/`，`cn()` 来自 `clsx` + `tailwind-merge` |
| 动效 | `tailwindcss-animate`、`tw-animate-css` | 过渡与动画类 |
| 排版 | `@tailwindcss/typography` | 文章 `prose` 样式 |
| 图标 | `lucide-react` | 图标集 |
| 字体 | `geist`（npm 包） | 不依赖 Google Fonts 在线加载 |

### 数据与认证

| 类别 | 技术 | 说明 |
|------|------|------|
| 数据库 | **SQLite** | 开发/单机默认，连接串见环境变量 |
| ORM | **Prisma 6** | `prisma/schema.prisma`，`postinstall` 会执行 `prisma generate` |
| 认证 | **NextAuth.js v4** | Credentials + JWT；`middleware` 保护 `/admin` 与 `/api/admin/**` |
| 密码 | `bcryptjs` | 登录密码哈希比对 |

### 内容与编辑器

| 类别 | 技术 | 说明 |
|------|------|------|
| 后台文章编辑 | **Tiptap 3** + `tiptap-markdown` | `components/admin/tiptap-editor.tsx`，Markdown 与富文本流转 |
| Markdown 展示 | `react-markdown`、`remark-gfm`、`rehype-highlight` | 前台文章渲染；代码高亮（`highlight.js`）、支持 **Mermaid** |
| 表单 / 校验 | `react-hook-form`、`zod`、`@hookform/resolvers` | 后台表单 |

### AI 与向量（可选能力）

| 类别 | 技术 | 说明 |
|------|------|------|
| 大模型 | **Kimi（Moonshot）** | 通过 **OpenAI 兼容 SDK**（`openai` 包）调用，`KIMI_BASE_URL` / `KIMI_MODEL` 可配 |
| 嵌入向量 | **Ollama** | 默认模型如 `nomic-embed-text`，HTTP 接口由 `OLLAMA_BASE_URL` 指定 |
| 向量库 | **ChromaDB** | Node 客户端 `chromadb`，需可访问的 `CHROMADB_HOST` / `CHROMADB_PORT` |

### 其他依赖（节选）

- `next-themes`：明暗主题  
- `date-fns`：日期处理  
- `sonner`：Toast  
- `react-snowfall` 等：首页装饰效果  

---

## 环境要求

| 依赖 | 版本 / 说明 |
|------|-------------|
| **Node.js** | **20+**（与 `@types/node` 一致即可） |
| **npm** | 与 Node 配套的包管理器（文档以 `npm` 为例） |

以下为**可选**（不装则对应功能不可用或降级）：

- **Kimi API Key**：AI 写作、流式对话、RAG 生成答案  
- **Ollama**：生成文章块嵌入  
- **ChromaDB**：存储与检索向量；可用 Docker 跑官方镜像  

---

## 项目启动方式

### 1. 安装依赖

```bash
npm install
```

安装结束会自动执行 `prisma generate`（`postinstall`）。

### 2. 配置环境变量

仓库根目录新建 **`.env.local`**（勿提交密钥）。数据库相关脚本通过 **dotenv-cli** 读取该文件：`dotenv -e .env.local -- …`。

**最小可运行博客 + 登录后台**所需示例：

```bash
# 数据库（SQLite 文件路径，可按需修改）
DATABASE_URL="file:./prisma/dev.db"

# NextAuth（生产环境务必使用足够长的随机密钥）
NEXTAUTH_SECRET="请替换为至少 32 字符的随机字符串"
NEXTAUTH_URL="http://localhost:3000"

# 种子数据中的管理员（与 prisma/seed 一致）
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="你的安全密码"
```

**若使用 AI 写作与对话（Kimi）**，追加例如：

```bash
KIMI_API_KEY="你的 Moonshot API Key"
KIMI_BASE_URL="https://api.moonshot.cn/v1"
KIMI_MODEL="moonshot-v1-32k"
```

**若使用 RAG（向量索引 + 检索问答）**，追加例如：

```bash
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_EMBEDDING_MODEL="nomic-embed-text"

CHROMADB_HOST="localhost"
CHROMADB_PORT="8000"
```

### 3. 初始化数据库

```bash
npm run db:push   # 将 Prisma schema 同步到本地 SQLite
npm run db:seed   # 写入管理员账号与示例数据（依赖 ADMIN_*）
```

### 4.（可选）启动 RAG 依赖服务

仅在你需要 **向量嵌入 / Chroma 检索**时执行：

```bash
# Ollama：嵌入模型
ollama serve
ollama pull nomic-embed-text

# ChromaDB（示例：Docker）
docker run -d --name chromadb -p 8000:8000 chromadb/chroma:latest
```

### 5. 启动开发服务器

```bash
npm run dev
```

默认开发地址：**<http://localhost:3000>**

| 入口 | 地址 |
|------|------|
| 博客前台 | `/` |
| 管理后台 | `/admin`（使用 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 登录） |
| NextAuth 登录页 | `/login` |

---

## 常用 npm 脚本

| 命令 | 作用 |
|------|------|
| `npm run dev` | 开发模式启动 Next.js |
| `npm run build` | 生产构建 |
| `npm run start` | 启动生产构建后的服务（需先 `build`） |
| `npm run lint` | ESLint |
| `npm run type-check` | `tsc --noEmit`，不生成文件 |

**数据库**（均通过 `.env.local` 加载环境）：

| 命令 | 作用 |
|------|------|
| `npm run db:generate` | 生成 Prisma Client |
| `npm run db:push` | 将 schema 推送到数据库（开发常用） |
| `npm run db:migrate` | 创建并执行迁移 |
| `npm run db:seed` | 执行种子脚本 |
| `npm run db:studio` | 打开 Prisma Studio |
| `npm run db:reset` | **清空并重建**数据库后重新 seed（破坏性操作） |

---

## 生产环境简要说明

```bash
npm run build
npm run start
```

或使用仓库中的 `ecosystem.config.js`（PM2）、`nginx.conf.template`（反向代理与 SSE 超时等）按实际服务器部署。生产环境变量可放在 `.env.production` 或由进程管理器注入，并确保 `NEXTAUTH_URL` 与公网域名一致。

---

## 仓库结构（速览）

```
app/                 # 页面与 API（App Router）
  admin/             # 后台页面（受保护）
  api/               # Route Handlers（含 auth、posts、admin、ai）
components/          # 前台 / 后台 / 聊天浮窗等
lib/                 # 工具、auth、ai、vector、editor 等
prisma/              # schema、seed
middleware.ts        # 路由与 API 访问控制
public/              # 静态资源（含文章图片目录等）
```

更细的模块说明见仓库内 `CLAUDE.md`。
