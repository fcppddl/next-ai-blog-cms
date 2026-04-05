# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
# Development
npm run dev           # Start dev server
npm run build         # Production build
npm run lint          # ESLint check
npm run type-check    # TypeScript check (no emit)

# Database (all load .env.local via dotenv-cli)
npm run db:push       # Push schema changes without migration history
npm run db:migrate    # Create and run a migration
npm run db:seed       # Seed database with admin user + sample data
npm run db:studio     # Open Prisma Studio UI
npm run db:reset      # Reset database and re-seed (destructive)
```

## Architecture

**Stack**: Next.js 16.2.1 (App Router) · React 19 · Tailwind CSS v4 · Prisma (SQLite) · NextAuth.js v4

**Path alias**: `@/` maps to the project root (not `src/`). All imports use `@/app`, `@/components`, `@/lib`, etc.

**Tailwind v4**: Configured entirely via CSS `@import "tailwindcss"` in `app/globals.css` — there is no `tailwind.config.ts`. Theme tokens are defined with `@theme inline` CSS variables.

### Directory layout

```
app/                  # Next.js App Router pages and API routes
  (public pages)      # layout.tsx, page.tsx, posts/[slug], about, login
  admin/              # Protected CMS pages (posts, categories, tags, profile)
  api/
    auth/             # NextAuth [...nextauth] handler
    posts/            # Public post endpoints
    categories/       # Public category list
    profile/          # Public author profile
    admin/            # Protected CRUD endpoints (posts, categories, tags, images, profile, avatar)
    ai/
      write/          # generate (stream) + complete (stream) — AI writing assistant
      companion/      # articles list + chat/stream — RAG Q&A

components/
  admin/              # CMS UI (layout, dashboard, post editor, publish dialog, image manager, AI assistant)
  chat/               # Floating RAG chat widget
  home/               # Homepage-specific components (seasonal background, click effects)
  layout/             # Public layout, navbar, footer, PublicEffects wrapper
  markdown/           # Markdown renderer + code block with highlight.js + Mermaid
  profile/            # Author profile card (used on public blog)
  providers/          # AuthProvider (SessionProvider), ThemeProvider
  ui/                 # shadcn/ui primitives

lib/
  auth.ts             # NextAuth config (Credentials provider, JWT strategy, ADMIN-only)
  prisma.ts           # Prisma Client singleton
  utils.ts            # cn() utility (clsx + tailwind-merge)
  ai/
    client.ts         # KimiClient (OpenAI-compatible) + ollamaEmbed(); singleton via getAIClient()
    companion.ts      # RAG orchestration: embed query → ChromaDB search → Kimi stream
    constants.ts      # Model/prompt constants
    prompts/          # write.ts (续写/扩展/润色/总结), completion.ts
  vector/
    chunker.ts        # Split Markdown into overlapping chunks with metadata
    store.ts          # ChromaDB client wrapper (add/query/delete)
    indexer.ts        # Index a post or all posts; persists state to PostVectorIndex
  editor/             # Tiptap/ProseMirror AI completion extension

hooks/                # Custom React hooks
types/                # Shared TypeScript types
prisma/
  schema.prisma       # Models: User, Profile, Post, Category, Tag, PostTag, PostVectorIndex, Image
  seed.ts             # Seeds admin user from ADMIN_USERNAME/ADMIN_PASSWORD env vars
```

### Auth & route protection

`middleware.ts` uses NextAuth `withAuth` to guard `/admin/**` and `/api/admin/**`. Only authenticated users (any valid JWT) can access these routes. The `authorize` callback in `lib/auth.ts` further restricts login to `role === "ADMIN"` users. The JWT carries `id`, `username`, `role`, and `displayName`.

### API patterns

- Public API routes live under `app/api/` (posts, categories, profile).
- Admin API routes live under `app/api/admin/` and require the session token.
- Streaming AI responses use `ReadableStream` / `TransformStream` with `Content-Type: text/event-stream` (SSE). Both `api/ai/write/generate` and `api/ai/companion/chat/stream` follow this pattern.

### AI subsystem

- **LLM**: Kimi (Moonshot) via OpenAI SDK with custom `baseURL`. Configured via `KIMI_API_KEY`, `KIMI_BASE_URL`, `KIMI_MODEL`.
- **Embeddings**: Ollama (`nomic-embed-text` by default). Configured via `OLLAMA_BASE_URL`, `OLLAMA_EMBEDDING_MODEL`.
- **Vector store**: ChromaDB. Configured via `CHROMADB_HOST`, `CHROMADB_PORT`.
- `getAIClient()` in `lib/ai/client.ts` returns a lazily-initialized singleton `KimiClient`. The same client's `embed()` method delegates to Ollama (not Kimi).

### Editor

The post editor uses **Tiptap** (not Novel, despite the CLAUDE.md plan). `tiptap-markdown` handles Markdown serialization. The AI completion extension in `lib/editor/` hooks into ProseMirror to call `/api/ai/write/complete`.

### Image storage

Uploaded images are stored under `public/images/posts/{slug}/` and served statically. The `Image` model tracks metadata (filename, path, size, mimeType, type: COVER|CONTENT) linked to a Post.
