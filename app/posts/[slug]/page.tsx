import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { Calendar, Eye, Clock, ArrowLeft } from "lucide-react";
import PublicLayout from "@/components/layout/public-layout";
import MarkdownRenderer from "@/components/markdown/markdown-renderer";
import RelatedPosts from "@/components/posts/related-posts";
import { PostCategoryTags } from "@/components/posts/post-category-tags";
import {
  PostFullscreenRegion,
  PostFullscreenToggle,
} from "@/components/posts/post-fullscreen-region";
import {
  getPublishedPostMeta,
  getPublishedPostAndIncrementViews,
} from "@/lib/posts/published-post";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostMeta(slug);
  if (!post) return { title: "Post Not Found" };
  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      images: post.coverImage ? [post.coverImage] : [],
    },
  };
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPublishedPostAndIncrementViews(slug);

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
          <h1 className="mb-6 text-4xl font-black leading-tight text-foreground">
            {post.title}
          </h1>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-6 text-sm text-muted-foreground">
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
            <PostCategoryTags category={post.category} tags={post.tags ?? []} />
            {post.featured ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                <span aria-hidden>⭐</span>
                精选
              </span>
            ) : null}
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
