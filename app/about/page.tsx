import PublicLayout from "@/components/layout/public-layout";
import AdminProfileCard from "@/components/profile/admin-profile-card";

export default function AboutPage() {
  return (
    <PublicLayout>
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex gap-12">
          <AdminProfileCard />
          <div className="flex-1 min-w-0">
            <h1 className="mb-6 border-b border-border pb-4 text-4xl font-black text-foreground">
              关于
            </h1>
            <div className="prose prose-gray max-w-none dark:prose-invert">
              <p className="text-lg leading-relaxed text-foreground">
                这是一个基于 Next.js 和 AI 技术构建的现代化博客系统。
              </p>
              <p className="text-muted-foreground">
                本站使用 Next.js App Router、Prisma ORM、NextAuth.js 身份验证，
                以及 AI 辅助写作功能，为内容创作提供全方位支持。
              </p>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
