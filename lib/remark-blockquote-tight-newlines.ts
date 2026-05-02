import type { Paragraph, PhrasingContent, Root } from "mdast";
import { visit } from "unist-util-visit";

/**
 * remark-parse 将引用块内「每行都以 > 开头、段落之间无空行」的写法解析为
 * 单个 paragraph、文字节点里带字面 \\n；浏览器按默认空白规则会折成一行。
 * markdown-it（TipTap）侧则会落成软换行，编辑页仍是多行。
 * 在 AST 里把这类 \\n 拆成 break，前台详情与编辑器观感一致。
 */
export function remarkBlockquoteTightNewlines() {
  return (tree: Root) => {
    visit(tree, "blockquote", (node) => {
      for (const child of node.children) {
        if (child.type !== "paragraph") continue;
        const paragraph = child as Paragraph;
        const out: PhrasingContent[] = [];
        for (const phrasing of paragraph.children) {
          if (phrasing.type === "text" && phrasing.value.includes("\n")) {
            const segments = phrasing.value.split("\n");
            segments.forEach((seg, i) => {
              if (seg.length > 0) out.push({ type: "text", value: seg });
              if (i < segments.length - 1) out.push({ type: "break" });
            });
          } else {
            out.push(phrasing);
          }
        }
        paragraph.children = out;
      }
    });
  };
}
