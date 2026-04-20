import {
  Building2,
  Coffee,
  GraduationCap,
  Rocket,
  Sparkles,
} from "lucide-react";
import PublicLayout from "@/components/layout/public-layout";
import AdminProfileCard from "@/components/profile/admin-profile-card";
import { prisma } from "@/lib/prisma";

export default async function AboutPage() {
  const user = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    include: { profile: true },
  });
  const company = user?.profile?.company?.trim() || "xxx";
  const position = user?.profile?.position?.trim() || "全栈开发者";

  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-col gap-10 lg:flex-row lg:gap-12">
          <AdminProfileCard />

          <div className="min-w-0 flex-1 space-y-12 rounded-2xl border border-border/50 bg-white p-6 sm:p-8 dark:border-border dark:bg-card">
            <section
              className="prose prose-gray max-w-none dark:prose-invert"
              aria-labelledby="about-intro"
            >
              <div className="mb-4 flex items-center gap-2 not-prose">
                <Sparkles className="h-5 w-5 text-primary" aria-hidden />
                <h2
                  id="about-intro"
                  className="m-0 text-lg font-semibold text-foreground"
                >
                  关于我
                </h2>
              </div>
              <p className="text-lg leading-relaxed text-foreground">
                你好，欢迎来到这里。我是一名{" "}
                <strong>{position}</strong>
                ，热衷于把想法落成稳定、好用的产品；日常和 Web、接口与自动化打交道，也持续关注{" "}
                <strong>AI 如何帮我们把写作与迭代变轻松</strong>。
              </p>
              <p className="text-muted-foreground">
                标签可以概括成：工程化思维、注重体验、愿意长期维护。坐标在武汉——一座既有江湖气，也适合安静写代码的城市。
              </p>
            </section>

            <section
              className="prose prose-gray max-w-none dark:prose-invert"
              aria-labelledby="about-doing"
            >
              <div className="mb-4 flex items-center gap-2 not-prose">
                <Rocket className="h-5 w-5 text-primary" aria-hidden />
                <h2
                  id="about-doing"
                  className="m-0 text-lg font-semibold text-foreground"
                >
                  我在做什么
                </h2>
              </div>
              <p className="leading-relaxed text-foreground">
                自 2024 年 7 月起，我就职于{" "}
                <strong>{company}</strong>
                ，工作里离不开前端界面、服务接口与数据流转。开这个博客的初衷，是把{" "}
                <strong>实战中的取舍、复盘与小结</strong>{" "}
                记下来：既方便未来的自己查阅，也希望能偶尔帮到你。
              </p>
              <p className="text-muted-foreground">
                你会在这里看到偏「现代 Web」与「内容创作工具链」相关的内容——例如用{" "}
                <strong>Next.js</strong>{" "}
                搭站点、做后台、接登录与权限；也会写我如何用{" "}
                <strong>AI</strong>{" "}
                辅助列提纲、润色和结构化输出。比起罗列名词，我更在意：这些能力最终怎样让{" "}
                <strong>阅读更舒服、写作更省力</strong>。
              </p>
            </section>

            <section
              className="prose prose-gray max-w-none dark:prose-invert"
              aria-labelledby="about-story"
            >
              <div className="mb-4 flex items-center gap-2 not-prose">
                <GraduationCap className="h-5 w-5 text-primary" aria-hidden />
                <h2
                  id="about-story"
                  className="m-0 text-lg font-semibold text-foreground"
                >
                  经历与故事
                </h2>
              </div>
              <ul className="not-prose space-y-4 text-foreground">
                <li className="flex gap-3 leading-relaxed">
                  <GraduationCap
                    className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span>
                    <strong>求学：</strong>
                    毕业于武汉理工大学。那段日子教会我的不仅是专业课，更是「把大问题拆成小任务」的习惯——后来写需求、拆 Story、排期，本质都是同一套思路。
                  </span>
                </li>
                <li className="flex gap-3 leading-relaxed">
                  <Building2
                    className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span>
                    <strong>工作：</strong>
                    2024 年 7 月至今在 {company}
                    ，参与产品与业务的迭代。团队里我更多关注可维护性：代码结构清晰一点、文档多写一句、自动化多接一步，长期都会省回时间。
                  </span>
                </li>
                <li className="flex gap-3 leading-relaxed">
                  <Sparkles
                    className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span>
                    <strong>技术栈（常用）：</strong>
                    TypeScript、React、Next.js，以及围绕它们的服务端与数据层工具。不追新为追新，更在意「合适」与「团队能接住」。
                  </span>
                </li>
              </ul>
            </section>

            <section
              className="prose prose-gray max-w-none dark:prose-invert"
              aria-labelledby="about-life"
            >
              <div className="mb-4 flex items-center gap-2 not-prose">
                <Coffee className="h-5 w-5 text-primary" aria-hidden />
                <h2
                  id="about-life"
                  className="m-0 text-lg font-semibold text-foreground"
                >
                  工作之外的我
                </h2>
              </div>
              <p className="leading-relaxed text-foreground">
                不敲键盘的时候，我会刻意从屏幕前走开：偶尔拍照记录街角的光影，翻几页科幻或随笔，或者只是散步、发呆，让脑子清空一下。生活里的这些小爱好不会出现在每一篇技术文里，但它们提醒我——好的工程，最终也是为了让人活得更自在一点。
              </p>
            </section>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
