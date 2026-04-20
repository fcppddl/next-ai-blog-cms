"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, PenSquare } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import AIChatWidget from "@/components/chat/ai-chat";

const navLinks = [{ href: "/about", label: "关于" }];

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // 短内容时页脚贴视口底部：flex 列 + main 伸展
  return (
    <div className="relative flex min-h-screen flex-col bg-gray-50 text-foreground dark:bg-[#0b0e14]">
      {/* Header — 与后台管理同样使用主题变量，暗色为 navy 系 */}
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          scrolled
            ? "border-b border-border bg-background/85 shadow-sm backdrop-blur-md"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link
            href="/"
            className="group flex items-center gap-2 transition-opacity hover:opacity-90"
            aria-label="码界网首页"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon.svg"
              alt=""
              width={36}
              height={36}
              className="block h-9 w-9 shrink-0 bg-transparent"
            />
            <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
              码界网
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-6 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/admin"
              className="flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/90"
            >
              <PenSquare className="h-3.5 w-3.5 shrink-0" aria-hidden />
              管理
            </Link>
            <ThemeToggle />
          </nav>

          {/* Mobile */}
          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="菜单"
            >
              {menuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="border-t border-border bg-background/95 backdrop-blur-md md:hidden">
            <nav className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              {/* AIGC START */}
              <Link
                href="/admin"
                className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/90"
                onClick={() => setMenuOpen(false)}
              >
                <PenSquare className="h-3.5 w-3.5 shrink-0" aria-hidden />
                管理后台
              </Link>
              {/* AIGC END */}
            </nav>
          </div>
        )}
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 pt-16">{children}</main>

      {/* Footer */}
      <footer className="relative z-10 mt-12 border-t border-border py-5">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} 码界网. 版权所有。
        </div>
      </footer>

      {/* AI Chat Assistant */}
      <AIChatWidget />
    </div>
  );
}
