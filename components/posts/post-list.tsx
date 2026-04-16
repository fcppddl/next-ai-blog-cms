"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Calendar, Eye, Clock } from "lucide-react";
import { Loading } from "@/components/ui/loading";

interface PostTag {
  tag: { name: string; slug: string };
}

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  readingTime: number | null;
  views: number;
  createdAt: string;
  category: { name: string; slug: string } | null;
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setPage(1);
    fetchPosts(1).finally(() => setLoading(false));
  }, [fetchPosts]);

  const loadMore = async () => {
    const nextPage = page + 1;
    setLoadingMore(true);
    await fetchPosts(nextPage, true);
    setPage(nextPage);
    setLoadingMore(false);
  };

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
                    <h2 className="text-lg font-semibold leading-snug text-[#262626] transition-colors group-hover:text-primary sm:text-xl dark:text-foreground">
                      {post.title}
                    </h2>
                    {post.excerpt && (
                      <p className="line-clamp-2 text-sm leading-relaxed text-[#595959] dark:text-muted-foreground">
                        {post.excerpt}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[#8C8C8C] dark:text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        {new Date(post.createdAt).toLocaleDateString("zh-CN")}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Eye className="h-3.5 w-3.5 shrink-0" />
                        {post.views}
                      </span>
                      {post.readingTime ? (
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                          {post.readingTime} 分钟
                        </span>
                      ) : null}
                    </div>

                    {(post.category || post.tags.length > 0) && (
                      <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
                        {post.category && (
                          <span className="rounded-md bg-[#F5F5F5] px-2 py-1 text-xs text-[#595959] dark:bg-muted dark:text-muted-foreground">
                            {post.category.name}
                          </span>
                        )}
                        {post.tags.slice(0, 5).map(({ tag: t }) => (
                          <span
                            key={t.slug}
                            className="rounded-md bg-[#F5F5F5] px-2 py-1 text-xs text-[#595959] dark:bg-muted dark:text-muted-foreground"
                          >
                            {t.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            </article>
          );
        })}
      </div>

      {pagination && page < pagination.totalPages && (
        <div className="mt-10 flex justify-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-full border border-border px-6 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:border-primary hover:bg-primary/10 hover:text-foreground disabled:opacity-50"
          >
            {loadingMore ? "加载中..." : "加载更多"}
          </button>
        </div>
      )}
    </div>
  );
}
