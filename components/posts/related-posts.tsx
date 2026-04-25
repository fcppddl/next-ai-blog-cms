"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Calendar } from "lucide-react";

interface RelatedPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  createdAt: string;
  category: { name: string; slug: string } | null;
}

interface RelatedPostsProps {
  categorySlug?: string;
  currentSlug: string;
}

export default function RelatedPosts({ categorySlug, currentSlug }: RelatedPostsProps) {
  const [posts, setPosts] = useState<RelatedPost[]>([]);

  useEffect(() => {
    const params = new URLSearchParams({ limit: "4" });
    if (categorySlug) params.set("category", categorySlug);

    fetch(`/api/posts?${params}`)
      .then((r) => r.json())
      .then((data) => {
        const filtered = (data.posts as RelatedPost[]).filter(
          (p) => p.slug !== currentSlug
        );
        setPosts(filtered.slice(0, 3));
      });
  }, [categorySlug, currentSlug]);

  if (posts.length === 0) return null;

  return (
    <section className="mt-16 border-t border-border pt-10">
      <h3 className="mb-6 text-xl font-bold uppercase tracking-wide text-foreground">相关文章</h3>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/posts/${post.slug}`}
            className="group rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:bg-muted/50"
          >
            <p className="mb-2 line-clamp-2 text-sm font-semibold text-foreground group-hover:text-primary">
              {post.title}
            </p>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3 text-sky-600/80 dark:text-sky-400/80" />
              {new Date(post.createdAt).toLocaleDateString("zh-CN")}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
