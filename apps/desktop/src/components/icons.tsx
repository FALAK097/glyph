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

export const GlyphLogoMark = ({ size = 128, className }: IconProps) => {
  return (
    <img
      src="/icon.png"
      alt="Glyph Logo"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
    />
  );
};
