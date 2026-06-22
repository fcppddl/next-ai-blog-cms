# Live2D 交互行为完善 设计

> 日期：2026-06-22 | 状态：待实现

## 概述

当前 Live2D 实现只完成了模型加载和基础嘴巴动画，交互行为大量缺失。本设计在现有代码基础上，**修复视线跟随 bug**，并**补齐悬停反应、空闲摸鱼、点击反馈**三项交互。

## 现状诊断

### 模型信息

- **模型**：mao (mao_pro)，Cubism 4
- **参数**：CDI 定义 128 个参数（含 `ParamAngleX/Y`、`ParamEyeBallX/Y`、`ParamMouthUp`、`ParamEyeLSmile` 等）
- **动作**：2 个 group — `"Idle"`（mtn_01）和 `""`（空字符串 key，含 mtn_02~04 + special_01~03，其中 special_01 是 index 3）
- **表情**：8 个（exp_01~exp_08），各含 28 个参数值

### 现有代码 BUG

`use-live2d-model.ts` 的 `trySetParam()` 通过 `model.internalModel?.coreModel?.getParameters()` 访问参数，但 `pixi-live2d-display` 的内部对象路径不同，**所有参数设值静默失败**。正确的 API 是 `model.setParamFloat(id, value)`——模型实例自身已封装参数访问。

### 交互行为状态

| 行为 | 状态 | 原因 |
|------|------|------|
| 待机呼吸 | ✅ 生效 | 模型自动播放 idle motion |
| 视线跟随 | ❌ BUG | `trySetParam` 内部 API 路径错误 |
| 悬停反应 | ❌ 未实现 | — |
| 点击反馈 | ❌ BUG | tap motion 名不匹配模型 group 名 |
| 说话状态 | ✅ 生效 | `ParamA` 在 LipSync 组，名称正确 |
| 空闲摸鱼 | ❌ 未实现 | — |

## 架构设计

### 新增 hook：`use-live2d-interaction.ts`

将全部交互逻辑从 `useLive2DModel` 中分离到独立 hook，两个 hook 通过 `modelRef` 共享模型实例：

```
Live2DCanvas (组件层)
  ├── useLive2DModel        ← 模型初始化 + 嘴巴动画
  │   └── 返回 modelRef ──┐
  └── useLive2DInteraction ← 视线 + 悬停 + 空闲 + 点击
                           ← 通过 model.setParamFloat/expression/motion 直接操作模型
```

### `useLive2DInteraction` 接口

```ts
interface UseLive2DInteractionOptions {
  /** PixiJS Live2DModel 实例引用 */
  modelRef: RefObject<Live2DModel | null>;
  /** Canvas DOM 元素（用于监听 mouseenter/mouseleave） */
  canvas: HTMLCanvasElement | null;
  /** AI 是否正在说话（说话时暂停空闲计时器） */
  speaking: boolean;
  /** 空闲触发间隔（默认 10_000ms） */
  idleTimeout?: number;
  /** 点击回调 */
  onTap?: () => void;
}
```

### 交互实现细节

#### 1. 视线跟随（修复）

- 监听 `window.mousemove`，计算鼠标相对于 canvas 的位置
- 通过 `model.setParamFloat()` 设置：
  - `ParamAngleX`：水平偏转（-25 ~ 25）
  - `ParamAngleY`：垂直偏转（-20 ~ 20）
  - `ParamEyeBallX`：眼球水平（-0.8 ~ 0.8）
  - `ParamEyeBallY`：眼球垂直（-0.8 ~ 0.8）
- 使用 PixiJS Ticker 在每帧应用参数值，确保平滑过渡

#### 2. 悬停反应

- 监听 canvas 的 `mouseenter` / `mouseleave`
- **mouseenter**：
  1. 尝试设置表达式：从 `exp_01` 开始逐个尝试 `model.expression(0)` ~ `model.expression(7)`，取第一个使 `ParamMouthUp > 0` 或 `ParamEyeLSmile > 0` 的表情（调用 `model.getParamFloat()` 验证）
  2. 同时设置 `ParamAngleX += 5`（微前倾，保底反馈）
- **mouseleave**：
  1. 清除表达式：`model.expression()` 无参调用重置
  2. 复位 `ParamAngleX = 0`、`ParamMouthUp = 0`
- 添加 CSS `transition` 在参数值变化时让 Live2D 物理引擎自然平滑

#### 3. 点击反馈

- 监听 model 的 `pointertap` 事件
- 播放固定特殊动作：`model.motion("", specialIndex)` —— 其中 `specialIndex` 对应 `special_01` 在未命名 group 中的索引
- motion 播放完毕后自动回到 idle
- 触发 `onTap` 回调（打开/关闭聊天面板）
- 重置空闲计时器

#### 4. 空闲摸鱼

- 使用 `setTimeout` 实现 10s 空闲计时器
- 以下事件重置计时器：
  - 鼠标移动（debounce 200ms）
  - 鼠标悬停/离开 canvas
  - 点击
  - AI 开始说话
- 超时后：从非 idle group 中随机选取 motion 播放
  - 通过 `model.internalModel.motionManager.definitions` 获取 motion group 列表
  - 找到非 "Idle" 的 group，随机选 index
  - `model.motion(group, index)` 播放
  - motion 播放完毕后恢复 idle，重新开始计时
- AI 说话中（`speaking=true`）暂停计时器，说完重置

## 改动范围

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `components/chat/live2d/types.ts` | 修改 | 新增 `UseLive2DInteractionOptions` |
| `components/chat/live2d/use-live2d-model.ts` | 大幅修改 | 删除错误的 `trySetParam`、视线跟踪 ticker、tap 处理；返回 `modelRef`；仅保留模型初始化 + 嘴巴动画 |
| `components/chat/live2d/use-live2d-interaction.ts` | **新建** | 视线 + 悬停 + 空闲 + 点击全部交互逻辑 |
| `components/chat/live2d/live2d-canvas.tsx` | 小幅修改 | 注入 `useLive2DInteraction` hook |

## 注意事项

- **不侵入组件 API**：`Live2DBot` 的 props 接口不变
- **移动端降级**：移动端本就回退到静态图标，本设计的交互逻辑不会在移动端执行
- **AI 说话时**：角色始终可见，仅嘴巴张合；空闲计时器暂停防止摸鱼打断说话体验
- **性能**：所有交互使用单一 PixiJS Ticker，不额外创建渲染循环
