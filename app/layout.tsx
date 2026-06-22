import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import AuthProvider from "@/components/providers/auth-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import PublicEffects from "@/components/layout/public-effects";
import AIChatWidget from "@/components/chat/ai-chat";
import "./globals.css";

export const metadata: Metadata = {
  title: "码界网",
  description: "基于 Next.js + AI 的现代化博客系统",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <head>
        {/* 预加载 Live2D 模型骨骼，避免首屏长时间等待 */}
        <link rel="preload" href="/live2d/mao_zh-Hans/runtime/mao_pro.moc3" as="fetch" />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
          <Toaster />
          <PublicEffects />
          {/* AI Chat Assistant — 放在根布局避免客户端导航时重新挂载导致 Live2D 角色闪烁 */}
          <AIChatWidget />
        </ThemeProvider>
      </body>
    </html>
  );
}
