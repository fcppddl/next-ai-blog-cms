"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Code2, Globe, AtSign, BookOpen, Eye, Layers } from "lucide-react";

interface ProfileData {
  username: string;
  displayName: string;
  bio?: string;
  avatar?: string;
  github?: string;
  twitter?: string;
  website?: string;
  stats: { posts: number; views: number };
}

interface Category {
  id: string;
  name: string;
  slug: string;
  postCount: number;
}

export default function AdminProfileCard() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/profile").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
    ]).then(([profileData, categoriesData]) => {
      setProfile(profileData);
      setCategories(categoriesData);
    });
  }, []);

  if (!profile) {
    return (
      <div className="w-64 flex-shrink-0">
        <div className="sticky top-24 animate-pulse">
          <div className="h-96 rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <aside className="w-64 flex-shrink-0">
      <div className="sticky top-24">
        {/* Unified Profile + Categories Card */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {/* Gradient Header */}
          <div className="h-24 bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600" />

          {/* Content */}
          <div className="px-6 pb-6 relative z-10">
            {/* Avatar — overlapping header */}
            <div className="flex justify-center -mt-10 mb-3">
              {profile.avatar ? (
                <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-full border-4 border-card shadow-md">
                  <Image
                    src={profile.avatar}
                    alt={profile.displayName}
                    width={80}
                    height={80}
                    className="object-cover w-full h-full"
                  />
                </div>
              ) : (
                <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full border-4 border-card bg-gradient-to-br from-cyan-400 to-blue-600 text-2xl font-bold text-white shadow-md">
                  {profile.displayName[0]?.toUpperCase()}
                </div>
              )}
            </div>

            {/* Name & username */}
            <div className="mb-4 text-center">
              <h2 className="text-base font-semibold leading-tight text-foreground">
                {profile.displayName}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                @{profile.username}
              </p>
              {profile.bio && (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {profile.bio}
                </p>
              )}
            </div>

            {/* Stats */}
            <div className="mb-4 flex items-stretch justify-center gap-8 border-y border-border py-4">
              <div className="text-center">
                <span className="block text-2xl font-bold leading-none text-foreground">
                  {profile.stats.posts}
                </span>
                <span className="mt-1.5 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <BookOpen className="h-3 w-3" /> 文章
                </span>
              </div>
              <div className="w-px self-stretch bg-border" />
              <div className="text-center">
                <span className="block text-2xl font-bold leading-none text-foreground">
                  {profile.stats.views}
                </span>
                <span className="mt-1.5 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <Eye className="h-3 w-3" /> 阅读
                </span>
              </div>
            </div>

            {/* Social Links */}
            {(profile.github || profile.twitter || profile.website) && (
              <div className="flex justify-center gap-1 mb-5">
                {profile.github && (
                  <a
                    href={profile.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Code2 className="w-4 h-4" />
                  </a>
                )}
                {profile.twitter && (
                  <a
                    href={profile.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <AtSign className="w-4 h-4" />
                  </a>
                )}
                {profile.website && (
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Globe className="w-4 h-4" />
                  </a>
                )}
              </div>
            )}

            {/* Categories */}
            {categories.length > 0 && (
              <>
                <div className="mb-2 flex items-center gap-1.5">
                  <Layers className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    分类
                  </span>
                </div>
                <nav className="space-y-0.5">
                  {categories.map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/?category=${cat.slug}`}
                      className="group flex items-center justify-between rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <span>{cat.name}</span>
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground transition-colors group-hover:bg-primary/15 group-hover:text-primary">
                        {cat.postCount}
                      </span>
                    </Link>
                  ))}
                </nav>
              </>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
