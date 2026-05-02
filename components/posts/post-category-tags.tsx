import { cn } from "@/lib/utils";

export interface PostCategoryTagsProps {
  category: { name: string; icon: string | null } | null;
  tags: { tag: { name: string; slug: string } }[];
  tagLimit?: number;
  className?: string;
}

export function PostCategoryTags({
  category,
  tags,
  tagLimit,
  className,
}: PostCategoryTagsProps) {
  const shownTags =
    tagLimit !== undefined ? tags.slice(0, tagLimit) : tags;
  if (!category && shownTags.length === 0) return null;

  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {category ? (
        <span
          className="inline-flex h-7 min-w-7 items-center justify-center rounded-md text-sm leading-none text-[#595959] dark:text-muted-foreground"
          title={category.name}
          aria-label={category.name}
        >
          {category.icon ?? "🏷️"}
        </span>
      ) : null}
      {shownTags.map(({ tag: t }) => (
        <span
          key={t.slug}
          className="rounded-md bg-[#F5F5F5] px-2 py-1 text-xs text-[#595959] dark:bg-muted dark:text-muted-foreground"
        >
          {t.name}
        </span>
      ))}
    </div>
  );
}
