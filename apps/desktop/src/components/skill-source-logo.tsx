import { cn } from "@/lib/utils";
import type { SkillSourceKind } from "@/shared/skills";
import { FileIcon, FolderIcon, OutlineIcon, ShortcutIcon } from "./icons";

type SkillIconKind = "all-agents" | "all-skills" | "global" | "project";

type LogoSources = {
  dark?: string;
  light?: string;
  single?: string;
};

type SkillSourceLogoProps = {
  className?: string;
  fallbackLabel: string;
  iconKind?: SkillIconKind;
  sourceKind?: SkillSourceKind;
  variant?: "compact" | "badge";
};

const skillLogoBasePath = `${import.meta.env.BASE_URL}skills`;

function getLogoSources(sourceKind?: SkillSourceKind): LogoSources | null {
  switch (sourceKind) {
    case "codex":
      return {
        dark: `${skillLogoBasePath}/codex_dark.svg`,
        light: `${skillLogoBasePath}/codex_light.svg`,
      };
    case "cursor":
      return {
        dark: `${skillLogoBasePath}/cursor_dark.svg`,
        light: `${skillLogoBasePath}/cursor_light.svg`,
      };
    case "opencode":
      return {
        dark: `${skillLogoBasePath}/opencode_dark.svg`,
        light: `${skillLogoBasePath}/opencode_light.svg`,
      };
    case "windsurf":
      return {
        dark: `${skillLogoBasePath}/windsurf-dark.svg`,
        light: `${skillLogoBasePath}/windsurf-light.svg`,
      };
    case "claude":
      return {
        single: `${skillLogoBasePath}/claude-ai-icon.svg`,
      };
    case "amp":
      return {
        single: `${skillLogoBasePath}/amp-logo.svg`,
      };
    case "gemini":
      return {
        single: `${skillLogoBasePath}/gemini.svg`,
      };
    case "copilot":
      return {
        dark: `${skillLogoBasePath}/copilot_dark.svg`,
        light: `${skillLogoBasePath}/copilot_light.svg`,
      };
    case "kimi":
      return {
        single: `${skillLogoBasePath}/kimi-icon.svg`,
      };
    case "kiro":
      return {
        single: `${skillLogoBasePath}/kiro.svg`,
      };
    case "kilocode":
      return {
        dark: `${skillLogoBasePath}/kilocode-dark.svg`,
        light: `${skillLogoBasePath}/kilocode-light.svg`,
      };
    case "mistral":
      return {
        single: `${skillLogoBasePath}/mistral-ai_logo.svg`,
      };
    case "openclaw":
      return {
        single: `${skillLogoBasePath}/openclaw.svg`,
      };
    case "warp":
      return {
        single: `${skillLogoBasePath}/warp.svg`,
      };
    case "pi":
      return {
        single: `${skillLogoBasePath}/pi.svg`,
      };
    default:
      return null;
  }
}

function getLogoImageClassName(
  sourceKind: SkillSourceKind | undefined,
  variant: "compact" | "badge",
) {
  const imageSizeClasses = variant === "badge" ? "size-3.5" : "size-3";

  if (sourceKind === "pi") {
    return cn("block object-contain invert dark:invert-0", imageSizeClasses);
  }

  return cn("block object-contain", imageSizeClasses);
}

function renderIcon({
  className,
  iconKind,
  sourceKind,
  variant,
}: {
  className?: string;
  iconKind?: SkillIconKind;
  sourceKind?: SkillSourceKind;
  variant: "compact" | "badge";
}) {
  const sources = getLogoSources(sourceKind);
  const iconSize = variant === "badge" ? 16 : 14;
  const sizeClasses = variant === "badge" ? "size-6" : "size-5";
  const imageClassName = getLogoImageClassName(sourceKind, variant);

  if (iconKind === "all-skills") {
    return (
      <span
        aria-hidden="true"
        className={cn("inline-flex shrink-0 items-center justify-center", sizeClasses, className)}
      >
        <OutlineIcon size={iconSize} className="text-muted-foreground" />
      </span>
    );
  }

  if (iconKind === "all-agents") {
    return (
      <span
        aria-hidden="true"
        className={cn("inline-flex shrink-0 items-center justify-center", sizeClasses, className)}
      >
        <ShortcutIcon size={iconSize} className="text-muted-foreground" />
      </span>
    );
  }

  if (iconKind === "global") {
    return (
      <span
        aria-hidden="true"
        className={cn("inline-flex shrink-0 items-center justify-center", sizeClasses, className)}
      >
        <svg
          viewBox="0 0 20 20"
          className={
            variant === "badge" ? "size-4 text-muted-foreground" : "size-3.5 text-muted-foreground"
          }
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        >
          <circle cx="10" cy="10" r="6.75" />
          <path d="M3.5 10h13" />
          <path d="M10 3.5c1.9 1.9 3 4.1 3 6.5s-1.1 4.6-3 6.5c-1.9-1.9-3-4.1-3-6.5s1.1-4.6 3-6.5Z" />
        </svg>
      </span>
    );
  }

  if (iconKind === "project" || sourceKind === "project") {
    return (
      <span
        aria-hidden="true"
        className={cn("inline-flex shrink-0 items-center justify-center", sizeClasses, className)}
      >
        <FolderIcon size={iconSize} className="text-muted-foreground" />
      </span>
    );
  }

  if (sourceKind === "agents") {
    return (
      <span
        aria-hidden="true"
        className={cn("inline-flex shrink-0 items-center justify-center", sizeClasses, className)}
      >
        <svg
          viewBox="0 0 20 20"
          className={
            variant === "badge" ? "size-4 text-muted-foreground" : "size-3.5 text-muted-foreground"
          }
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        >
          <circle cx="10" cy="10" r="6.75" />
          <path d="M3.5 10h13" />
          <path d="M10 3.5c1.9 1.9 3 4.1 3 6.5s-1.1 4.6-3 6.5c-1.9-1.9-3-4.1-3-6.5s1.1-4.6 3-6.5Z" />
        </svg>
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0 items-center justify-center", sizeClasses, className)}
    >
      {sources?.single ? (
        <img src={sources.single} alt="" className={imageClassName} />
      ) : sources?.dark && sources.light ? (
        <>
          <img src={sources.light} alt="" className={cn("dark:hidden", imageClassName)} />
          <img src={sources.dark} alt="" className={cn("hidden dark:block", imageClassName)} />
        </>
      ) : (
        <FileIcon size={iconSize} className="text-muted-foreground/85" />
      )}
    </span>
  );
}

export function SkillSourceLogo({
  className,
  iconKind,
  sourceKind,
  variant = "compact",
}: SkillSourceLogoProps) {
  return renderIcon({ className, iconKind, sourceKind, variant });
}

type SkillSourceLogoStackProps = {
  className?: string;
  sourceKinds: SkillSourceKind[];
  variant?: "compact" | "badge";
};

export function SkillSourceLogoStack({
  className,
  sourceKinds,
  variant = "compact",
}: SkillSourceLogoStackProps) {
  const uniqueKinds = Array.from(new Set(sourceKinds)).slice(0, 3);

  return (
    <span className={cn("inline-flex items-center", className)}>
      {uniqueKinds.map((sourceKind, index) => (
        <span key={sourceKind} className={cn("inline-flex shrink-0", index > 0 ? "-ml-1.5" : "")}>
          {renderIcon({ sourceKind, variant })}
        </span>
      ))}
    </span>
  );
}
