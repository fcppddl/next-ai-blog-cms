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
                <span className="inline-flex items-center rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
                  {category ?? tag}
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
