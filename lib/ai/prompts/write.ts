export function buildTitlePrompt(
  content: string,
  options: { count?: number; style?: string } = {}
): string {
  const count = options.count || 3;
  const style = options.style || "专业";

  return `# Role: SEO 标题生成专家

## Goals
生成 ${count} 个不同角度的标题选项，风格为"${style}"，长度 10-20 汉字，包含核心关键词。

## Rules
1. 标题长度严格控制在 10-20 个汉字之间
2. 每个标题包含文章核心关键词
3. 标题准确反映文章内容，避免标题党
4. 标题之间有明显差异化
5. 必须返回纯 JSON 数组格式，不包含任何解释

## OutputFormat
["标题1", "标题2", "标题3"]

## Input
文章内容：
${content.slice(0, 2000)}

严格按 OutputFormat 输出 JSON 数组，不要包含其他文字。`;
}

export function buildExcerptPrompt(content: string): string {
  return `# Role: 内容摘要撰写专家

## Goals
撰写一个 100-200 字的精炼摘要，准确代表文章核心内容，能激发读者阅读兴趣。

## Rules
1. 摘要长度严格控制在 100-200 个汉字之间
2. 包含文章核心观点和主要结论
3. 简洁、专业，避免冗余
4. 只返回摘要文本，不要包含任何前缀或格式标记
5. 不要添加"摘要："等前缀，直接输出摘要内容

## Input
文章内容：
${content.slice(0, 3000)}

直接输出纯文本摘要，不要包含其他文字。`;
}

export function buildTagsPrompt(
  content: string,
  existingTags: string[]
): string {
  const tagList = existingTags.length > 0 ? existingTags.join("、") : "(暂无标签)";

  return `# Role: 内容标签分类专家

## Goals
从现有标签库精准匹配 2-3 个标签，并推荐 2-3 个新标签。

## Rules
1. existing 数组中的标签必须从已存在标签列表中精确匹配（名称完全一致）
2. new 数组中的标签不能与已存在标签重复
3. 每个标签名称长度控制在 2-6 个汉字之间
4. 必须返回严格的 JSON 格式

## OutputFormat
{"existing": ["标签1"], "new": ["新标签1", "新标签2"]}

## Input
文章内容：
${content.slice(0, 2000)}

已存在的标签列表：
${tagList}

严格按 OutputFormat 输出 JSON 对象，不要包含其他文字。`;
}

export function buildCategoryPrompt(
  content: string,
  existingCategories: string[]
): string {
  const categoryList =
    existingCategories.length > 0 ? existingCategories.join("、") : "(暂无分类)";

  return `# Role: 内容分类专家

## Goals
从现有分类中精准匹配 1 个最合适的分类，并推荐 1-2 个新分类。

## Rules
1. existing 数组中的分类必须从已存在分类列表中精确匹配（名称完全一致）
2. existing 数组最多包含 1 个分类
3. new 数组中的分类不能与已存在分类重复
4. 每个分类名称长度控制在 2-4 个汉字之间
5. 必须返回严格的 JSON 格式

## OutputFormat
{"existing": ["分类名称"], "new": ["新分类1"]}

## Input
文章内容：
${content.slice(0, 2000)}

已存在的分类列表：
${categoryList}

严格按 OutputFormat 输出 JSON 对象，不要包含其他文字。`;
}

export function buildOutlinePrompt(topic: string): string {
  return `# Role: 内容策划专家

## Goals
根据主题设计清晰、逻辑严密的文章大纲，包含至少 3 个一级标题，每个标题下至少 2 个二级标题。

## Rules
1. 使用标准 Markdown 格式（# 一级标题，## 二级标题）
2. 结构逻辑清晰，从概述到细节
3. 只返回 Markdown 格式的大纲内容

## Input
主题：${topic}

直接输出 Markdown 格式大纲，不要包含其他文字。`;
}

export function buildExpandPrompt(content: string): string {
  return `# Role: 内容扩展专家

## Goals
在保持原文风格和核心观点的基础上，通过添加细节、例子和深入分析来扩展内容。

## Rules
1. 完全保持原文的写作风格、语调和表达方式
2. 不能改变原文的核心观点和主要结论
3. 扩展内容必须与原文逻辑连贯
4. 只返回扩展后的完整内容，不要包含任何解释或前缀

## Input
原文内容：
${content}

直接输出扩展后的完整内容，不要包含其他文字。`;
}

export function buildPolishPrompt(
  content: string,
  customRequirement?: string
): string {
  const customReq = customRequirement ? `\n额外要求：${customRequirement}` : "";

  return `# Role: 内容润色专家

## Goals
修正语法错误、优化表达方式、提升文本流畅度，严格保持原文核心观点和意图不变。

## Rules
1. 修正所有语法、拼写和标点符号错误
2. 优化句子结构，提升可读性
3. 严格保持原文核心观点和写作意图不变
4. 只返回优化后的完整内容，不要包含任何解释或修改说明${customReq ? "\n5. " + customRequirement : ""}

## Input
原文内容：
${content}${customReq}

直接输出润色后的完整内容，不要包含其他文字。`;
}
