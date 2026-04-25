import type { SkillEntry, SkillSourceKind, SkillToolKind } from "@/core/skills";

export type SkillCollection = {
  id: string;
  fallbackLabel: string;
  iconKind?: "all-agents" | "all-skills" | "global" | "project";
  label: string;
  sourceKind?: SkillSourceKind;
  toolKind?: SkillToolKind;
  count: number;
  group: "scope" | "tool";
  matches: (skill: SkillEntry) => boolean;
};

export type PendingNoteRename = {
  name: string;
  path: string;
  value: string;
};

export type PendingNoteConfirm = {
  kind: "delete" | "remove";
  name: string;
  path: string;
};
