import type { SkillEntry } from "@/core/skills";

export function matchesPaletteQuery(query: string, ...values: Array<string | null | undefined>) {
  if (!query) {
    return true;
  }

  return values.some((value) => value?.toLowerCase().includes(query));
}

export function matchesSkillPaletteFallback(query: string, skill: SkillEntry) {
  if (!query) {
    return true;
  }

  return [skill.name, skill.description, skill.slug, skill.sourceName, skill.tags.join(" ")].some(
    (value) => value?.toLowerCase().includes(query),
  );
}
