import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequestWithAuth } from "next-auth/middleware";

// proxy 是 Next.js 16 的新名称（原 middleware），功能不变
export const proxy = withAuth(
  function proxy(request: NextRequestWithAuth) {
    const { token } = request.nextauth;
    const { pathname } = request.nextUrl;

    // 已登录用户访问登录页，重定向到管理后台
    if (pathname === "/login" && token) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        if (pathname.startsWith("/admin")) return !!token;
        if (pathname.startsWith("/api/admin")) return !!token;

        return true;
      },
    },
    pages: {
      signIn: "/login",
    },
  },
);

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/login"],
};
