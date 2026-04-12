"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SimpleLoading } from "@/components/ui/loading";
import { cn } from "@/lib/utils";
import {
  Save,
  X,
  Eye,
  EyeOff,
  Star,
  Tag,
  ArrowLeft,
  Link2,
  Folder,
  ImageIcon,
  AlignLeft,
  Upload,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createSlug, calculateReadingTime, generateExcerpt } from "@/lib/utils";
import AIAssistant, {
  type AIRecommendation,
} from "@/components/admin/ai-assistant";
import TiptapEditor, {
  type TiptapEditorHandle,
} from "@/components/admin/tiptap-editor";
import CoverImagePicker from "@/components/admin/cover-image-picker";

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Tag {
  id: string;
  name: string;
  slug: string;
}

interface PostEditorProps {
  postId?: string;
}

interface FormValues {
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;
}

/** 从上传的 Markdown/纯文本解析标题与正文（支持 YAML frontmatter、首行 # 标题） */
function parseUploadedArticle(raw: string): { title: string; body: string } {
  const text = raw.replace(/^\uFEFF/, "");
  const trimmed = text.trimStart();
  if (trimmed.startsWith("---")) {
    const m = trimmed.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (m) {
      const fm = m[1];
      const body = m[2];
      let title = "";
      for (const line of fm.split(/\r?\n/)) {
        const t = line.match(/^title:\s*(.+)$/);
        if (t) {
          let v = t[1].trim();
          if (
            (v.startsWith('"') && v.endsWith('"')) ||
            (v.startsWith("'") && v.endsWith("'"))
          ) {
            v = v.slice(1, -1);
          }
          title = v;
          break;
        }
      }
      return { title, body };
    }
  }
  const lines = text.split(/\r?\n/);
  const first = lines[0]?.trim() ?? "";
  if (first.startsWith("# ")) {
    return {
      title: first.slice(2).trim(),
      body: lines.slice(1).join("\n").replace(/^\s+/, ""),
    };
  }
  return { title: "", body: text };
}

export default function PostEditor({ postId }: PostEditorProps) {
  const router = useRouter();
  const { toast } = useToast();
  const isEditing = !!postId;

  const [content, setContent] = useState("");
  const [published, setPublished] = useState(false);
  const [featured, setFeatured] = useState(false);
  const [categoryId, setCategoryId] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  const editorRef = useRef<TiptapEditorHandle>(null);
  const articleFileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { title: "", slug: "", excerpt: "", coverImage: "" },
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const title = watch("title");

  // Auto-generate slug from title
  useEffect(() => {
    if (!isEditing && title) {
      setValue("slug", createSlug(title));
    }
  }, [title, isEditing, setValue]);

  // Load categories and tags
  useEffect(() => {
    Promise.all([
      fetch("/api/admin/categories").then((r) => r.json()),
      fetch("/api/admin/tags").then((r) => r.json()),
    ]).then(([catData, tagData]) => {
      setCategories(catData.categories ?? []);
      setTags(tagData.tags ?? []);
    });
  }, []);

  // Load existing post
  useEffect(() => {
    if (!postId) return;
    fetch(`/api/admin/posts/${postId}`)
      .then((r) => r.json())
      .then((post) => {
        setValue("title", post.title);
        setValue("slug", post.slug);
        setValue("excerpt", post.excerpt ?? "");
        setValue("coverImage", post.coverImage ?? "");
        setContent(post.content ?? "");
        setPublished(post.published);
        setFeatured(post.featured);
        setCategoryId(post.categoryId ?? "");
        setSelectedTags(post.tags?.map((t: Tag) => t.id) ?? []);
        setLoading(false);
      });
  }, [postId, setValue]);

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  };

  // AI assistant callbacks
  const handleAITitleSelect = (aiTitle: string) => setValue("title", aiTitle);
  const handleAIExcerptGenerated = (excerpt: string) =>
    setValue("excerpt", excerpt);

  const handleAITagsGenerated = (recommendation: AIRecommendation) => {
    const matchedIds = tags
      .filter((t) => recommendation.existing.includes(t.name))
      .map((t) => t.id);
    if (matchedIds.length > 0) {
      setSelectedTags((prev) => [...new Set([...prev, ...matchedIds])]);
    }
  };

  const handleAICategoryGenerated = (recommendation: AIRecommendation) => {
    const matched = categories.find((c) =>
      recommendation.existing.includes(c.name),
    );
    if (matched) setCategoryId(matched.id);
  };

  const handleArticleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      if (!/\.(md|markdown|txt)$/i.test(file.name)) {
        toast({
          title: "请上传 Markdown 或文本文件",
          description: "支持 .md、.markdown、.txt",
          variant: "destructive",
        });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const raw = String(reader.result ?? "");
        const { title: parsedTitle, body } = parseUploadedArticle(raw);
        const baseName = file.name.replace(/\.[^.]+$/, "");
        const nextTitle = (parsedTitle || baseName).trim();
        if (!body.trim()) {
          toast({ title: "文件内容为空", variant: "destructive" });
          return;
        }
        setValue("title", nextTitle);
        setContent(body);
        editorRef.current?.setMarkdown(body);
        toast({ title: "已从文件载入", description: "标题与正文已回填" });
      };
      reader.onerror = () => {
        toast({ title: "读取文件失败", variant: "destructive" });
      };
      reader.readAsText(file, "UTF-8");
    },
    [setValue, toast],
  );

  const onSubmit = useCallback(
    async (values: FormValues) => {
      const markdown = editorRef.current?.getMarkdown() ?? content;
      if (!markdown.trim()) {
        toast({ title: "请输入文章内容", variant: "destructive" });
        return;
      }
      setSaving(true);

      const payload = {
        title: values.title,
        slug: values.slug,
        content: markdown,
        excerpt: values.excerpt || generateExcerpt(markdown),
        coverImage: values.coverImage || undefined,
        published,
        featured,
        readingTime: calculateReadingTime(markdown),
        categoryId: categoryId || undefined,
        tags: selectedTags,
      };

      const url = isEditing ? `/api/admin/posts/${postId}` : "/api/admin/posts";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast({ title: isEditing ? "文章已更新" : "文章已创建" });
        router.push("/admin/posts");
      } else {
        const err = await res.json();
        toast({ title: err.error ?? "保存失败", variant: "destructive" });
      }
      setSaving(false);
    },
    [
      content,
      published,
      featured,
      categoryId,
      selectedTags,
      isEditing,
      postId,
      router,
      toast,
    ],
  );

  if (loading) return <SimpleLoading />;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          className="gap-2 text-gray-500 hover:text-indigo-700 hover:bg-indigo-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </Button>
        <div className="flex items-center gap-3">
          <AIAssistant
            content={content}
            title={watch("title")}
            onTitleSelect={handleAITitleSelect}
            onExcerptGenerated={handleAIExcerptGenerated}
            onTagsGenerated={handleAITagsGenerated}
            onCategoryGenerated={handleAICategoryGenerated}
            onContentInsert={(text) => editorRef.current?.insertMarkdown(text)}
            onContentReplace={(text) => editorRef.current?.setMarkdown(text)}
          />
          <button
            type="button"
            onClick={() => setFeatured(!featured)}
            className={cn(
              "flex items-center gap-1.5 px-3 h-8 rounded-lg text-sm font-medium border transition-all cursor-pointer",
              featured
                ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                : "bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600 dark:bg-transparent dark:text-slate-400 dark:border-slate-600 dark:hover:border-slate-500 dark:hover:text-slate-200",
            )}
          >
            <Star
              className={cn(
                "h-3.5 w-3.5",
                featured
                  ? "fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400"
                  : "",
              )}
            />
            精选
          </button>
          <button
            type="button"
            onClick={() => setPublished(!published)}
            className={cn(
              "flex items-center gap-1.5 px-3 h-8 rounded-lg text-sm font-medium border transition-all cursor-pointer",
              published
                ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                : "bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600 dark:bg-transparent dark:text-slate-400 dark:border-slate-600 dark:hover:border-slate-500 dark:hover:text-slate-200",
            )}
          >
            {published ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" />
            )}
            {published ? "已发布" : "草稿"}
          </button>
          {!isEditing && (
            <>
              <input
                ref={articleFileInputRef}
                type="file"
                accept=".md,.markdown,.txt,text/markdown,text/plain"
                className="hidden"
                onChange={handleArticleFileChange}
              />
              <Button
                type="button"
                variant="outline"
                className="gap-1.5 h-8 border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/10"
                onClick={() => articleFileInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                上传
              </Button>
            </>
          )}
          <Button type="submit" disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "保存中..." : isEditing ? "更新" : "创建"}
          </Button>
        </div>
      </div>

      {/* Title */}
      <div>
        <Input
          {...register("title", { required: "请输入标题" })}
          placeholder="文章标题"
          className="text-2xl font-bold border-0 border-b-2 rounded-none px-0 h-auto py-3 focus-visible:ring-0 text-2xl border-gray-200 dark:border-slate-700 bg-transparent dark:text-white dark:placeholder:text-slate-500"
        />
        {errors.title && (
          <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-950/40 shadow-sm dark:shadow-none">
          <TiptapEditor
            ref={editorRef}
            initialContent={content}
            onChange={setContent}
            minHeight={500}
            className="border-0 rounded-none"
          />
        </div>

        {/* Sidebar — dark cards aligned with admin tables */}
        <div className="space-y-4">
          {/* Slug */}
          <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-none">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gray-100 dark:bg-slate-700/90">
                <Link2 className="h-3.5 w-3.5 text-gray-500 dark:text-slate-300" />
              </span>
              URL Slug
            </h3>
            <Input
              {...register("slug", { required: "请输入 slug" })}
              placeholder="url-slug"
              className="font-mono text-sm border-gray-200 bg-white text-gray-900 dark:border-slate-600 dark:bg-slate-900/50 dark:text-gray-100 dark:placeholder:text-slate-500"
            />
            {errors.slug && (
              <p className="text-red-500 text-xs">{errors.slug.message}</p>
            )}
          </div>

          {/* Category */}
          <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-none">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-violet-50 dark:bg-violet-950/40">
                <Folder className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
              </span>
              分类
            </h3>
            <Select
              value={categoryId || "__none__"}
              onValueChange={(v) => setCategoryId(v === "__none__" ? "" : v)}
            >
              <SelectTrigger className="w-full border-gray-200 bg-white text-gray-900 dark:border-slate-600 dark:bg-slate-900/50 dark:text-gray-100">
                <SelectValue placeholder="选择分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">无分类</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-none">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-purple-50 dark:bg-purple-950/40">
                <Tag className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
              </span>
              标签
            </h3>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const active = selectedTags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={cn(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all cursor-pointer",
                      active
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-gray-300 bg-slate-50 text-gray-600 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:text-indigo-300",
                    )}
                  >
                    {active && <X className="h-3 w-3 mr-1" />}
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cover Image */}
          <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-none">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-950/40">
                <ImageIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              </span>
              封面图片
            </h3>
            <CoverImagePicker
              value={watch("coverImage")}
              onChange={(url) => setValue("coverImage", url)}
            />
          </div>

          {/* Excerpt */}
          <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-none">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-50 dark:bg-indigo-950/40">
                <AlignLeft className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              </span>
              摘要
            </h3>
            <Textarea
              {...register("excerpt")}
              placeholder="文章摘要（留空自动生成）"
              rows={3}
              className="resize-none border-gray-200 bg-white text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-900/50 dark:text-gray-100 dark:placeholder:text-slate-500"
            />
          </div>
        </div>
      </div>
    </form>
  );
}
