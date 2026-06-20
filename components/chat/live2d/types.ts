// 组件对外 Props
export interface Live2DBotProps {
  /** 模型文件路径（相对于 public 目录，如 /live2d/haru/haru.model3.json） */
  modelPath: string;
  /** AI 是否正在流式回复——角色嘴巴张合 */
  streaming?: boolean;
  /** 点击角色时触发（打开/关闭聊天面板） */
  onToggle?: () => void;
}

// 内部状态
export type Live2DStatus = "loading" | "ready" | "error";

// 模型 Hook 参数
export interface UseLive2DModelOptions {
  /** 目标 canvas 元素 */
  canvas: HTMLCanvasElement | null;
  /** 模型文件路径 */
  modelPath: string;
  /** 点击回调 */
  onTap?: () => void;
  /** 模型加载成功回调 */
  onReady?: () => void;
  /** 是否处于说话状态 */
  speaking?: boolean;
}
