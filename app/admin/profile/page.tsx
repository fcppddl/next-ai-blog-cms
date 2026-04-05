"use client";

import { useState, useEffect, useRef } from "react";
import AdminLayout from "@/components/admin/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SimpleLoading } from "@/components/ui/loading";
import { useToast } from "@/hooks/use-toast";
import { Save, Upload, User } from "lucide-react";

interface ProfileForm {
  username: string;
  password: string;
  displayName: string;
  bio: string;
  avatar: string;
  email: string;
  github: string;
  twitter: string;
  website: string;
  location: string;
  company: string;
  position: string;
}

export default function ProfilePage() {
  const [form, setForm] = useState<ProfileForm>({
    username: "", password: "", displayName: "", bio: "", avatar: "",
    email: "", github: "", twitter: "", website: "", location: "", company: "", position: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/admin/profile")
      .then((r) => r.json())
      .then((data) => {
        setForm({
          username: data.username ?? "",
          password: "",
          displayName: data.profile?.displayName ?? "",
          bio: data.profile?.bio ?? "",
          avatar: data.profile?.avatar ?? "",
          email: data.profile?.email ?? "",
          github: data.profile?.github ?? "",
          twitter: data.profile?.twitter ?? "",
          website: data.profile?.website ?? "",
          location: data.profile?.location ?? "",
          company: data.profile?.company ?? "",
          position: data.profile?.position ?? "",
        });
        setLoading(false);
      });
  }, []);

  const handleChange = (key: keyof ProfileForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form };
    if (!payload.password) delete (payload as Partial<ProfileForm>).password;

    const res = await fetch("/api/admin/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      toast({ title: "个人信息已更新" });
      setForm((prev) => ({ ...prev, password: "" }));
    } else {
      const err = await res.json();
      toast({ title: err.error ?? "更新失败", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/avatar", { method: "POST", body: fd });
    if (res.ok) {
      const { url } = await res.json();
      setForm((prev) => ({ ...prev, avatar: url }));
      toast({ title: "头像上传成功" });
    } else {
      const err = await res.json();
      toast({ title: err.error ?? "上传失败", variant: "destructive" });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (loading) return <AdminLayout><SimpleLoading /></AdminLayout>;

  return (
    <AdminLayout>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-1 h-5 bg-indigo-600 rounded-full" />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">个人信息</h1>
          </div>
          <Button type="submit" disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "保存中..." : "保存更改"}
          </Button>
        </div>

        {/* Account */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">账号设置</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>用户名 *</Label>
              <Input value={form.username} onChange={handleChange("username")} required />
            </div>
            <div className="space-y-2">
              <Label>新密码（留空不修改）</Label>
              <Input type="password" value={form.password} onChange={handleChange("password")} placeholder="新密码" />
            </div>
          </div>
        </div>

        {/* Profile */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">个人资料</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>显示名称</Label>
              <Input value={form.displayName} onChange={handleChange("displayName")} placeholder="显示名称" />
            </div>
            <div className="space-y-2">
              <Label>头像</Label>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center flex-shrink-0">
                  {form.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.avatar} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="h-5 w-5 text-gray-400" />
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? "上传中..." : "上传图片"}
                </Button>
                {form.avatar && (
                  <span className="text-xs text-gray-400 truncate max-w-[160px]">{form.avatar}</span>
                )}
              </div>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>个人简介</Label>
              <Textarea value={form.bio} onChange={handleChange("bio")} placeholder="简介..." rows={3} className="resize-none" />
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">联系方式</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {([
              ["email", "邮箱", "your@email.com"],
              ["github", "GitHub", "https://github.com/username"],
              ["twitter", "Twitter", "https://twitter.com/username"],
              ["website", "个人网站", "https://yoursite.com"],
              ["location", "所在地", "城市, 国家"],
              ["company", "公司", "公司名称"],
              ["position", "职位", "职位头衔"],
            ] as [keyof ProfileForm, string, string][]).map(([key, label, placeholder]) => (
              <div key={key} className="space-y-2">
                <Label>{label}</Label>
                <Input value={form[key]} onChange={handleChange(key)} placeholder={placeholder} />
              </div>
            ))}
          </div>
        </div>

      </form>
    </AdminLayout>
  );
}
