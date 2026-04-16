"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CoverImagePickerProps {
  value: string;
  onChange: (url: string) => void;
}

export default function CoverImagePicker({
  value,
  onChange,
}: CoverImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/admin/posts/cover-upload", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();

    if (res.ok) {
      onChange(data.url);
    } else {
      toast({ title: data.error ?? "上传失败", variant: "destructive" });
    }
    setUploading(false);
    // Reset so re-selecting same file triggers onChange
    e.target.value = "";
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {value ? (
        /* Preview */
        <div className="relative group rounded-lg overflow-hidden border border-gray-200 dark:border-slate-600">
          <div className="relative w-full h-36">
            <Image
              src={value}
              alt="封面预览"
              fill
              className="object-cover"
              unoptimized={value.startsWith("/images/")}
            />
          </div>
          {/* Overlay actions */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/90 text-gray-900 text-xs font-medium hover:bg-white transition-colors cursor-pointer"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImagePlus className="h-3.5 w-3.5" />
              )}
              更换
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/90 text-red-600 text-xs font-medium hover:bg-white transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              移除
            </button>
          </div>
        </div>
      ) : (
        /* Upload area */
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-28 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 text-gray-400 transition-colors hover:border-blue-400 hover:text-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-500 dark:hover:border-blue-500 dark:hover:text-blue-400"
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <ImagePlus className="h-6 w-6" />
          )}
          <span className="text-xs font-medium">
            {uploading ? "上传中..." : "点击选择封面图片"}
          </span>
          <span className="text-xs opacity-60">JPG / PNG / WebP，最大 5MB</span>
        </button>
      )}
    </div>
  );
}
