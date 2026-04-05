"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Calendar, Eye, Clock, Tag } from "lucide-react";
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
      const params = new URLSearchParams({ page: String(pageNum), limit: "10" });
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
    [category, tag]
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
      <div className="py-20 text-center text-muted-foreground">
        暂无文章
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-4">
        {posts.map((post) => (
          <article
            key={post.id}
            className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
          >
            <Link href={`/posts/${post.slug}`} className="block">
              {post.coverImage && (
                <div className="relative w-full h-44 overflow-hidden">
                  <Image
                    src={post.coverImage}
                    alt={post.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              )}
              <div className="p-6">
                {/* Category badge + tags */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {post.category && (
                    <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                      {post.category.name}
                    </span>
                  )}
                  {post.tags.slice(0, 3).map(({ tag: t }) => (
                    <span
                      key={t.slug}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                    >
                      <Tag className="w-3 h-3" />
                      {t.name}
                    </span>
                  ))}
                </div>

                {/* Title */}
                <h2 className="mb-2 text-lg font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
                  {post.title}
                </h2>

                {/* Excerpt */}
                {post.excerpt && (
                  <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                    {post.excerpt}
                  </p>
                )}

                {/* Metadata */}
                <div className="flex items-center gap-5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(post.createdAt).toLocaleDateString("zh-CN")}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" />
                    {post.views}
                  </span>
                  {post.readingTime && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {post.readingTime} 分钟
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </article>
        ))}
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
