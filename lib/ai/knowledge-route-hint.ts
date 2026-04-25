export const KNOWLEDGE_ROUTE_HINTS = [
  "auto",
  "chit",
  "site_articles",
  "current_page",
] as const;

export type KnowledgeRouteHint = (typeof KNOWLEDGE_ROUTE_HINTS)[number];

export function isKnowledgeRouteHint(
  value: unknown,
): value is KnowledgeRouteHint {
  return (
    typeof value === "string" &&
    (KNOWLEDGE_ROUTE_HINTS as readonly string[]).includes(value)
  );
}
