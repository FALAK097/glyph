import type { SkillEntry } from "@/core/skills";

export function matchesPaletteQuery(query: string, ...values: Array<string | null | undefined>) {
  if (!query) {
    return true;
  }

  const lowerQuery = query.toLowerCase();
  return values.some((value) => value?.toLowerCase().includes(lowerQuery));
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
