import type { ReactNode } from "react";

/** 管理后台表格横向滚动容器，避免窄屏下列被裁切 */
export function AdminTableScroll({ children }: { children: ReactNode }) {
  return (
    <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain">
      {children}
    </div>
  );
}
