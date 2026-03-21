import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon as Add01Svg,
  ArrowLeft01Icon as ArrowLeft01Svg,
  ArrowRight01Icon as ArrowRight01Svg,
  ArrowUp01Icon as ArrowUp01Svg,
  ArrowDown01Icon as ArrowDown01Svg,
  Cancel01Icon as Cancel01Svg,
  CheckmarkCircle01Icon as CheckmarkCircle01Svg,
  CopyIcon as CopySvg,
  Delete02Icon as Delete02Svg,
  File01Icon as File01Svg,
  FileDownIcon as FileDownSvg,
  Folder01Icon as Folder01Svg,
  FolderOpenIcon as FolderOpenSvg,
  KeyboardIcon as KeyboardSvg,
  Link01Icon as Link01Svg,
  LinkSquare01Icon as LinkSquare01Svg,
  MoreHorizontalIcon as MoreHorizontalSvg,
  MoreVerticalIcon as MoreVerticalSvg,
  PanelLeftIcon as HugePanelLeftIcon,
  PanelRightIcon as HugePanelRightIcon,
  PencilEdit02Icon as PencilEdit02Svg,
  Search01Icon as Search01Svg,
  Settings01Icon as Settings01Svg,
  UnfoldMoreIcon as UnfoldMoreSvg,
  Tick02Icon as Tick02Svg,
} from "@hugeicons/core-free-icons";

import type { HugeIconProps, IconProps } from "../types/icons";

const HugeIcon = ({ icon, size, className, color, strokeWidth }: HugeIconProps) => {
  return (
    <HugeiconsIcon
      icon={icon}
      size={size ?? 16}
      color={color ?? "currentColor"}
      strokeWidth={strokeWidth ?? 2}
      className={className}
    />
  );
};

const SvgIcon = ({ size = 16, className, color = "currentColor" }: IconProps) => ({
  size,
  className,
  color,
});

export const ChevronRightIcon = (props: IconProps) => (
  <HugeIcon icon={ArrowRight01Svg} {...props} />
);
export const FolderIcon = (props: IconProps) => <HugeIcon icon={Folder01Svg} {...props} />;
export const FileIcon = (props: IconProps) => <HugeIcon icon={File01Svg} {...props} />;
export const MoreVerticalIcon = (props: IconProps) => (
  <HugeIcon icon={MoreVerticalSvg} {...props} />
);
export const PencilIcon = (props: IconProps) => <HugeIcon icon={PencilEdit02Svg} {...props} />;
export const TrashIcon = (props: IconProps) => <HugeIcon icon={Delete02Svg} {...props} />;

export const PanelLeftIcon = (props: IconProps) => <HugeIcon icon={HugePanelLeftIcon} {...props} />;
export const PanelRightIcon = (props: IconProps) => (
  <HugeIcon icon={HugePanelRightIcon} {...props} />
);
export const ArrowLeftIcon = (props: IconProps) => <HugeIcon icon={ArrowLeft01Svg} {...props} />;
export const ArrowRightIcon = (props: IconProps) => <HugeIcon icon={ArrowRight01Svg} {...props} />;
export const ExternalLinkIcon = (props: IconProps) => (
  <HugeIcon icon={LinkSquare01Svg} {...props} />
);
export const ArrowUpIcon = (props: IconProps) => <HugeIcon icon={ArrowUp01Svg} {...props} />;
export const ArrowDownIcon = (props: IconProps) => <HugeIcon icon={ArrowDown01Svg} {...props} />;
export const UnfoldMoreIcon = (props: IconProps) => <HugeIcon icon={UnfoldMoreSvg} {...props} />;
export const TickIcon = (props: IconProps) => <HugeIcon icon={Tick02Svg} {...props} />;
export const SearchIcon = (props: IconProps) => <HugeIcon icon={Search01Svg} {...props} />;
export const GearIcon = (props: IconProps) => <HugeIcon icon={Settings01Svg} {...props} />;
export const ShortcutIcon = (props: IconProps) => <HugeIcon icon={KeyboardSvg} {...props} />;
export const PlusIcon = (props: IconProps) => <HugeIcon icon={Add01Svg} {...props} />;

export const DotsHorizontalIcon = (props: IconProps) => (
  <HugeIcon icon={MoreHorizontalSvg} {...props} />
);
export const CopyIcon = (props: IconProps) => <HugeIcon icon={CopySvg} {...props} />;
export const LinkIcon = (props: IconProps) => <HugeIcon icon={Link01Svg} {...props} />;
export const RevealInFolderIcon = (props: IconProps) => (
  <HugeIcon icon={FolderOpenSvg} {...props} />
);
export const FileDownIcon = (props: IconProps) => <HugeIcon icon={FileDownSvg} {...props} />;
export const CheckCircleIcon = (props: IconProps) => (
  <HugeIcon icon={CheckmarkCircle01Svg} {...props} />
);
export const XIcon = (props: IconProps) => <HugeIcon icon={Cancel01Svg} {...props} />;

export const PinIcon = (props: IconProps) => {
  const svg = SvgIcon(props);
  return (
    <svg
      width={svg.size}
      height={svg.size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={svg.color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={svg.className}
      aria-hidden="true"
    >
      <path d="M8.5 4.5h7l-1.4 5 2.9 2.9H7l2.9-2.9-1.4-5Z" />
      <path d="M12 12.4V20" />
    </svg>
  );
};

export const StarIcon = (props: IconProps) => {
  const svg = SvgIcon(props);
  return (
    <svg
      width={svg.size}
      height={svg.size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={svg.color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={svg.className}
      aria-hidden="true"
    >
      <path d="m12 3.8 2.5 5.08 5.6.82-4.05 3.95.96 5.58L12 16.6l-5.01 2.63.96-5.58L3.9 9.7l5.6-.82L12 3.8Z" />
    </svg>
  );
};

export const FocusIcon = (props: IconProps) => {
  const svg = SvgIcon(props);
  return (
    <svg
      width={svg.size}
      height={svg.size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={svg.color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={svg.className}
      aria-hidden="true"
    >
      <path d="M4 9V5h4" />
      <path d="M20 9V5h-4" />
      <path d="M4 15v4h4" />
      <path d="M20 15v4h-4" />
      <circle cx="12" cy="12" r="3.25" />
    </svg>
  );
};

export const ReadingModeIcon = (props: IconProps) => {
  const svg = SvgIcon(props);
  return (
    <svg
      width={svg.size}
      height={svg.size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={svg.color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={svg.className}
      aria-hidden="true"
    >
      <path d="M5 5.5h6.5A3.5 3.5 0 0 1 15 9v9.5H8.5A3.5 3.5 0 0 0 5 22V5.5Z" />
      <path d="M19 5.5h-6.5A3.5 3.5 0 0 0 9 9v9.5h6.5A3.5 3.5 0 0 1 19 22V5.5Z" />
    </svg>
  );
};

export const OutlineIcon = (props: IconProps) => {
  const svg = SvgIcon(props);
  return (
    <svg
      width={svg.size}
      height={svg.size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={svg.color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={svg.className}
      aria-hidden="true"
    >
      <path d="M5 6h14" />
      <path d="M5 12h6" />
      <path d="M5 18h10" />
      <path d="M15 11.5h4v7h-4z" />
    </svg>
  );
};

const glyphLogoMarkSrc = `${import.meta.env.BASE_URL}icon.png`;

export const GlyphLogoMark = ({ size = 128, className }: IconProps) => {
  return (
    <img
      src={glyphLogoMarkSrc}
      alt="Glyph Logo"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
    />
  );
};
