/** 管理后台始终动态渲染，避免 RSC / 预取缓存导致刷新仍看到旧数据 */
export const dynamic = "force-dynamic";

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
