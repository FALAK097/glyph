import type { SkillEntry, SkillSourceKind, SkillToolKind } from "@/shared/skills";

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
  gemini: 6,
  copilot: 7,
  kimi: 8,
  kiro: 9,
  kilocode: 10,
  mistral: 11,
  openclaw: 12,
  warp: 13,
  pi: 14,
  augment: 15,
  bob: 16,
  codebuddy: 17,
  commandcode: 18,
  continue: 19,
  cortex: 20,
  crush: 21,
  factory: 22,
  goose: 23,
  junie: 24,
  iflow: 25,
  kode: 26,
  mcpjam: 27,
  mux: 28,
  openhands: 29,
  qoder: 30,
  qwen: 31,
  roo: 32,
  trae: 33,
  zencoder: 34,
  neovate: 35,
  pochi: 36,
  adal: 37,
  agents: 38,
  project: 39,
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

function sortKinds(kinds: SkillSourceKind[]) {
  return [...kinds].sort((left, right) => SOURCE_PRIORITY[left] - SOURCE_PRIORITY[right]);
}

function getDisplayKinds(entries: SkillEntry[]): SkillSourceKind[] {
  const kinds = new Set<SkillSourceKind>();

  for (const entry of entries) {
    if (entry.sourceKind === "agents" || entry.sourceKind === "project") {
      entry.compatibleToolKinds.forEach((kind) => {
        kinds.add(kind as SkillToolKind);
      });
      continue;
    }

    kinds.add(entry.sourceKind);
  }

  return sortKinds(Array.from(kinds));
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
        sourceKinds: getDisplayKinds(sortedEntries),
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
