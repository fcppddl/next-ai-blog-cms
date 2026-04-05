"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, PenSquare } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import AIChatWidget from "@/components/chat/ai-chat";

const navLinks = [
  { href: "/", label: "首页" },
  { href: "/about", label: "关于" },
];

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="relative min-h-screen bg-background text-foreground">
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
            className="text-xl font-bold tracking-tight text-foreground transition-colors hover:text-muted-foreground"
          >
            AI Blog
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
              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <PenSquare className="h-3.5 w-3.5" />
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
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
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
              <Link
                href="/admin"
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setMenuOpen(false)}
              >
                管理后台
              </Link>
            </nav>
          </div>
        )}
      </header>

      {/* Main */}
      <main className="relative z-10 pt-16">{children}</main>

      {/* Footer */}
      <footer className="relative z-10 mt-20 border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} AI Blog. Built with Next.js + AI.
        </div>
      </footer>

      {/* AI Chat Assistant */}
      <AIChatWidget />
    </div>
  );
}
