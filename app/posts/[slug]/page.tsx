import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { Calendar, Eye, Clock, ArrowLeft, Tag } from "lucide-react";
import PublicLayout from "@/components/layout/public-layout";
import MarkdownRenderer from "@/components/markdown/markdown-renderer";
import RelatedPosts from "@/components/posts/related-posts";
import { Badge } from "@/components/ui/badge";
import {
  PostFullscreenRegion,
  PostFullscreenToggle,
} from "@/components/posts/post-fullscreen-region";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getPost(slug: string) {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/posts/${slug}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Post Not Found" };
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: post.coverImage ? [post.coverImage] : [],
    },
  };
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) notFound();

  return (
    <PublicLayout>
      <PostFullscreenRegion>
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 text-sky-600/80 dark:text-sky-400/80" />
            返回首页
          </Link>
          <PostFullscreenToggle />
        </div>

        {/* Header */}
        <header className="mb-10">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {post.category && (
              <Badge
                variant="outline"
                className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
              >
                {post.category.name}
              </Badge>
            )}
            {post.tags?.map(
              ({ tag: t }: { tag: { name: string; slug: string } }) => (
                <span
                  key={t.slug}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                >
                  <Tag className="h-3 w-3" />
                  {t.name}
                </span>
              ),
            )}
          </div>

          <h1 className="mb-6 text-4xl font-black leading-tight text-foreground">
            {post.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 border-b border-border pb-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-sky-600/80 dark:text-sky-400/80" />
              {new Date(post.createdAt).toLocaleDateString("zh-CN")}
            </span>
            <span className="flex items-center gap-1.5">
              <Eye className="h-4 w-4 text-emerald-600/80 dark:text-emerald-400/80" />
              {post.views} 次阅读
            </span>
            {post.readingTime && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-amber-600/80 dark:text-amber-400/80" />
                {post.readingTime} 分钟阅读
              </span>
            )}
          </div>

          {post.coverImage && (
            <div className="relative mt-6 h-72 w-full overflow-hidden rounded-lg border border-border">
              <Image
                src={post.coverImage}
                alt={post.title}
                fill
                className="object-cover"
                priority
                unoptimized={post.coverImage.startsWith("/images/")}
              />
            </div>
          )}
        </header>

        {/* Content */}
        <MarkdownRenderer content={post.content} />

        {/* Related */}
        <RelatedPosts
          categorySlug={post.category?.slug}
          currentSlug={post.slug}
        />
      </PostFullscreenRegion>
    </PublicLayout>
  );
}
