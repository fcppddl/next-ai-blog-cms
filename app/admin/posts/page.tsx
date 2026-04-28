"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import AdminLayout from "@/components/admin/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleLoading } from "@/components/ui/loading";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Calendar,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Post {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  featured: boolean;
  views: number;
  createdAt: string;
  updatedAt: string;
  category: { name: string; slug: string } | null;
  tags: { name: string; slug: string }[];
}

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);

    const res = await fetch(`/api/admin/posts?${params}`);
    const data = await res.json();
    setPosts(data.posts ?? []);
    setTotalPages(data.pagination?.totalPages ?? 1);
    setLoading(false);
  }, [page, search, status]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPosts();
  }, [fetchPosts]);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`确认删除文章「${title}」？此操作不可恢复。`)) return;
    setDeletingId(id);
    const res = await fetch(`/api/admin/posts/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "删除成功" });
      fetchPosts();
    } else {
      toast({ title: "删除失败", variant: "destructive" });
    }
    setDeletingId(null);
  };

  const togglePublish = async (post: Post) => {
    const res = await fetch(`/api/admin/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !post.published }),
    });
    if (res.ok) {
      toast({ title: post.published ? "已取消发布" : "已发布" });
      fetchPosts();
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-1 h-5 bg-indigo-600 dark:bg-violet-600 rounded-full" />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">文章管理</h1>
          </div>
          <Link href="/admin/posts/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新建文章
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
            <Input
              placeholder="搜索文章..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 dark:bg-gray-800/80 dark:border-slate-700 dark:text-gray-100 dark:placeholder:text-slate-500"
            />
          </div>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-10 min-w-[8rem] shrink-0 cursor-pointer border-gray-200 bg-white text-gray-900 dark:border-slate-600 dark:bg-slate-900/50 dark:text-gray-100">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="cursor-pointer">全部</SelectItem>
              <SelectItem value="published" className="cursor-pointer">已发布</SelectItem>
              <SelectItem value="draft" className="cursor-pointer">草稿</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm dark:shadow-none">
          {loading ? (
            <SimpleLoading />
          ) : posts.length === 0 ? (
            <div className="text-center py-16 text-gray-500">暂无文章</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-slate-500 uppercase tracking-wider">标题</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-slate-500 uppercase tracking-wider hidden md:table-cell">分类</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-slate-500 uppercase tracking-wider">状态</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-slate-500 uppercase tracking-wider hidden lg:table-cell">浏览</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-slate-500 uppercase tracking-wider hidden lg:table-cell">日期</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 dark:text-slate-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {posts.map((post) => (
                  <tr key={post.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-xs">{post.title}</div>
                      <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 font-mono">{post.slug}</div>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      {post.category ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 dark:bg-slate-700/80 dark:text-gray-100 dark:border-slate-600">{post.category.name}</span>
                      ) : (
                        <span className="text-gray-400 dark:text-slate-500 text-xs">无分类</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {post.published ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800">已发布</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-500 border border-gray-200 dark:bg-slate-800/80 dark:text-slate-400 dark:border-slate-600">草稿</span>
                      )}
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell text-sm text-gray-500 dark:text-slate-400">{post.views}</td>
                    <td className="px-6 py-4 hidden lg:table-cell text-sm text-gray-500 dark:text-slate-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-sky-600/80 dark:text-sky-400/80" />
                        {new Date(post.updatedAt).toLocaleDateString("zh-CN")}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 h-7 text-xs"
                          onClick={() => togglePublish(post)}
                          title={post.published ? "取消发布" : "发布"}
                        >
                          {post.published ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          {post.published ? "下架" : "发布"}
                        </Button>
                        <Button asChild size="sm" variant="outline" className="gap-1 h-7 text-xs">
                          <Link href={`/admin/posts/${post.id}/edit`}>
                            <Edit className="h-3 w-3" />
                            编辑
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 h-7 text-xs text-red-500 hover:text-red-600 hover:border-red-300"
                          onClick={() => handleDelete(post.id, post.title)}
                          disabled={deletingId === post.id}
                        >
                          <Trash2 className="h-3 w-3" />
                          删除
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 p-4 border-t border-gray-100 dark:border-gray-700">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                上一页
              </Button>
              <span className="flex items-center text-sm text-gray-500 dark:text-slate-400">
                {page} / {totalPages}
              </span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                下一页
              </Button>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
