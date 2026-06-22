import type { Live2DModel } from "pixi-live2d-display/cubism4";

// 组件对外 Props
export interface Live2DBotProps {
  /** 模型文件路径（相对于 public 目录，如 /live2d/haru/haru.model3.json） */
  modelPath: string;
  /** 点击角色时触发（打开/关闭聊天面板） */
  onToggle?: () => void;
  /** 模型加载就绪回调——父组件可用于隐藏加载态光晕 */
  onReady?: () => void;
}

// 内部状态
export type Live2DStatus = "loading" | "ready" | "error";

// 模型 Hook 参数
export interface UseLive2DModelOptions {
  /** 目标 canvas 元素 */
  canvas: HTMLCanvasElement | null;
  /** 模型文件路径 */
  modelPath: string;
  /** 模型加载成功回调 */
  onReady?: () => void;
}

// 交互 Hook 参数
export interface UseLive2DInteractionOptions {
  /** PixiJS Live2DModel 实例引用（来自 useLive2DModel，就绪前 current 为 null） */
  modelRef: React.RefObject<Live2DModel | null>;
  /** 模型是否已就绪（来自 useLive2DModel.isReady）——用作 effect 依赖触发交互初始化 */
  isReady: boolean;
  /** Canvas DOM 元素（用于监听 mouseenter/mouseleave） */
  canvas: HTMLCanvasElement | null;
  /** 空闲触发间隔，默认 10_000ms */
  idleTimeout?: number;
  /** 点击角色回调（延迟触发，确保 action motion 先播放） */
  onTap?: () => void;
}
