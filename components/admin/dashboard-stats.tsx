import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  FileText,
  FolderOpen,
  Tags,
  Eye,
  CheckCircle2,
  Star,
  Layers,
} from "lucide-react";

async function getStats() {
  const [
    totalPosts,
    statusGroups,
    categories,
    tags,
    viewsAgg,
    recentPosts,
    topPosts,
    indexedPosts,
  ] = await Promise.all([
    prisma.post.count(),
    prisma.post.groupBy({
      by: ["published", "featured"],
      _count: { id: true },
    }),
    prisma.category.count(),
    prisma.tag.count(),
    prisma.post.aggregate({ _sum: { views: true } }),
    prisma.post.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
        published: true,
        views: true,
      },
    }),
    prisma.post.findMany({
      take: 5,
      where: { published: true },
      orderBy: { views: "desc" },
      select: { id: true, title: true, views: true },
    }),
    prisma.postVectorIndex.count(),
  ]);

  const publishedPosts =
    statusGroups.find((s) => s.published === true)?._count.id ?? 0;
  const draftPosts =
    statusGroups.find((s) => s.published === false)?._count.id ?? 0;
  const featuredPosts =
    statusGroups.find((s) => s.featured === true)?._count.id ?? 0;

  return {
    totalPosts,
    publishedPosts,
    draftPosts,
    featuredPosts,
    categories,
    tags,
    totalViews: viewsAgg._sum.views ?? 0,
    recentPosts,
    topPosts,
    indexedPosts,
  };
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return "夜深了";
  if (h < 9) return "早上好";
  if (h < 12) return "上午好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  if (h < 22) return "晚上好";
  return "夜深了";
}

export default async function DashboardStats() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") return null;

  const stats = await getStats();
  const publishRate =
    stats.totalPosts > 0
      ? Math.round((stats.publishedPosts / stats.totalPosts) * 100)
      : 0;

  let displayName = session.user.displayName || session.user.username || "博主";
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { profile: true },
    });
    if (user?.profile?.displayName) displayName = user.profile.displayName;
  } catch {}

  // AIGC START — 使用 text-foreground / bg-card 等语义色，避免 text-gray-900 在暗色下与深色底撞色
  return (
    <div className="space-y-6 text-card-foreground">
      {/* Welcome */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600" />
        <div className="p-8">
          <h2 className="mb-1.5 text-2xl font-bold text-foreground">
            {getGreeting()}，{displayName} 👋
          </h2>
          <p className="text-base text-muted-foreground">
            欢迎回到你的创作空间
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {[
          {
            title: "全部文章",
            value: stats.totalPosts,
            desc: `${stats.publishedPosts} 已发布 · ${stats.draftPosts} 草稿`,
            icon: FileText,
            iconBg: "bg-blue-500/15",
            iconColor: "text-blue-600 dark:text-blue-400",
          },
          {
            title: "总浏览量",
            value: stats.totalViews,
            desc: "所有文章浏览次数",
            icon: Eye,
            iconBg: "bg-indigo-500/15",
            iconColor: "text-indigo-600 dark:text-indigo-400",
          },
          {
            title: "已建立索引",
            value: stats.indexedPosts,
            desc:
              stats.totalPosts === 0
                ? "暂无文章"
                : stats.indexedPosts === stats.totalPosts
                  ? "全部文章已可用于问答"
                  : `${stats.totalPosts - stats.indexedPosts} 篇未建立索引`,
            icon: Layers,
            iconBg: "bg-amber-500/15",
            iconColor: "text-amber-600 dark:text-amber-400",
          },
          {
            title: "分类",
            value: stats.categories,
            desc: "内容分类数量",
            icon: FolderOpen,
            iconBg: "bg-violet-500/15",
            iconColor: "text-violet-600 dark:text-violet-400",
          },
          {
            title: "标签",
            value: stats.tags,
            desc: "文章标签数量",
            icon: Tags,
            iconBg: "bg-emerald-500/15",
            iconColor: "text-emerald-600 dark:text-emerald-400",
          },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.title}
              className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">
                    {s.title}
                  </div>
                  <div className="text-3xl font-bold text-foreground">
                    {s.value.toLocaleString()}
                  </div>
                </div>
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.iconBg}`}
                >
                  <Icon className={`h-5 w-5 ${s.iconColor}`} />
                </div>
              </div>
              <div className="text-xs text-muted-foreground">{s.desc}</div>
            </div>
          );
        })}
      </div>

      {/* Progress + Overview */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="gap-4 border-border bg-card p-6 shadow-sm">
          <div className="mb-0 flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">
              发布进度
            </h3>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-muted-foreground">已发布文章</span>
                <span className="font-semibold text-foreground">
                  {stats.publishedPosts} / {stats.totalPosts}
                </span>
              </div>
              <Progress
                value={publishRate}
                className="h-1.5 bg-muted [&>[data-slot=progress-indicator]]:bg-primary"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                {publishRate}% 完成
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4 border-t border-border pt-4 text-center">
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {stats.publishedPosts}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">已发布</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {stats.draftPosts}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">草稿</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {stats.featuredPosts}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">精选</div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="gap-4 border-border bg-card p-6 shadow-sm">
          <div className="mb-0 flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">
              内容概览
            </h3>
            <Star className="h-4 w-4 text-amber-400" />
          </div>
          <div className="space-y-2">
            {[
              {
                label: "平均浏览量",
                value:
                  stats.publishedPosts > 0
                    ? Math.round(stats.totalViews / stats.publishedPosts)
                    : 0,
              },
              {
                label: "每分类文章数",
                value:
                  stats.categories > 0
                    ? Math.round(stats.totalPosts / stats.categories)
                    : 0,
              },
              { label: "标签总数", value: stats.tags },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2.5"
              >
                <span className="text-sm text-muted-foreground">
                  {item.label}
                </span>
                <span className="text-base font-bold text-foreground">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent + Top Posts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="gap-4 border-border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-foreground">
            最近文章
          </h3>
          <div className="space-y-1">
            {stats.recentPosts.length > 0 ? (
              stats.recentPosts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {post.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(post.createdAt).toLocaleDateString("zh-CN")}
                    </p>
                  </div>
                  <div className="ml-4 flex shrink-0 items-center space-x-1 text-xs text-muted-foreground">
                    <Eye className="h-3.5 w-3.5 text-emerald-600/80 dark:text-emerald-400/80" />
                    <span>{post.views}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                暂无文章
              </p>
            )}
          </div>
        </Card>

        <Card className="gap-4 border-border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-foreground">
            热门文章
          </h3>
          <div className="space-y-1">
            {stats.topPosts.length > 0 ? (
              stats.topPosts.map((post, i) => (
                <div
                  key={post.id}
                  className="flex items-center space-x-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                      i === 0
                        ? "bg-primary text-primary-foreground"
                        : i < 3
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {post.title}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center space-x-1 text-xs text-muted-foreground">
                    <Eye className="h-3.5 w-3.5 text-emerald-600/80 dark:text-emerald-400/80" />
                    <span>{post.views.toLocaleString()}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                暂无数据
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
