"use client";

import { forwardRef, useImperativeHandle } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { AICompletion } from "@/lib/editor/ai-completion-extension";
import { cn } from "@/lib/utils";
import {
  Bold, Italic, Strikethrough,
  Heading1, Heading2, Heading3,
  Code, CodeSquare, Quote,
  List, ListOrdered, Minus,
} from "lucide-react";

export interface TiptapEditorHandle {
  getMarkdown: () => string;
  setMarkdown: (md: string) => void;
  insertMarkdown: (md: string) => void;
}

interface TiptapEditorProps {
  initialContent?: string;
  onChange?: (markdown: string) => void;
  className?: string;
  minHeight?: number;
}

const TiptapEditor = forwardRef<TiptapEditorHandle, TiptapEditorProps>(
  ({ initialContent, onChange, className, minHeight = 500 }, ref) => {
    const editor = useEditor({
      extensions: [
        StarterKit,
        Markdown.configure({ html: false, transformPastedText: true }),
        AICompletion,
      ],
      editorProps: {
        attributes: {
          class: "prose prose-gray dark:prose-invert max-w-none focus:outline-none px-4 py-3 bg-white dark:bg-slate-950",
          style: `min-height:${minHeight}px`,
        },
      },
      content: initialContent || "",
      immediatelyRender: false,
      onUpdate({ editor }) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onChange?.((editor.storage as any).markdown.getMarkdown());
      },
    });

    useImperativeHandle(ref, () => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getMarkdown: () => (editor?.storage as any)?.markdown?.getMarkdown() ?? "",
      setMarkdown: (md: string) => editor?.commands.setContent(md),
      insertMarkdown: (md: string) => {
        if (!editor) return;
        // Insert at end of doc with a blank line separator if not empty
        const isEmpty = editor.state.doc.textContent.trim().length === 0;
        if (isEmpty) {
          editor.commands.setContent(md);
        } else {
          editor.chain().focus("end").insertContent("\n\n" + md).run();
        }
      },
    }), [editor]);

    if (!editor) return (
      <div className={cn("border border-gray-200 dark:border-gray-700 rounded-lg", className)}
        style={{ minHeight: minHeight + 50 }} />
    );

    return (
      <div className={cn("border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden dark:bg-slate-950/50", className)}>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900/80">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            title="加粗 (Ctrl+B)"
          ><Bold className="h-4 w-4" /></ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            title="斜体 (Ctrl+I)"
          ><Italic className="h-4 w-4" /></ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive("strike")}
            title="删除线"
          ><Strikethrough className="h-4 w-4" /></ToolbarButton>

          <Divider />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive("heading", { level: 1 })}
            title="H1"
          ><Heading1 className="h-4 w-4" /></ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive("heading", { level: 2 })}
            title="H2"
          ><Heading2 className="h-4 w-4" /></ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive("heading", { level: 3 })}
            title="H3"
          ><Heading3 className="h-4 w-4" /></ToolbarButton>

          <Divider />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            active={editor.isActive("code")}
            title="行内代码"
          ><Code className="h-4 w-4" /></ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            active={editor.isActive("codeBlock")}
            title="代码块"
          ><CodeSquare className="h-4 w-4" /></ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive("blockquote")}
            title="引用"
          ><Quote className="h-4 w-4" /></ToolbarButton>

          <Divider />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
            title="无序列表"
          ><List className="h-4 w-4" /></ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
            title="有序列表"
          ><ListOrdered className="h-4 w-4" /></ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            active={false}
            title="分割线"
          ><Minus className="h-4 w-4" /></ToolbarButton>
        </div>

        {/* Editor area */}
        <EditorContent editor={editor} />
      </div>
    );
  }
);

TiptapEditor.displayName = "TiptapEditor";
export default TiptapEditor;

function ToolbarButton({
  onClick, active, title, children,
}: {
  onClick: () => void;
  active: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={cn(
        "p-1.5 rounded transition-colors cursor-pointer",
        active
          ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
          : "text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-0.5" />;
}
