"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Code2,
  Globe,
  AtSign,
  BookOpen,
  Eye,
  Layers,
  Folder,
} from "lucide-react";

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
  icon?: string | null;
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
          <div className="h-96 rounded-[16px] border border-[#E0E0E0] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:border-border dark:bg-card" />
        </div>
      </div>
    );
  }

  return (
    <aside className="w-64 flex-shrink-0">
      <div className="sticky top-24">
        <div className="overflow-hidden rounded-[16px] border border-[#E0E0E0] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.08)] dark:border-border dark:bg-card dark:shadow-sm dark:hover:shadow-md">
          <div className="px-6 pb-6 pt-8">
            <div className="mb-4 flex justify-center">
              {profile.avatar ? (
                <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-full border-4 border-white shadow-[0_4px_14px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.06] dark:border-card dark:ring-white/10">
                  <Image
                    src={profile.avatar}
                    alt={profile.displayName}
                    width={80}
                    height={80}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full border-4 border-white bg-primary/90 text-2xl font-bold text-primary-foreground shadow-[0_4px_14px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.06] dark:border-card">
                  {profile.displayName[0]?.toUpperCase()}
                </div>
              )}
            </div>

            <div className="mb-5 text-center">
              <h2 className="text-base font-semibold leading-tight text-[#333333] dark:text-foreground">
                {profile.displayName}
              </h2>
              <p className="mt-1 text-xs text-[#8C8C8C] dark:text-muted-foreground">
                @{profile.username}
              </p>
              {profile.bio && (
                <p className="mt-3 text-sm leading-relaxed text-[#595959] dark:text-muted-foreground">
                  {profile.bio}
                </p>
              )}
            </div>

            <div className="mb-5 flex items-stretch justify-center gap-8 border-y border-[#E0E0E0] py-4 dark:border-border">
              <div className="text-center">
                <span className="block text-2xl font-bold leading-none text-[#262626] dark:text-foreground">
                  {profile.stats.posts}
                </span>
                <span className="mt-1.5 flex items-center justify-center gap-1 text-xs text-[#8C8C8C] dark:text-muted-foreground">
                  <BookOpen className="h-3 w-3" /> 文章
                </span>
              </div>
              <div className="w-px self-stretch bg-[#E0E0E0] dark:bg-border" />
              <div className="text-center">
                <span className="block text-2xl font-bold leading-none text-[#262626] dark:text-foreground">
                  {profile.stats.views}
                </span>
                <span className="mt-1.5 flex items-center justify-center gap-1 text-xs text-[#8C8C8C] dark:text-muted-foreground">
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
                      className="group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <span
                          className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-base leading-none"
                          aria-hidden
                        >
                          {cat.icon?.trim() ? (
                            cat.icon.trim()
                          ) : (
                            <Folder className="h-3.5 w-3.5 opacity-70" />
                          )}
                        </span>
                        <span className="truncate">{cat.name}</span>
                      </span>
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
