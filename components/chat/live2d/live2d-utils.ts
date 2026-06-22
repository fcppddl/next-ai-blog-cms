// Live2D 工具函数——模型参数访问辅助

import type { Live2DModel } from "pixi-live2d-display/cubism4";

// pixi-live2d-display 的 Live2DModel 类型定义未包含 getParamIndex/setParamFloat，
// 但运行时这些方法确实存在。定义精确接口避免使用 Record<string, Function>
export interface ModelParamAPI {
  getParamIndex(name: string): number;
  setParamFloat(name: string, value: number): void;
}

/** 安全设置模型参数——参数不存在则静默忽略 */
export function trySetParam(
  model: Live2DModel,
  name: string,
  value: number,
): void {
  try {
    const api = model as unknown as ModelParamAPI;
    const idx = api.getParamIndex(name);
    if (typeof idx === "number" && idx >= 0) {
      api.setParamFloat(name, value);
    }
  } catch {
    // 参数不存在则静默忽略
  }
}
