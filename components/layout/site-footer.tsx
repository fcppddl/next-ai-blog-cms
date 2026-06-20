/** 站点公共底部 — 登录页和首页复用 */
export default function SiteFooter() {
  return (
    <footer className="border-t border-border py-5">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 text-center text-sm text-muted-foreground">
        <span>© {new Date().getFullYear()} 码界网版权所有</span>
        <a
          href="https://beian.mps.gov.cn/#/query/webSearch?code=36100202000724"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 underline-offset-4 hover:text-foreground hover:underline"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/beian-police.png"
            alt=""
            width={20}
            height={20}
            className="shrink-0 align-middle"
          />
          赣公网安备36100202000724号
        </a>
        <a
          href="https://beian.miit.gov.cn/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-4 hover:text-foreground hover:underline"
        >
          赣ICP备2026008599号-1
        </a>
      </div>
    </footer>
  );
}
