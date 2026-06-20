import Link from "next/link";
import { X } from "lucide-react";
import PublicLayout from "@/components/layout/public-layout";
import AdminProfileCard from "@/components/profile/admin-profile-card";
import PostList from "@/components/posts/post-list";

interface HomePageProps {
  searchParams: Promise<{ category?: string; tag?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { category, tag } = await searchParams;

  return (
    <PublicLayout>
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Sidebar */}
          <AdminProfileCard />

          {/* Posts */}
          <div className="flex-1 min-w-0">
            {(category || tag) && (
              <div className="mb-6 flex items-center gap-2">
                <span className="text-sm text-muted-foreground">筛选</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
                  {category ?? tag}
                  {/* 关闭筛选按钮：点击返回无筛选参数的首页 */}
                  <Link
                    href="/"
                    className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:bg-primary/20"
                    aria-label="清除筛选"
                  >
                    <X className="h-3 w-3" />
                  </Link>
                </span>
              </div>
            )}
            <PostList category={category} tag={tag} />
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
