"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles,
  Loader2,
  Wand2,
  FileText,
  Tag,
  ListTree,
  Pencil,
  Folder,
  Check,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AI_GENERATION_TYPES, type AIGenerationType } from "@/lib/ai/constants";

export interface AIRecommendation {
  existing: string[];
  new: string[];
}

interface AIAssistantProps {
  content: string;
  title: string;
  onTitleSelect?: (title: string) => void;
  onExcerptGenerated?: (excerpt: string) => void;
  onTagsGenerated?: (recommendation: AIRecommendation) => void;
  onCategoryGenerated?: (recommendation: AIRecommendation) => void;
  onContentInsert?: (text: string) => void;
  onContentReplace?: (text: string) => void;
}

interface GenerationResult {
  type: AIGenerationType;
  results: string | string[] | AIRecommendation;
}

const MENU_GROUPS = [
  {
    label: "内容生成",
    items: [
      { type: AI_GENERATION_TYPES.TITLE, label: "生成标题", loadingLabel: "生成中...", icon: Wand2, iconBg: "bg-blue-50", iconColor: "text-blue-600" },
      { type: AI_GENERATION_TYPES.EXCERPT, label: "生成摘要", loadingLabel: "生成中...", icon: FileText, iconBg: "bg-indigo-50", iconColor: "text-indigo-600" },
    ],
  },
  {
    label: "智能推荐",
    items: [
      { type: AI_GENERATION_TYPES.CATEGORY, label: "推荐分类", loadingLabel: "分析中...", icon: Folder, iconBg: "bg-violet-50", iconColor: "text-violet-600" },
      { type: AI_GENERATION_TYPES.TAGS, label: "推荐标签", loadingLabel: "分析中...", icon: Tag, iconBg: "bg-purple-50", iconColor: "text-purple-600" },
    ],
  },
  {
    label: "写作辅助",
    items: [
      { type: AI_GENERATION_TYPES.OUTLINE, label: "生成大纲", loadingLabel: "生成中...", icon: ListTree, iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
      { type: AI_GENERATION_TYPES.POLISH, label: "全文润色", loadingLabel: "润色中...", icon: Pencil, iconBg: "bg-amber-50", iconColor: "text-amber-600" },
    ],
  },
];

export default function AIAssistant({
  content,
  title,
  onTitleSelect,
  onExcerptGenerated,
  onTagsGenerated,
  onCategoryGenerated,
  onContentInsert,
  onContentReplace,
}: AIAssistantProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<AIGenerationType | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
  const [showPolishDialog, setShowPolishDialog] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isPolishing, setIsPolishing] = useState(false);

  const { toast } = useToast();

  const generateContent = async (type: AIGenerationType) => {
    if (type === AI_GENERATION_TYPES.POLISH) {
      if (!content.trim()) {
        toast({ title: "内容为空", description: "请先输入文章内容", variant: "warning" });
        return;
      }
      setShowPolishDialog(true);
      return;
    }

    if (!content.trim() && type !== AI_GENERATION_TYPES.OUTLINE) {
      toast({ title: "内容为空", description: "请先输入文章内容", variant: "warning" });
      return;
    }

    setIsLoading(true);
    setLoadingType(type);

    try {
      const response = await fetch("/api/ai/write/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          content: type === AI_GENERATION_TYPES.OUTLINE ? title || "技术博客文章" : content,
          options: { count: type === AI_GENERATION_TYPES.TITLE ? 3 : undefined },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "生成失败");
      }

      const data = await response.json();
      setGenerationResult({ type, results: data.results });
      setShowResultDialog(true);
    } catch (error) {
      toast({
        title: "生成失败",
        description: error instanceof Error ? error.message : "AI 生成失败，请重试",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  const handlePolish = async () => {
    setIsPolishing(true);
    try {
      const response = await fetch("/api/ai/write/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: AI_GENERATION_TYPES.POLISH,
          content,
          options: { customPrompt: customPrompt.trim() || undefined },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "润色失败");
      }

      const data = await response.json();
      if (typeof data.results === "string") {
        setGenerationResult({ type: AI_GENERATION_TYPES.POLISH, results: data.results });
        setShowPolishDialog(false);
        setShowResultDialog(true);
        setCustomPrompt("");
      }
    } catch (error) {
      toast({
        title: "润色失败",
        description: error instanceof Error ? error.message : "润色失败，请重试",
        variant: "destructive",
      });
    } finally {
      setIsPolishing(false);
    }
  };

  const handleResultSelect = (result?: string) => {
    if (!generationResult) return;

    switch (generationResult.type) {
      case AI_GENERATION_TYPES.TITLE:
        if (result) { onTitleSelect?.(result); toast({ title: "已应用标题" }); }
        break;
      case AI_GENERATION_TYPES.EXCERPT:
        if (typeof generationResult.results === "string") { onExcerptGenerated?.(generationResult.results); toast({ title: "已生成摘要" }); }
        break;
      case AI_GENERATION_TYPES.TAGS:
        if (isRecommendation(generationResult.results)) { onTagsGenerated?.(generationResult.results); toast({ title: "已生成标签推荐" }); }
        break;
      case AI_GENERATION_TYPES.CATEGORY:
        if (isRecommendation(generationResult.results)) { onCategoryGenerated?.(generationResult.results); toast({ title: "已生成分类推荐" }); }
        break;
      case AI_GENERATION_TYPES.OUTLINE:
        if (typeof generationResult.results === "string") { onContentInsert?.(generationResult.results); toast({ title: "已插入内容" }); }
        break;
      case AI_GENERATION_TYPES.POLISH:
        if (typeof generationResult.results === "string") { onContentReplace?.(generationResult.results); toast({ title: "已应用润色内容" }); }
        break;
    }

    setShowResultDialog(false);
  };

  const isRecommendation = (value: unknown): value is AIRecommendation =>
    typeof value === "object" && value !== null && "existing" in value && "new" in value &&
    Array.isArray((value as AIRecommendation).existing) && Array.isArray((value as AIRecommendation).new);

  const getTypeLabel = (type: AIGenerationType) => ({
    [AI_GENERATION_TYPES.TITLE]: "标题推荐",
    [AI_GENERATION_TYPES.EXCERPT]: "摘要生成",
    [AI_GENERATION_TYPES.TAGS]: "标签推荐",
    [AI_GENERATION_TYPES.CATEGORY]: "分类推荐",
    [AI_GENERATION_TYPES.OUTLINE]: "大纲生成",
    [AI_GENERATION_TYPES.EXPAND]: "内容扩展",
    [AI_GENERATION_TYPES.POLISH]: "全文润色",
  }[type]);

  const getTypeIcon = (type: AIGenerationType) => {
    const map: Partial<Record<AIGenerationType, { bg: string; color: string; Icon: typeof Sparkles }>> = {
      [AI_GENERATION_TYPES.TITLE]: { bg: "bg-blue-50", color: "text-blue-600", Icon: Wand2 },
      [AI_GENERATION_TYPES.EXCERPT]: { bg: "bg-indigo-50", color: "text-indigo-600", Icon: FileText },
      [AI_GENERATION_TYPES.TAGS]: { bg: "bg-purple-50", color: "text-purple-600", Icon: Tag },
      [AI_GENERATION_TYPES.CATEGORY]: { bg: "bg-violet-50", color: "text-violet-600", Icon: Folder },
      [AI_GENERATION_TYPES.OUTLINE]: { bg: "bg-emerald-50", color: "text-emerald-600", Icon: ListTree },
      [AI_GENERATION_TYPES.POLISH]: { bg: "bg-amber-50", color: "text-amber-600", Icon: Pencil },
    };
    return map[type] ?? { bg: "bg-blue-50", color: "text-blue-600", Icon: Sparkles };
  };

  const currentTypeStyle = generationResult ? getTypeIcon(generationResult.type) : null;

  return (
    <>
      {/* Trigger */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={isLoading}
            className="h-8 gap-1.5 border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 hover:border-indigo-300 transition-colors dark:border-violet-500/50 dark:bg-transparent dark:text-violet-300 dark:hover:bg-violet-950/40 dark:hover:border-violet-400"
          >
            {isLoading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Sparkles className="h-3.5 w-3.5" />
            }
            AI 助手
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-52 p-1.5 shadow-lg border-gray-200 rounded-xl">
          {MENU_GROUPS.map((group, gi) => (
            <div key={group.label}>
              {gi > 0 && <DropdownMenuSeparator className="my-1 bg-gray-100" />}
              <p className="px-2 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                {group.label}
              </p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isThisLoading = loadingType === item.type;
                return (
                  <DropdownMenuItem
                    key={item.type}
                    onClick={() => generateContent(item.type)}
                    disabled={isLoading}
                    className="flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer hover:bg-gray-50 focus:bg-gray-50"
                  >
                    <div className={`w-6 h-6 rounded-md ${item.iconBg} flex items-center justify-center flex-shrink-0`}>
                      {isThisLoading
                        ? <Loader2 className={`h-3.5 w-3.5 ${item.iconColor} animate-spin`} />
                        : <Icon className={`h-3.5 w-3.5 ${item.iconColor}`} />
                      }
                    </div>
                    <span className="text-sm text-gray-700">
                      {isThisLoading ? item.loadingLabel : item.label}
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 润色设置弹窗 */}
      <Dialog open={showPolishDialog} onOpenChange={setShowPolishDialog}>
        <DialogContent className="max-w-sm p-0 overflow-hidden border-gray-200 shadow-lg rounded-2xl">
          <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400" />
          <div className="p-6">
            <DialogHeader className="mb-4">
              <DialogTitle className="flex items-center gap-2.5 text-base">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Pencil className="h-4 w-4 text-amber-600" />
                </div>
                全文润色
              </DialogTitle>
              <DialogDescription className="text-gray-500 text-sm">
                当前文章约 {content.length} 字，可附加润色要求
              </DialogDescription>
            </DialogHeader>

            <Textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="润色要求（可选）：如使用更正式的语气、精简冗余表达..."
              rows={3}
              className="resize-none text-sm border-gray-200 focus:border-amber-400 focus:ring-amber-100"
            />

            <DialogFooter className="mt-4 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setShowPolishDialog(false); setCustomPrompt(""); }}
                disabled={isPolishing}
                className="border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                取消
              </Button>
              <Button
                size="sm"
                onClick={handlePolish}
                disabled={isPolishing}
                className="bg-amber-500 hover:bg-amber-600 text-white border-0 gap-1.5"
              >
                {isPolishing
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />润色中...</>
                  : <><Sparkles className="h-3.5 w-3.5" />开始润色</>
                }
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* 结果弹窗 */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto p-0 border-gray-200 shadow-lg rounded-2xl">
          {/* Accent stripe */}
          {currentTypeStyle && (
            <div className="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600" />
          )}

          <div className="p-6">
            <DialogHeader className="mb-5">
              <DialogTitle className="flex items-center gap-2.5 text-base">
                {currentTypeStyle && (
                  <div className={`w-8 h-8 rounded-lg ${currentTypeStyle.bg} flex items-center justify-center flex-shrink-0`}>
                    <currentTypeStyle.Icon className={`h-4 w-4 ${currentTypeStyle.color}`} />
                  </div>
                )}
                {generationResult && getTypeLabel(generationResult.type)}
              </DialogTitle>
              <DialogDescription className="text-gray-500 text-sm">
                {generationResult?.type === AI_GENERATION_TYPES.TAGS || generationResult?.type === AI_GENERATION_TYPES.CATEGORY
                  ? "AI 已分析文章内容，为你推荐以下选项"
                  : generationResult?.type === AI_GENERATION_TYPES.POLISH
                    ? "确认后将替换原文内容"
                    : "点击选择要使用的内容"}
              </DialogDescription>
            </DialogHeader>

            {generationResult && (
              <div>
                {/* 标题选择 */}
                {generationResult.type === AI_GENERATION_TYPES.TITLE && Array.isArray(generationResult.results) && (
                  <div className="space-y-2">
                    {(generationResult.results as string[]).map((result, i) => (
                      <button
                        key={i}
                        onClick={() => handleResultSelect(result)}
                        className="w-full flex items-start gap-3 p-4 text-left border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/50 transition-all group cursor-pointer"
                      >
                        <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs font-semibold flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-blue-100 group-hover:text-blue-600">
                          {i + 1}
                        </span>
                        <span className="text-sm text-gray-800 leading-relaxed flex-1">{result}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* 摘要 / 大纲 / 润色 */}
                {(generationResult.type === AI_GENERATION_TYPES.EXCERPT ||
                  generationResult.type === AI_GENERATION_TYPES.OUTLINE ||
                  generationResult.type === AI_GENERATION_TYPES.POLISH) &&
                  typeof generationResult.results === "string" && (
                  <div className="space-y-4">
                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 whitespace-pre-wrap text-sm text-gray-700 leading-relaxed max-h-[380px] overflow-y-auto">
                      {generationResult.results}
                    </div>
                    <button
                      onClick={() => handleResultSelect()}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors cursor-pointer"
                    >
                      <Check className="h-4 w-4" />
                      {generationResult.type === AI_GENERATION_TYPES.EXCERPT
                        ? "使用此摘要"
                        : generationResult.type === AI_GENERATION_TYPES.POLISH
                          ? "应用润色内容（替换原文）"
                          : "插入到编辑器"}
                    </button>
                  </div>
                )}

                {/* 标签 / 分类推荐 */}
                {(generationResult.type === AI_GENERATION_TYPES.TAGS ||
                  generationResult.type === AI_GENERATION_TYPES.CATEGORY) &&
                  isRecommendation(generationResult.results) && (
                  <div className="space-y-5">
                    {generationResult.results.existing.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
                          {generationResult.type === AI_GENERATION_TYPES.CATEGORY ? "📁 现有分类" : "🏷️ 现有标签"}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {generationResult.results.existing.map((item, i) => (
                            <span key={i} className="px-3 py-1.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {generationResult.results.new.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
                          ➕ 建议新建
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {generationResult.results.new.map((item, i) => (
                            <span key={i} className="px-3 py-1.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {!generationResult.results.existing.length && !generationResult.results.new.length && (
                      <p className="text-sm text-gray-400 text-center py-4">暂无推荐结果</p>
                    )}
                    <div className="pt-4 border-t border-gray-100">
                      <p className="text-xs text-gray-400 mb-3">
                        应用后，在发布设置中可选择使用或新建这些{generationResult.type === AI_GENERATION_TYPES.CATEGORY ? "分类" : "标签"}
                      </p>
                      <button
                        onClick={() => handleResultSelect()}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors cursor-pointer"
                      >
                        <Check className="h-4 w-4" />
                        应用推荐
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
