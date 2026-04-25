"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Globe,
  AtSign,
  Layers,
  Folder,
  MessageCircle,
  Mail,
  User,
  MapPin,
} from "lucide-react";

interface ProfileData {
  username: string;
  displayName: string;
  bio?: string;
  avatar?: string;
  email?: string;
  wechat?: string;
  github?: string;
  twitter?: string;
  website?: string;
  location?: string;
}

function githubProfileHref(raw: string | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
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

  const wechatTrim = profile.wechat?.trim() ?? "";
  const emailTrim = profile.email?.trim() ?? "";
  const githubTrim = profile.github?.trim() ?? "";
  const githubHref = githubProfileHref(profile.github);
  const locationTrim = profile.location?.trim() ?? "";
  const emptyMark = "-";

  return (
    <aside className="w-64 flex-shrink-0">
      <div className="sticky top-24">
        <div className="overflow-hidden rounded-[16px] border border-[#E0E0E0] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.08)] dark:border-border dark:bg-card dark:shadow-sm dark:hover:shadow-md">
          <div className="px-6 pb-6 pt-8">
            <div className="mb-4 flex justify-center">
              {profile.avatar ? (
                <div className="h-28 w-28 flex-shrink-0 overflow-hidden rounded-full border-4 border-white shadow-[0_4px_14px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.06] dark:border-card dark:ring-white/10">
                  <Image
                    src={profile.avatar}
                    alt={profile.displayName}
                    width={112}
                    height={112}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-28 w-28 flex-shrink-0 items-center justify-center rounded-full border-4 border-white bg-primary/90 text-3xl font-bold text-primary-foreground shadow-[0_4px_14px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.06] dark:border-card">
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

            {/* Categories — 置于个人信息之上 */}
            {categories.length > 0 && (
              <div className="mb-4 border-b border-[#E0E0E0] pb-4 dark:border-border">
                <div className="mb-2 flex items-center gap-1.5">
                  <Layers className="h-3 w-3 text-indigo-600/80 dark:text-indigo-300/80" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    文章分类
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
                          className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-base leading-none text-indigo-600/80 transition-colors group-hover:text-indigo-700 dark:text-indigo-300/80 dark:group-hover:text-indigo-200"
                          aria-hidden
                        >
                          {cat.icon?.trim() ? (
                            cat.icon.trim()
                          ) : (
                            <Folder className="h-3.5 w-3.5" />
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
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center gap-1.5">
                <User
                  className="h-3 w-3 text-violet-600/80 dark:text-violet-300/80"
                  aria-hidden
                />
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  个人信息
                </span>
              </div>
              {/* — 与上方文章分类 Link 的 px-2 对齐左右边距 */}
              <div className="space-y-2.5 px-2">
                <div className="flex items-start gap-2">
                  <MessageCircle
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1 text-right text-xs leading-relaxed text-[#8C8C8C] dark:text-muted-foreground">
                    {wechatTrim ? (
                      <span className="break-all">{wechatTrim}</span>
                    ) : (
                      <span className="text-muted-foreground">{emptyMark}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Mail
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1 text-right text-xs leading-relaxed">
                    {emailTrim ? (
                      <a
                        href={`mailto:${emailTrim}`}
                        className="break-all text-[#8C8C8C] transition-colors hover:text-foreground dark:text-muted-foreground"
                      >
                        {emailTrim}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">{emptyMark}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <svg
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-800 dark:text-zinc-200"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  <div className="min-w-0 flex-1 text-right text-xs leading-relaxed">
                    {githubTrim && githubHref ? (
                      <a
                        href={githubHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-[#8C8C8C] transition-colors hover:text-foreground dark:text-muted-foreground"
                      >
                        {githubTrim}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">{emptyMark}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1 text-right text-xs leading-relaxed text-[#8C8C8C] dark:text-muted-foreground">
                    {locationTrim ? (
                      <span className="break-words">{locationTrim}</span>
                    ) : (
                      <span className="text-muted-foreground">{emptyMark}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
