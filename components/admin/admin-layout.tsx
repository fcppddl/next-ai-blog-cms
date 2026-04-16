"use client";

import { ReactNode, useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  Tags,
  Home,
  LogOut,
  User,
  Menu,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SimpleLoading } from "@/components/ui/loading";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/admin/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setAvatarUrl(data.profile?.avatar || "");
          setDisplayName(data.profile?.displayName || data.username || "");
        }
      });
  }, [status]);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0e14]">
        <SimpleLoading />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0e14]">
        <div className="text-center">
          <p className="mb-4 text-gray-600">请先登录</p>
          <Button onClick={() => router.push("/login")}>前往登录</Button>
        </div>
      </div>
    );
  }

  const navItems = [
    { name: "仪表盘", href: "/admin", icon: LayoutDashboard, exact: true },
    { name: "文章管理", href: "/admin/posts", icon: FileText, exact: false },
    {
      name: "分类管理",
      href: "/admin/categories",
      icon: FolderOpen,
      exact: false,
    },
    { name: "标签管理", href: "/admin/tags", icon: Tags, exact: false },
    { name: "向量索引", href: "/admin/settings", icon: Database, exact: false },
    { name: "个人信息", href: "/admin/profile", icon: User, exact: false },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b0e14]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white dark:bg-[#0b0e14] backdrop-blur-lg border-b border-gray-200 dark:border-slate-800/80 z-50 shadow-sm dark:shadow-none">
        <div className="h-full px-4 lg:px-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden h-9 w-9 p-0"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center space-x-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icon.svg"
                alt=""
                width={36}
                height={36}
                className="block h-9 w-9 bg-transparent"
              />
              <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
                码界空间
              </span>
              <span className="text-sm text-gray-400">| 管理后台</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/">
              <Button variant="ghost" size="icon" title="查看前台">
                <Home className="h-5 w-5" />
              </Button>
            </Link>
            {session?.user && (
              <div className="group relative">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="w-9 h-9 rounded-full object-cover border-2 border-gray-200 group-hover:border-gray-400 transition-all cursor-pointer"
                  />
                ) : (
                  <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center border-2 border-gray-200 group-hover:border-gray-400 transition-all cursor-pointer">
                    <User className="h-4 w-4 text-gray-500" />
                  </div>
                )}
                <div className="absolute right-0 top-11 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="py-2">
                    <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {displayName || session.user.username}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        管理员
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        signOut({ redirect: true, callbackUrl: "/" })
                      }
                      className="w-full flex items-center px-4 py-2.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-gray-100 transition-colors cursor-pointer"
                    >
                      <LogOut className="h-4 w-4 mr-3 text-gray-400" />
                      退出登录
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-16 h-[calc(100vh-4rem)] w-56 bg-white dark:bg-[#080d18] border-r border-gray-100 dark:border-slate-800/80 transform transition-transform duration-200 ease-in-out z-40",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <nav className="flex-1 px-3 py-6 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.exact
              ? pathname === item.href
              : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
              >
                <div
                  className={cn(
                    "flex items-center px-3 py-2.5 text-[14px] font-medium rounded-lg transition-all duration-150 cursor-pointer",
                    active
                      ? "bg-indigo-50 dark:bg-violet-950/40 text-indigo-700 dark:text-white"
                      : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5",
                  )}
                >
                  <Icon
                    className={cn(
                      "mr-3 h-4 w-4 flex-shrink-0",
                      active
                        ? "text-indigo-600 dark:text-violet-400"
                        : "text-gray-400 dark:text-slate-500",
                    )}
                  />
                  <span>{item.name}</span>
                  {active && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400 dark:bg-violet-500" />
                  )}
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/10 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <main className="lg:ml-56 mt-16 min-h-[calc(100vh-4rem)]">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
