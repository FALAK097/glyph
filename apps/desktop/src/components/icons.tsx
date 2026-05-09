import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon as Add01Svg,
  ArrowLeft01Icon as ArrowLeft01Svg,
  ArrowRight01Icon as ArrowRight01Svg,
  ArrowUp01Icon as ArrowUp01Svg,
  ArrowDown01Icon as ArrowDown01Svg,
  Book01Icon as Book01Svg,
  Briefcase01Icon as Briefcase01Svg,
  Calendar01Icon as Calendar01Svg,
  Camera01Icon as Camera01Svg,
  Cancel01Icon as Cancel01Svg,
  CheckmarkCircle01Icon as CheckmarkCircle01Svg,
  CopyIcon as CopySvg,
  Delete02Icon as Delete02Svg,
  DiscountTag01Icon as DiscountTag01Svg,
  File01Icon as File01Svg,
  FileDownIcon as FileDownSvg,
  Folder01Icon as Folder01Svg,
  FolderAddIcon as FolderAddSvg,
  Globe02Icon as Globe02Svg,
  Home01Icon as Home01Svg,
  HonourStarIcon as HonourStarSvg,
  Idea01Icon as Idea01Svg,
  KeyboardIcon as KeyboardSvg,
  Layers01Icon as Layers01Svg,
  Leaf01Icon as Leaf01Svg,
  Link01Icon as Link01Svg,
  ListViewIcon as ListViewSvg,
  Maximize01Icon as Maximize01Svg,
  MoreHorizontalIcon as MoreHorizontalSvg,
  MoreVerticalIcon as MoreVerticalSvg,
  Notebook01Icon as Notebook01Svg,
  PanelLeftIcon as HugePanelLeftIcon,
  PanelRightIcon as HugePanelRightIcon,
  PinIcon as HugePinIcon,
  PinOffIcon as HugePinOffIcon,
  PencilEdit02Icon as PencilEdit02Svg,
  Rocket01Icon as Rocket01Svg,
  Search01Icon as Search01Svg,
  Settings01Icon as Settings01Svg,
  SparklesIcon as SparklesSvg,
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
export const FolderPlusIcon = (props: IconProps) => <HugeIcon icon={FolderAddSvg} {...props} />;
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
export const FileDownIcon = (props: IconProps) => <HugeIcon icon={FileDownSvg} {...props} />;
export const CheckCircleIcon = (props: IconProps) => (
  <HugeIcon icon={CheckmarkCircle01Svg} {...props} />
);
export const XIcon = (props: IconProps) => <HugeIcon icon={Cancel01Svg} {...props} />;
export const PinIcon = (props: IconProps) => <HugeIcon icon={HugePinIcon} {...props} />;
export const PinOffIcon = (props: IconProps) => <HugeIcon icon={HugePinOffIcon} {...props} />;

export const FocusIcon = (props: IconProps) => <HugeIcon icon={Maximize01Svg} {...props} />;
export const OutlineIcon = (props: IconProps) => <HugeIcon icon={ListViewSvg} {...props} />;

export const ZoomInIcon = (props: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? 16}
    height={props.size ?? 16}
    viewBox="0 0 24 24"
    fill="none"
    stroke={props.color ?? "currentColor"}
    strokeWidth={props.strokeWidth ?? 2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={props.className}
  >
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
    <path d="M11 8v6" />
    <path d="M8 11h6" />
  </svg>
);

export const ZoomOutIcon = (props: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? 16}
    height={props.size ?? 16}
    viewBox="0 0 24 24"
    fill="none"
    stroke={props.color ?? "currentColor"}
    strokeWidth={props.strokeWidth ?? 2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={props.className}
  >
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
    <path d="M8 11h6" />
  </svg>
);

/** Archive box icon (custom SVG — not in HugeIcons free set) */
export const ArchiveIcon = (props: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? 16}
    height={props.size ?? 16}
    viewBox="0 0 24 24"
    fill="none"
    stroke={props.color ?? "currentColor"}
    strokeWidth={props.strokeWidth ?? 2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={props.className}
  >
    <rect x="2" y="3" width="20" height="5" rx="1" />
    <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
    <path d="M10 12h4" />
  </svg>
);

// Note collection icon set — HugeIcons free
export const BookIcon = (props: IconProps) => <HugeIcon icon={Book01Svg} {...props} />;
export const BriefcaseIcon = (props: IconProps) => <HugeIcon icon={Briefcase01Svg} {...props} />;
export const CalendarIcon = (props: IconProps) => <HugeIcon icon={Calendar01Svg} {...props} />;
export const CameraIcon = (props: IconProps) => <HugeIcon icon={Camera01Svg} {...props} />;
export const DiscountTagIcon = (props: IconProps) => (
  <HugeIcon icon={DiscountTag01Svg} {...props} />
);
export const GlobeIcon = (props: IconProps) => <HugeIcon icon={Globe02Svg} {...props} />;
export const HomeIcon = (props: IconProps) => <HugeIcon icon={Home01Svg} {...props} />;
export const HonourStarIcon = (props: IconProps) => <HugeIcon icon={HonourStarSvg} {...props} />;
export const IdeaIcon = (props: IconProps) => <HugeIcon icon={Idea01Svg} {...props} />;
export const LayersIcon = (props: IconProps) => <HugeIcon icon={Layers01Svg} {...props} />;
export const LeafIcon = (props: IconProps) => <HugeIcon icon={Leaf01Svg} {...props} />;
export const NotebookIcon = (props: IconProps) => <HugeIcon icon={Notebook01Svg} {...props} />;
export const RocketIcon = (props: IconProps) => <HugeIcon icon={Rocket01Svg} {...props} />;
export const SparklesIcon = (props: IconProps) => <HugeIcon icon={SparklesSvg} {...props} />;
