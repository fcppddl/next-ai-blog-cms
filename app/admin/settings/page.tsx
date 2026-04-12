"use client";

import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/admin/admin-layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Trash2, Database, Loader2, CheckCircle2, AlertCircle, PlusCircle } from "lucide-react";

interface VectorPostRow {
  postId: string;
  title: string;
  slug: string;
  indexed: boolean;
  chunkCount: number;
  indexedAt: string | null;
  updatedAt: string | null;
}

interface IndexStatus {
  totalPosts: number;
  indexedCount: number;
  pendingCount: number;
  posts: VectorPostRow[];
}

export default function SettingsPage() {
  const [status, setStatus] = useState<IndexStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [indexingAll, setIndexingAll] = useState(false);
  const [postActions, setPostActions] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/admin/vector");
      if (res.ok) setStatus(await res.json());
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleIndexAll = async (force = false) => {
    setIndexingAll(true);
    try {
      const res = await fetch("/api/admin/vector", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "index_all", force }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: `索引完成：${data.indexed} 成功，${data.skipped} 跳过，${data.failed} 失败` });
        await fetchStatus();
      } else {
        toast({ title: data.error ?? "索引失败", variant: "destructive" });
      }
    } catch {
      toast({ title: "请求失败，请检查 Ollama / ChromaDB 是否已启动", variant: "destructive" });
    } finally {
      setIndexingAll(false);
    }
  };

  const handleIndexPost = async (postId: string) => {
    setPostActions((prev) => ({ ...prev, [postId]: true }));
    try {
      const res = await fetch("/api/admin/vector", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "index_post", postId, force: true }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "索引成功" });
        await fetchStatus();
      } else {
        toast({ title: data.error ?? "索引失败", variant: "destructive" });
      }
    } catch {
      toast({ title: "请求失败", variant: "destructive" });
    } finally {
      setPostActions((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleDeleteIndex = async (postId: string) => {
    setPostActions((prev) => ({ ...prev, [`del_${postId}`]: true }));
    try {
      const res = await fetch("/api/admin/vector", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_post", postId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "索引已删除" });
        await fetchStatus();
      } else {
        toast({ title: data.error ?? "删除失败", variant: "destructive" });
      }
    } catch {
      toast({ title: "请求失败", variant: "destructive" });
    } finally {
      setPostActions((prev) => ({ ...prev, [`del_${postId}`]: false }));
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-1 h-5 bg-indigo-600 dark:bg-violet-600 rounded-full" />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">RAG 向量索引</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStatus}
            disabled={loadingStatus}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loadingStatus ? "animate-spin" : ""}`} />
            刷新
          </Button>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "已发布文章", value: status?.totalPosts ?? "—", icon: Database, color: "text-gray-600 dark:text-gray-400" },
            { label: "已建索引", value: status?.indexedCount ?? "—", icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400" },
            { label: "待索引", value: status?.pendingCount ?? "—", icon: AlertCircle, color: status?.pendingCount ? "text-amber-600 dark:text-amber-400" : "text-gray-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
              <Icon className={`h-8 w-8 ${color}`} />
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-3">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">索引操作</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            需要本地运行 <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">Ollama</code>（nomic-embed-text）和{" "}
            <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">ChromaDB</code> 服务。
          </p>
          <div className="flex gap-3 flex-wrap">
            <Button
              onClick={() => handleIndexAll(false)}
              disabled={indexingAll}
              className="gap-2"
            >
              {indexingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              {indexingAll ? "索引中..." : "增量建索引"}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleIndexAll(true)}
              disabled={indexingAll}
              className="gap-2"
            >
              {indexingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              强制重建全量索引
            </Button>
          </div>
        </div>

        {/* Index Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">文章列表</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">展示全部已发布文章；未索引的可单独建立向量索引。</p>
          </div>
          {loadingStatus ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : !status?.posts.length ? (
            <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">
              暂无已发布文章
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <tr>
                  <th className="px-6 py-3 text-left">文章</th>
                  <th className="px-6 py-3 text-left">状态</th>
                  <th className="px-6 py-3 text-left">分块数</th>
                  <th className="px-6 py-3 text-left">索引更新</th>
                  <th className="px-6 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {status.posts.map((post) => (
                  <tr key={post.postId} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-3">
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-xs">{post.title}</p>
                      <p className="text-xs text-gray-400">{post.slug}</p>
                    </td>
                    <td className="px-6 py-3">
                      {post.indexed ? (
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                          已索引
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-700 border-amber-200 dark:text-amber-400 dark:border-amber-800">
                          未索引
                        </Badge>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      {post.indexed ? (
                        <Badge variant="secondary">{post.chunkCount} 块</Badge>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-gray-500 dark:text-gray-400 text-xs">
                      {post.updatedAt ? new Date(post.updatedAt).toLocaleString("zh-CN") : "—"}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex justify-end gap-2">
                        {post.indexed ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleIndexPost(post.postId)}
                              disabled={!!postActions[post.postId]}
                              className="gap-1 h-7 text-xs"
                            >
                              {postActions[post.postId] ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3 w-3" />
                              )}
                              重建
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteIndex(post.postId)}
                              disabled={!!postActions[`del_${post.postId}`]}
                              className="gap-1 h-7 text-xs text-red-500 hover:text-red-600 hover:border-red-300"
                            >
                              {postActions[`del_${post.postId}`] ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                              删除
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleIndexPost(post.postId)}
                            disabled={!!postActions[post.postId]}
                            className="gap-1 h-7 text-xs"
                          >
                            {postActions[post.postId] ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <PlusCircle className="h-3 w-3" />
                            )}
                            建立索引
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
