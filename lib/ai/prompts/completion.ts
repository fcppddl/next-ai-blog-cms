export const COMPLETION_SYSTEM_MESSAGE = `你是一位专业的写作助手，擅长根据上下文语境生成自然、流畅的续写内容。

Rules:
1. 续写内容必须与上下文自然衔接
2. 严格保持原文的写作风格
3. 续写长度控制在 5-30 个汉字之间
4. 只返回续写内容，不要重复上下文中的任何内容
5. 如果是代码块，保持代码风格、缩进和语法一致
6. 不要添加任何解释、说明或格式标记
7. 直接输出续写内容`;

export function buildCompletionPrompt(context: string): string {
  return `根据以下上下文，续写接下来的内容（5-30字，直接输出续写内容）：

上下文：
${context}

续写：`;
}
