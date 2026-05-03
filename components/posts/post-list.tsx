"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Calendar, Eye, Clock } from "lucide-react";
import { Loading } from "@/components/ui/loading";
import { PostCategoryTags } from "@/components/posts/post-category-tags";

interface PostTag {
  tag: { name: string; slug: string };
}

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  featured: boolean;
  readingTime: number | null;
  views: number;
  createdAt: string;
  category: { name: string; slug: string; icon: string | null } | null;
  tags: PostTag[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface PostListProps {
  category?: string;
  tag?: string;
}

export default function PostList({ category, tag }: PostListProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);
  const pageRef = useRef(1);
  const totalPagesRef = useRef(1);

  pageRef.current = page;
  if (pagination) totalPagesRef.current = pagination.totalPages;

  const fetchPosts = useCallback(
    async (pageNum: number, append = false) => {
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: "10",
      });
      if (category) params.set("category", category);
      if (tag) params.set("tag", tag);

      const res = await fetch(`/api/posts?${params}`);
      const data = await res.json();

      if (append) {
        setPosts((prev) => [...prev, ...data.posts]);
      } else {
        setPosts(data.posts);
      }
      setPagination(data.pagination);
    },
    [category, tag],
  );

  useEffect(() => {
    setLoading(true);
    setPage(1);
    fetchPosts(1).finally(() => setLoading(false));
  }, [fetchPosts]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current) return;
    const nextPage = pageRef.current + 1;
    if (nextPage > totalPagesRef.current) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      await fetchPosts(nextPage, true);
      setPage(nextPage);
    } finally {
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }, [fetchPosts]);

  useEffect(() => {
    if (loading) return;
    const el = sentinelRef.current;
    if (!el) return;
    if (!pagination || pageRef.current >= pagination.totalPages) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || loadingMoreRef.current) return;
        if (pageRef.current >= totalPagesRef.current) return;

        observer.unobserve(el);
        void loadMore().finally(() => {
          if (el.isConnected && sentinelRef.current === el) {
            observer.observe(el);
          }
        });
      },
      { root: null, rootMargin: "240px 0px", threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [loading, pagination, loadMore]);

  if (loading) {
    return <Loading className="py-20" />;
  }

  if (posts.length === 0) {
    return (
      <div className="py-20 text-center text-muted-foreground">暂无文章</div>
    );
  }

  return (
    <div>
      <div className="space-y-5">
        {posts.map((post) => {
          const hasCover = Boolean(post.coverImage);
          return (
            <article
              key={post.id}
              className="group overflow-hidden rounded-[16px] border border-[#E0E0E0] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.08)] dark:border-border dark:bg-card dark:shadow-sm dark:hover:shadow-md"
            >
              <Link
                href={`/posts/${post.slug}`}
                className={
                  hasCover
                    ? "flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6"
                    : "flex flex-col p-5 sm:p-6"
                }
              >
                {hasCover && (
                  <div className="relative order-1 aspect-[16/10] w-full shrink-0 overflow-hidden rounded-[10px] bg-muted sm:order-2 sm:aspect-auto sm:h-[92px] sm:w-[148px] md:h-[100px] md:w-[160px]">
                    <Image
                      src={post.coverImage!}
                      alt={post.title}
                      fill
                      sizes="(min-width: 640px) 160px, 100vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      unoptimized={post.coverImage!.startsWith("/images/")}
                    />
                  </div>
                )}
                <div
                  className={`flex min-w-0 flex-1 flex-col justify-between gap-4 ${hasCover ? "order-2 sm:order-1" : ""}`}
                >
                  <div className="space-y-3">
                    <div className="relative min-w-0">
                      <h2
                        className={`text-lg font-semibold leading-snug text-[#262626] transition-colors group-hover:text-primary sm:text-xl dark:text-foreground ${post.featured ? "pr-[4.5rem]" : ""}`}
                      >
                        {post.title}
                      </h2>
                      {post.featured ? (
                        <span className="absolute right-0 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                          <span aria-hidden>⭐</span>
                          精选
                        </span>
                      ) : null}
                    </div>
                    {post.excerpt && (
                      <p className="line-clamp-2 text-sm leading-relaxed text-[#595959] dark:text-muted-foreground">
                        {post.excerpt}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[#8C8C8C] dark:text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 shrink-0 text-sky-600/80 dark:text-sky-400/80" />
                        {new Date(post.createdAt).toLocaleDateString("zh-CN")}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Eye className="h-3.5 w-3.5 shrink-0 text-emerald-600/80 dark:text-emerald-400/80" />
                        {post.views}
                      </span>
                      {post.readingTime ? (
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 shrink-0 text-amber-600/80 dark:text-amber-400/80" />
                          {post.readingTime} 分钟
                        </span>
                      ) : null}
                    </div>

                    <PostCategoryTags
                      category={post.category}
                      tags={post.tags}
                      tagLimit={5}
                      className="justify-start sm:justify-end"
                    />
                  </div>
                </div>
              </Link>
            </article>
          );
        })}
      </div>

      {pagination && page < pagination.totalPages && (
        <div
          ref={sentinelRef}
          className="mt-10 flex min-h-12 items-center justify-center"
          aria-live="polite"
          aria-busy={loadingMore}
        >
          {loadingMore ? (
            <span className="text-sm text-muted-foreground">加载中...</span>
          ) : (
            <span className="sr-only">向下滚动以加载更多文章</span>
          )}
        </div>
      )}
    </div>
  );
}
