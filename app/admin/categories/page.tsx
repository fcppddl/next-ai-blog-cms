"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SimpleLoading } from "@/components/ui/loading";
import { Plus, Trash2, Edit, X, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createSlug } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string | null;
  stats?: { totalPosts: number; publishedPosts: number };
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newIcon, setNewIcon] = useState("");
  const [editValues, setEditValues] = useState({
    name: "",
    slug: "",
    description: "",
    icon: "",
  });
  const { toast } = useToast();

  const fetchCategories = async () => {
    const res = await fetch("/api/admin/categories?includeStats=true");
    const data = await res.json();
    setCategories(data.categories ?? []);
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCategories();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName,
        slug: newSlug || createSlug(newName),
        description: newDesc || undefined,
        ...(newIcon.trim() ? { icon: newIcon.trim() } : {}),
      }),
    });
    if (res.ok) {
      toast({ title: "分类创建成功" });
      setNewName("");
      setNewSlug("");
      setNewDesc("");
      setNewIcon("");
      setCreating(false);
      fetchCategories();
    } else {
      const err = await res.json();
      toast({ title: err.error ?? "创建失败", variant: "destructive" });
    }
  };

  const handleUpdate = async (id: string) => {
    const res = await fetch(`/api/admin/categories/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editValues),
    });
    if (res.ok) {
      toast({ title: "分类已更新" });
      setEditingId(null);
      fetchCategories();
    } else {
      const err = await res.json();
      toast({ title: err.error ?? "更新失败", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确认删除分类「${name}」？`)) return;
    const res = await fetch(`/api/admin/categories/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast({ title: "分类已删除" });
      fetchCategories();
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditValues({
      name: cat.name,
      slug: cat.slug,
      description: cat.description ?? "",
      icon: cat.icon ?? "",
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-1 h-5 bg-indigo-600 dark:bg-violet-600 rounded-full" />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              分类管理
            </h1>
          </div>
          <Button onClick={() => setCreating(true)} disabled={creating}>
            <Plus className="h-4 w-4 mr-2" /> 新建分类
          </Button>
        </div>

        {/* Create Form */}
        {creating && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-none">
            <h3 className="mb-4 font-semibold text-gray-900 dark:text-gray-100">
              新建分类
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-gray-700 dark:text-slate-300">
                  名称 *
                </Label>
                <Input
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (!newSlug) setNewSlug(createSlug(e.target.value));
                  }}
                  placeholder="分类名称"
                  className="border-gray-200 bg-white text-gray-900 dark:border-slate-600 dark:bg-slate-900/50 dark:text-gray-100 dark:placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-700 dark:text-slate-300">
                  Slug *
                </Label>
                <Input
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  placeholder="url-slug"
                  className="font-mono border-gray-200 bg-white text-gray-900 dark:border-slate-600 dark:bg-slate-900/50 dark:text-gray-100 dark:placeholder:text-slate-500"
                />
              </div>
              {/* 图标与描述同一行（md+ 并排） */}
              <div className="space-y-2">
                <Label className="text-gray-700 dark:text-slate-300">
                  图标
                </Label>
                <Input
                  value={newIcon}
                  onChange={(e) => setNewIcon(e.target.value)}
                  placeholder="如 🤖（可选）"
                  maxLength={50}
                  className="border-gray-200 bg-white text-gray-900 dark:border-slate-600 dark:bg-slate-900/50 dark:text-gray-100 dark:placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-700 dark:text-slate-300">
                  描述
                </Label>
                <Input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="分类描述（可选）"
                  className="border-gray-200 bg-white text-gray-900 dark:border-slate-600 dark:bg-slate-900/50 dark:text-gray-100 dark:placeholder:text-slate-500"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button onClick={handleCreate}>创建</Button>
              <Button
                variant="outline"
                className="border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:bg-transparent dark:text-slate-300 dark:hover:bg-slate-700/80"
                onClick={() => {
                  setCreating(false);
                  setNewName("");
                  setNewSlug("");
                  setNewDesc("");
                  setNewIcon("");
                }}
              >
                取消
              </Button>
            </div>
          </div>
        )}

        {/* List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm dark:shadow-none overflow-hidden">
          {loading ? (
            <SimpleLoading />
          ) : categories.length === 0 ? (
            <div className="text-center py-16 text-gray-500">暂无分类</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase min-w-[10rem] w-[12%]">
                    图标
                  </th>
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
                {categories.map((cat) => (
                  <tr
                    key={cat.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    {/* 编辑时图标输入加宽 */}
                    <td className="px-6 py-4 align-middle min-w-[10rem] w-[12%]">
                      {editingId === cat.id ? (
                        <Input
                          value={editValues.icon}
                          onChange={(e) =>
                            setEditValues({
                              ...editValues,
                              icon: e.target.value,
                            })
                          }
                          className="h-8 w-full min-w-[9rem] text-base"
                          maxLength={50}
                          placeholder="🤖"
                          aria-label="分类图标"
                        />
                      ) : (
                        <span
                          className="text-xl leading-none"
                          title={cat.icon?.trim() || undefined}
                        >
                          {cat.icon?.trim() ? cat.icon : "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingId === cat.id ? (
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
                          {cat.name}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      {editingId === cat.id ? (
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
                          {cat.slug}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-500">
                        {cat.stats?.totalPosts ?? 0}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {editingId === cat.id ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-green-600"
                              onClick={() => handleUpdate(cat.id)}
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
                              onClick={() => startEdit(cat)}
                            >
                              <Edit className="h-3 w-3" />
                              编辑
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 h-7 text-xs text-red-500 hover:text-red-600 hover:border-red-300"
                              onClick={() => handleDelete(cat.id, cat.name)}
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
      </div>
    </AdminLayout>
  );
}
