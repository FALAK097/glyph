import { useIsDarkMode } from "@/hooks/use-is-dark-mode";

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
    case "mux":
      return {
        single: `${skillLogoBasePath}/mux.svg`,
      };
    case "openhands":
      return {
        single: `${skillLogoBasePath}/openhands.svg`,
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
    case "qwen":
      return {
        single: `${skillLogoBasePath}/qwen.svg`,
      };
    case "zencoder":
      return {
        single: `${skillLogoBasePath}/zencoder.svg`,
      };
    default:
      return null;
  }
}

function resolveLogoSource(sources: LogoSources | null, isDarkMode: boolean) {
  if (!sources) {
    return null;
  }

  if (sources.single) {
    return sources.single;
  }

  return isDarkMode
    ? (sources.dark ?? sources.light ?? null)
    : (sources.light ?? sources.dark ?? null);
}

function getLogoImageClassName(
  sourceKind: SkillSourceKind | undefined,
  variant: "compact" | "badge",
) {
  const imageSizeClasses = variant === "badge" ? "h-[18px] w-[18px]" : "h-4 w-4";

  if (sourceKind === "pi") {
    return cn("block object-contain invert dark:invert-0", imageSizeClasses);
  }

  return cn("block object-contain", imageSizeClasses);
}

function renderIcon({
  className,
  iconKind,
  isDarkMode,
  sourceKind,
  variant,
}: {
  className?: string;
  iconKind?: SkillIconKind;
  isDarkMode: boolean;
  sourceKind?: SkillSourceKind;
  variant: "compact" | "badge";
}) {
  const sources = getLogoSources(sourceKind);
  const iconSize = variant === "badge" ? 16 : 14;
  const sizeClasses = variant === "badge" ? "size-6" : "h-[22px] w-[22px]";
  const imageClassName = getLogoImageClassName(sourceKind, variant);
  const logoSource = resolveLogoSource(sources, isDarkMode);

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
      {logoSource ? (
        <img src={logoSource} alt="" className={imageClassName} />
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
  const isDarkMode = useIsDarkMode();
  return renderIcon({ className, iconKind, isDarkMode, sourceKind, variant });
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
  const isDarkMode = useIsDarkMode();
  const uniqueKinds = Array.from(new Set(sourceKinds));
  const visibleKinds = uniqueKinds.slice(0, 4);
  const hiddenCount = Math.max(0, uniqueKinds.length - visibleKinds.length);

  return (
    <span className={cn("inline-flex items-center", className)}>
      {visibleKinds.map((sourceKind, index) => (
        <span key={sourceKind} className={cn("inline-flex shrink-0", index > 0 ? "-ml-1.5" : "")}>
          {renderIcon({ isDarkMode, sourceKind, variant })}
        </span>
      ))}
      {hiddenCount > 0 ? (
        <span className="-ml-1.5 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background px-1 text-[10px] font-semibold text-muted-foreground">
          +{hiddenCount}
        </span>
      ) : null}
    </span>
  );
}
