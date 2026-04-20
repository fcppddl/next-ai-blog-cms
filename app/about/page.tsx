import {
  Building2,
  GraduationCap,
  Mail,
  MessageCircle,
  Phone,
  Sparkles,
} from "lucide-react";
import PublicLayout from "@/components/layout/public-layout";
import AdminProfileCard from "@/components/profile/admin-profile-card";
import { prisma } from "@/lib/prisma";

const CONTACT_EMPTY = "—";

type ContactItem = {
  label: string;
  value: string;
  href?: string;
};

function rowUrl(label: string, raw: string | null | undefined): ContactItem {
  const v = raw?.trim();
  if (!v) return { label, value: CONTACT_EMPTY };
  const href = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  return { label, value: v, href };
}

function rowText(label: string, raw: string | null | undefined): ContactItem {
  const v = raw?.trim();
  return { label, value: v || CONTACT_EMPTY };
}

async function getContactRows(): Promise<ContactItem[]> {
  const user = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    include: { profile: true },
  });
  const p = user?.profile;

  const email = p?.email?.trim() || user?.email?.trim();
  const emailRow: ContactItem = email
    ? { label: "邮箱", value: email, href: `mailto:${email}` }
    : { label: "邮箱", value: CONTACT_EMPTY };

  const phoneRaw = p?.phone?.trim();
  const phoneRow: ContactItem = phoneRaw
    ? {
        label: "电话",
        value: phoneRaw,
        href: `tel:${phoneRaw.replace(/\s/g, "")}`,
      }
    : { label: "电话", value: CONTACT_EMPTY };

  return [
    emailRow,
    phoneRow,
    rowText("微信", p?.wechat),
    rowText("QQ", p?.qq),
    rowUrl("个人网站", p?.website),
    rowUrl("GitHub", p?.github),
    rowUrl("Twitter / X", p?.twitter),
    rowUrl("微博", p?.weibo),
    rowUrl("哔哩哔哩", p?.bilibili),
    rowUrl("YouTube", p?.youtube),
    rowText("所在地", p?.location),
  ];
}

export default async function AboutPage() {
  const contactRows = await getContactRows();

  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-col gap-10 lg:flex-row lg:gap-12">
          <AdminProfileCard />

          <div className="min-w-0 flex-1 space-y-12">
            <section
              className="prose prose-gray max-w-none dark:prose-invert"
              aria-labelledby="about-site"
            >
              <div className="mb-4 flex items-center gap-2 not-prose">
                <Sparkles className="h-5 w-5 text-primary" aria-hidden />
                <h2
                  id="about-site"
                  className="m-0 text-lg font-semibold text-foreground"
                >
                  关于本站
                </h2>
              </div>
              <p className="text-lg leading-relaxed text-foreground">
                这是一个基于 Next.js 与 AI
                能力搭建的现代化博客：面向长期写作与内容管理，兼顾阅读体验与后台效率。
              </p>
              <p className="text-muted-foreground">
                技术栈包括 Next.js App Router、Prisma ORM、NextAuth.js
                身份验证，并集成 AI
                辅助写作，用于草稿、润色与结构化输出，让创作流程更顺畅。
              </p>
            </section>

            <section
              className="prose prose-gray max-w-none dark:prose-invert"
              aria-labelledby="about-author"
            >
              <div className="mb-4 flex items-center gap-2 not-prose">
                <GraduationCap className="h-5 w-5 text-primary" aria-hidden />
                <h2
                  id="about-author"
                  className="m-0 text-lg font-semibold text-foreground"
                >
                  教育与工作
                </h2>
              </div>
              <ul className="not-prose space-y-4 text-foreground">
                <li className="flex gap-3 leading-relaxed">
                  <GraduationCap
                    className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span>毕业于武汉理工大学。</span>
                </li>
                <li className="flex gap-3 leading-relaxed">
                  <Building2
                    className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span>自 2024 年 7 月起至今，就职于 xxx 公司。</span>
                </li>
              </ul>
            </section>

            <section
              className="prose prose-gray max-w-none dark:prose-invert"
              aria-labelledby="about-contact"
            >
              <div className="mb-4 flex items-center gap-2 not-prose">
                <Mail className="h-5 w-5 text-primary" aria-hidden />
                <h2
                  id="about-contact"
                  className="m-0 text-lg font-semibold text-foreground"
                >
                  联系方式
                </h2>
              </div>
              <ul className="not-prose space-y-3 text-foreground">
                {contactRows.map((item) => {
                  const isEmpty = item.value === CONTACT_EMPTY;
                  return (
                    <li
                      key={item.label}
                      className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4"
                    >
                      <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-muted-foreground sm:w-32">
                        {item.label === "邮箱" && (
                          <Mail className="h-3.5 w-3.5" aria-hidden />
                        )}
                        {item.label === "电话" && (
                          <Phone className="h-3.5 w-3.5" aria-hidden />
                        )}
                        {(item.label === "微信" || item.label === "QQ") && (
                          <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                        )}
                        {item.label}
                      </span>
                      <span
                        className={`min-w-0 break-all text-sm leading-relaxed ${isEmpty ? "text-muted-foreground" : ""}`}
                      >
                        {!isEmpty && item.href ? (
                          <a
                            href={item.href}
                            className="text-primary underline-offset-4 hover:underline"
                            {...(item.href.startsWith("http")
                              ? {
                                  target: "_blank",
                                  rel: "noopener noreferrer",
                                }
                              : {})}
                          >
                            {item.value}
                          </a>
                        ) : (
                          item.value
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
