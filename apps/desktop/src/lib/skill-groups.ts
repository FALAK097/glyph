import type { SkillEntry, SkillSourceKind } from "@/shared/skills";

export type SkillBrowserItem = {
  description: string | null;
  hasAgentsFile: boolean;
  id: string;
  memberSkillIds: string[];
  name: string;
  representativeSkillId: string;
  sourceKinds: SkillSourceKind[];
  sourceNames: string[];
};

const SOURCE_PRIORITY: Record<SkillSourceKind, number> = {
  codex: 0,
  claude: 1,
  cursor: 2,
  opencode: 3,
  windsurf: 4,
  amp: 5,
  agents: 6,
  project: 7,
};

function getSkillGroupKey(skill: SkillEntry) {
  const slug = skill.slug.trim().toLowerCase();
  if (slug) {
    return slug;
  }

  return skill.name.trim().toLowerCase();
}

function compareSkillEntries(left: SkillEntry, right: SkillEntry) {
  const sourcePriorityDelta = SOURCE_PRIORITY[left.sourceKind] - SOURCE_PRIORITY[right.sourceKind];
  if (sourcePriorityDelta !== 0) {
    return sourcePriorityDelta;
  }

  return left.sourceName.localeCompare(right.sourceName, undefined, {
    sensitivity: "base",
  });
}

export function groupSkillsForBrowse(skills: SkillEntry[]): SkillBrowserItem[] {
  const groups = new Map<string, SkillEntry[]>();

  for (const skill of skills) {
    const key = getSkillGroupKey(skill);
    const current = groups.get(key);

    if (current) {
      current.push(skill);
      continue;
    }

    groups.set(key, [skill]);
  }

  return Array.from(groups.entries())
    .map(([key, entries]) => {
      const sortedEntries = [...entries].sort(compareSkillEntries);
      const representative = sortedEntries[0];

      return {
        description: representative.description,
        hasAgentsFile: sortedEntries.some((entry) => entry.hasAgentsFile),
        id: key,
        memberSkillIds: sortedEntries.map((entry) => entry.id),
        name: representative.name,
        representativeSkillId: representative.id,
        sourceKinds: Array.from(new Set(sortedEntries.map((entry) => entry.sourceKind))),
        sourceNames: Array.from(new Set(sortedEntries.map((entry) => entry.sourceName))),
      };
    })
    .sort((left, right) =>
      left.name.localeCompare(right.name, undefined, {
        sensitivity: "base",
      }),
    );
}

export function countGroupedSkills(skills: SkillEntry[]) {
  return groupSkillsForBrowse(skills).length;
}
