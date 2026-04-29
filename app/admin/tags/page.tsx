"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SimpleLoading } from "@/components/ui/loading";
import { Plus, Trash2, Edit, X, Check, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createSlug } from "@/lib/utils";

interface Tag {
  id: string;
  name: string;
  slug: string;
  stats?: { totalPosts: number; publishedPosts: number };
}

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [editValues, setEditValues] = useState({ name: "", slug: "" });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const { toast } = useToast();

  const fetchTags = async () => {
    const res = await fetch("/api/admin/tags?includeStats=true");
    const data = await res.json();
    setTags(data.tags ?? []);
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    fetchTags();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const res = await fetch("/api/admin/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName,
        slug: newSlug || createSlug(newName),
      }),
    });
    if (res.ok) {
      toast({ title: "标签创建成功" });
      setNewName("");
      setNewSlug("");
      setCreating(false);
      fetchTags();
    } else {
      const err = await res.json();
      toast({ title: err.error ?? "创建失败", variant: "destructive" });
    }
  };

  const handleUpdate = async (id: string) => {
    const res = await fetch(`/api/admin/tags/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editValues),
    });
    if (res.ok) {
      toast({ title: "标签已更新" });
      setEditingId(null);
      fetchTags();
    } else {
      const err = await res.json();
      toast({ title: err.error ?? "更新失败", variant: "destructive" });
    }
  };

  const confirmDeleteTag = async () => {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    setPendingDelete(null);
    setDeletingId(id);
    const res = await fetch(`/api/admin/tags/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "标签已删除" });
      fetchTags();
    } else {
      toast({ title: "删除失败", variant: "destructive" });
    }
    setDeletingId(null);
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-1 h-5 bg-indigo-600 dark:bg-violet-600 rounded-full" />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              标签管理
            </h1>
          </div>
          <Button onClick={() => setCreating(true)} disabled={creating}>
            <Plus className="h-4 w-4 mr-2" /> 新建标签
          </Button>
        </div>

        {creating && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-semibold mb-4">新建标签</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>名称 *</Label>
                <Input
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (!newSlug) setNewSlug(createSlug(e.target.value));
                  }}
                  placeholder="标签名称"
                />
              </div>
              <div className="space-y-2">
                <Label>Slug *</Label>
                <Input
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  placeholder="url-slug"
                  className="font-mono"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <Button onClick={handleCreate}>创建</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setCreating(false);
                  setNewName("");
                  setNewSlug("");
                }}
              >
                取消
              </Button>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {loading ? (
            <SimpleLoading />
          ) : tags.length === 0 ? (
            <div className="text-center py-16 text-gray-500">暂无标签</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                    名称
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">
                    Slug
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                    文章数
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {tags.map((tag) => (
                  <tr
                    key={tag.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-6 py-4">
                      {editingId === tag.id ? (
                        <Input
                          value={editValues.name}
                          onChange={(e) =>
                            setEditValues({
                              ...editValues,
                              name: e.target.value,
                            })
                          }
                          className="h-8"
                        />
                      ) : (
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {tag.name}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      {editingId === tag.id ? (
                        <Input
                          value={editValues.slug}
                          onChange={(e) =>
                            setEditValues({
                              ...editValues,
                              slug: e.target.value,
                            })
                          }
                          className="h-8 font-mono text-sm"
                        />
                      ) : (
                        <span className="font-mono text-xs text-gray-400">
                          {tag.slug}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-500">
                        {tag.stats?.totalPosts ?? 0}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {editingId === tag.id ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-green-600"
                              onClick={() => handleUpdate(tag.id)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => setEditingId(null)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 h-7 text-xs"
                              onClick={() => {
                                setEditingId(tag.id);
                                setEditValues({
                                  name: tag.name,
                                  slug: tag.slug,
                                });
                              }}
                            >
                              <Edit className="h-3 w-3" />
                              编辑
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 h-7 text-xs text-red-500 hover:text-red-600 hover:border-red-300"
                              onClick={() =>
                                setPendingDelete({ id: tag.id, name: tag.name })
                              }
                              disabled={deletingId === tag.id}
                            >
                              <Trash2 className="h-3 w-3" />
                              删除
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <Dialog
          open={pendingDelete !== null}
          onOpenChange={(open) => {
            if (!open) setPendingDelete(null);
          }}
        >
          <DialogContent showCloseButton className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-start gap-3 sm:text-left">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400">
                  <AlertTriangle className="h-5 w-5" aria-hidden />
                </span>
                <div className="space-y-1.5 pt-0.5">
                  <DialogTitle>删除标签</DialogTitle>
                  <DialogDescription className="text-left">
                    确认删除标签「{pendingDelete?.name ?? ""}」？此操作不可恢复。
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <DialogFooter className="gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPendingDelete(null)}
              >
                取消
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => void confirmDeleteTag()}
              >
                删除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
