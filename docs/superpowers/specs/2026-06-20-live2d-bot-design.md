# Live2D 动画机器人设计

> 日期：2026-06-20 | 状态：待实现

## 概述

将博客右下角静态的 `Bot` 图标按钮替换为 Live2D 动画角色，实现可爱角色型 + 完整交互（待机动画、视线跟随、点击反馈、说话状态、空闲摸鱼）。

## 技术选型

- **渲染引擎**：`pixi-live2d-display`（社区最成熟的 Web Live2D 封装，基于 PixiJS v8）
- **Live2D 核心**：Cubism Core for Web（WASM，~400KB）
- **加载方式**：`next/dynamic` + `ssr: false`
- **模型**：使用免费开源 Live2D 模型

## 文件结构

```
components/chat/
├── ai-chat.tsx              # 现有聊天组件（小幅修改 FAB 按钮）
├── live2d-bot.tsx           # 新增：Live2D 角色组件（主入口）
└── live2d/
    ├── use-live2d.ts        # 新增：Live2D 初始化 Hook
    └── types.ts             # 新增：类型定义

public/live2d/               # 新增：模型资源目录
└── <model-name>/
    ├── <model>.model3.json
    ├── <model>.moc3
    ├── textures/
    └── motions/
```

## 交互行为

| 行为 | 触发条件 | 效果 |
|------|---------|------|
| 待机呼吸 | 始终播放 | 角色轻微起伏，眨眼 |
| 视线跟随 | 鼠标在页面移动 | 眼睛/头部跟随鼠标位置偏转 |
| 悬停反应 | 鼠标悬停在角色上 | 角色微微前倾或微笑 |
| 点击反馈 | 点击角色 | 播放跳跃/惊吓动画 → 打开/关闭聊天面板 |
| 说话状态 | AI 正在流式回复（`streaming=true`） | 角色嘴巴张合 |
| 空闲摸鱼 | 长时间无交互（~10s） | 播放随机小动作（歪头、打哈欠等） |

## 状态处理

| 状态 | 显示内容 |
|------|---------|
| 加载中 | 显示骨架屏/渐变光晕，与原按钮大小一致（56x56 → 升级后 ~100x120） |
| 加载失败 | 回退到现有的静态 `Bot` 图标按钮 |
| 已就绪 | Live2D 角色正常显示 |
| 移动端 | 降级为简化动画（不跟随视线，减少电量消耗） |

## 低优先级加载策略

- `next/dynamic` + `ssr: false` — 组件代码不阻塞首屏 SSR
- `requestIdleCallback` + 2s 延迟 — 等浏览器空闲后才开始加载
- `fetchpriority="low"` — 模型资源不抢占文章图片等关键资源带宽
- 模型拆分加载：`.moc3` 骨架文件优先，贴图后加载
- **8 秒超时**：若未就绪则回退到静态 `Bot` 图标
- 移动端或慢网络自动降级为静态图标

## 现有代码改动范围

### `ai-chat.tsx`（仅 FAB 按钮部分）

```tsx
// 原来：静态按钮包裹 <Bot /> 图标
<button className="group relative cursor-pointer">
  <Bot className="h-6 w-6 text-white" />
</button>

// 改为：Live2D 角色替代图标
<button className="group relative cursor-pointer">
  <Live2DBot modelPath="/live2d/haru/haru.model3.json" streaming={streaming} />
</button>
```

### 新增依赖

- `pixi.js` (^8.x) — Canvas/WebGL 渲染引擎
- `pixi-live2d-display` (cubism 4 版本) — Live2D PixiJS 插件

## 模型资源

放入 `public/live2d/` 目录。推荐几个免费模型供挑选：
- **Haru**（公式样品）— 活泼少女风格
- **Hiyori**（公式样品）— 温和和风少女
- **Nito**（公式样品）— 可爱小女孩

> 具体模型在实现时由用户确认。

## 兼容性

- 桌面端：完整功能
- 移动端：降级为静态图标（省电 + 性能考虑）
- 暗色模式：Canvas 内容不受影响，外层保持原有 Tailwind 暗色适配
