import { Extension } from "@tiptap/react";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

interface CompletionState {
  suggestion: string | null;
  position: number | null;
}

const pluginKey = new PluginKey<CompletionState>("aiCompletion");

export const AICompletion = Extension.create({
  name: "aiCompletion",

  addProseMirrorPlugins() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const ext = this;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let abortController: AbortController | null = null;

    return [
      new Plugin<CompletionState>({
        key: pluginKey,

        state: {
          init(): CompletionState {
            return { suggestion: null, position: null };
          },

          apply(tr, value, _old, newState) {
            // Explicit state updates via transaction metadata
            if (tr.getMeta("ai-clear"))
              return { suggestion: null, position: null };
            // Tab 接受会带 ai-accept 且同时改文档；若此处直接 return，会跳过下方 docChanged
            // 分支，导致不会再次调度补全。仅在无文档变更时清空并返回。
            if (tr.getMeta("ai-accept") && !tr.docChanged) {
              return { suggestion: null, position: null };
            }
            const upd = tr.getMeta("ai-update");
            if (upd)
              return { suggestion: upd.suggestion, position: upd.position };

            if (!tr.docChanged) {
              // Cursor moved away from suggestion position → clear
              if (
                value.position !== null &&
                newState.selection.from !== value.position
              ) {
                return { suggestion: null, position: null };
              }
              return value;
            }

            // Doc changed: cancel in-flight request, clear suggestion, schedule new one
            if (debounceTimer) clearTimeout(debounceTimer);
            abortController?.abort();

            const { from, to } = newState.selection;
            if (from !== to) return { suggestion: null, position: null }; // text selected

            const textBefore = newState.doc.textBetween(
              Math.max(0, from - 500),
              from,
            );
            if (textBefore.trim().length < 2)
              return { suggestion: null, position: null };

            const cursorAt = from;
            debounceTimer = setTimeout(async () => {
              const ctrl = new AbortController();
              abortController = ctrl;
              try {
                const fullText = ext.editor.state.doc.textContent;
                const res = await fetch("/api/ai/write/complete", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    content: fullText,
                    cursorPosition: cursorAt,
                  }),
                  signal: ctrl.signal,
                });
                if (!res.ok) return;
                const data = await res.json();
                const text: string = data.suggestions?.[0]?.text;
                if (!text) return;

                // Verify cursor hasn't moved since the request started
                const current = ext.editor.state;
                if (current.selection.from !== cursorAt) return;

                const t = current.tr.setMeta("ai-update", {
                  suggestion: text,
                  position: cursorAt,
                });
                ext.editor.view.dispatch(t);
              } catch (e) {
                if ((e as Error).name !== "AbortError")
                  console.error("[AI completion]", e);
              }
            }, 800);

            return { suggestion: null, position: null };
          },
        },

        props: {
          decorations(state) {
            const ps = pluginKey.getState(state);
            if (!ps?.suggestion || ps.position === null)
              return DecorationSet.empty;

            // Guard: position still valid and cursor hasn't moved
            try {
              state.doc.resolve(ps.position);
            } catch {
              return DecorationSet.empty;
            }
            if (state.selection.from !== ps.position)
              return DecorationSet.empty;

            // Build inline ghost-text widget
            const wrap = document.createElement("span");
            wrap.setAttribute("data-ai-suggestion", "true");
            wrap.style.cssText =
              "color:#9ca3af;font-style:italic;pointer-events:none;user-select:none;";
            wrap.textContent = ps.suggestion;

            const hint = document.createElement("span");
            hint.style.cssText =
              "margin-left:6px;font-size:0.75em;font-style:normal;" +
              "color:#6b7280;background:rgba(243,244,246,0.95);" +
              "border:1px solid #d1d5db;border-radius:4px;padding:1px 5px;" +
              "pointer-events:none;white-space:nowrap;";
            hint.textContent = "Tab 接受 · Esc 取消";
            wrap.appendChild(hint);

            return DecorationSet.create(state.doc, [
              Decoration.widget(ps.position, wrap, {
                side: 1,
                ignoreSelection: true,
              }),
            ]);
          },
        },
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        const ps = pluginKey.getState(editor.state);
        if (!ps?.suggestion || ps.position === null) return false;

        const { tr, selection } = editor.state;
        tr.insertText(ps.suggestion, selection.from);
        tr.setSelection(
          TextSelection.create(tr.doc, selection.from + ps.suggestion.length),
        );
        tr.setMeta("ai-accept", true);
        editor.view.dispatch(tr);
        return true;
      },

      Escape: ({ editor }) => {
        const ps = pluginKey.getState(editor.state);
        if (!ps?.suggestion) return false;
        editor.view.dispatch(editor.state.tr.setMeta("ai-clear", true));
        return true;
      },
    };
  },
});
