"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SimpleLoading } from "@/components/ui/loading";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";
import { DEFAULT_RAG_RERANK_SCORE_THRESHOLD } from "@/lib/ai/companion";

export default function DialogueSettingsPage() {
  const [systemPrompt, setSystemPrompt] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [ragRerankScoreThreshold, setRagRerankScoreThreshold] = useState(
    String(DEFAULT_RAG_RERANK_SCORE_THRESHOLD),
  );
  const [thresholdUpdatedAt, setThresholdUpdatedAt] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/companion-settings", {
          cache: "no-store",
        });
        if (cancelled) return;
        const payload = (await res.json().catch(() => ({}))) as {
          systemPrompt?: string;
          updatedAt?: string | null;
          ragRerankScoreThreshold?: number;
          thresholdUpdatedAt?: string | null;
          error?: string;
        };
        if (!res.ok) {
          toast({
            title: "加载失败",
            description: payload.error ?? `HTTP ${res.status}`,
            variant: "destructive",
          });
          return;
        }
        setSystemPrompt(payload.systemPrompt ?? "");
        setUpdatedAt(payload.updatedAt ?? null);
        setRagRerankScoreThreshold(
          Number.isFinite(payload.ragRerankScoreThreshold)
            ? String(payload.ragRerankScoreThreshold)
            : String(DEFAULT_RAG_RERANK_SCORE_THRESHOLD),
        );
        setThresholdUpdatedAt(payload.thresholdUpdatedAt ?? null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const n = Number(ragRerankScoreThreshold);
      if (!Number.isFinite(n) || n < 0 || n > 1) {
        toast({
          title: "阈值不合法",
          description: "请输入 0~1 的数字（例如 0.6）",
          variant: "destructive",
        });
        return;
      }
      const res = await fetch("/api/admin/companion-settings", {
        method: "PUT",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt,
          ragRerankScoreThreshold: n,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        updatedAt?: string;
      };
      if (res.ok) {
        if (data.updatedAt) setUpdatedAt(data.updatedAt);
        toast({
          title: "已保存",
          description: "对话设置已更新并立即生效",
        });
      } else {
        toast({
          title: data.error ?? "保存失败",
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex min-h-[40vh] items-center justify-center">
          <SimpleLoading />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <form onSubmit={handleSave} className="w-full space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-1 h-5 bg-indigo-600 dark:bg-violet-600 rounded-full" />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              对话设置
            </h1>
          </div>
          <Button type="submit" disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "保存中…" : "保存更改"}
          </Button>
        </div>

        <div className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-[#0b101a] p-6 shadow-sm">
          <div className="space-y-2 pb-6">
            <Label htmlFor="rerank-threshold" className="text-base">
              RAG 重排丢弃阈值
            </Label>
            <div className="flex items-center gap-3">
              <Input
                id="rerank-threshold"
                inputMode="decimal"
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={ragRerankScoreThreshold}
                onChange={(e) => setRagRerankScoreThreshold(e.target.value)}
                className="w-40"
                placeholder={String(DEFAULT_RAG_RERANK_SCORE_THRESHOLD)}
              />
              <span className="text-sm text-gray-500 dark:text-slate-500">
                0~1，低于该分数的重排片段将直接丢弃（默认{" "}
                {DEFAULT_RAG_RERANK_SCORE_THRESHOLD}）
              </span>
            </div>
            {thresholdUpdatedAt && (
              <p className="text-xs text-gray-400 dark:text-slate-500">
                最近保存：{new Date(thresholdUpdatedAt).toLocaleString()}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="system-prompt" className="text-base">
              System Prompt
            </Label>
            <Textarea
              id="system-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="例如：现在你是幽默、轻松的助手，回答简短有梗，但仍需遵守事实、不编造文章。"
              className="min-h-[220px] font-mono text-sm"
            />
            <div className="space-y-1 text-gray-500 dark:text-slate-500">
              <p className="text-sm">
                配置助手 System
                Prompt（语气、人设等）。保存后立即对前台智能对话生效，无需重新部署。
              </p>
              {updatedAt && (
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  最近保存：{new Date(updatedAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>
      </form>
    </AdminLayout>
  );
}
