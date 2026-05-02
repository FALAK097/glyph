import type { SkillEntry } from "@/core/skills";

/**
 * Returns true when ALL space-delimited tokens in `query` appear somewhere in
 * the combined text of the provided `values`.  Order of tokens is irrelevant,
 * and each token only needs to be a substring of the combined text.
 *
 * Examples:
 *   matchesPaletteQuery("open task", "Open Tasks", "…") → true  (both tokens match)
 *   matchesPaletteQuery("task open", "Open Tasks", "…") → true  (order-insensitive)
 *   matchesPaletteQuery("kanban",    "Open Tasks", "Review workspace tasks and kanban board") → true
 */
export function matchesPaletteQuery(query: string, ...values: Array<string | null | undefined>) {
  if (!query) {
    return true;
  }

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const text = values
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .join(" ")
    .toLowerCase();

  return words.every((word) => text.includes(word));
}

export function matchesSkillPaletteFallback(query: string, skill: SkillEntry) {
  if (!query) {
    return true;
  }

  const lowerQuery = query.toLowerCase();
  return [skill.name, skill.description, skill.slug, skill.sourceName, skill.tags.join(" ")].some(
    (value) => value?.toLowerCase().includes(lowerQuery),
  );
}
