import { createPortal } from "react-dom";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { PencilIcon, TrashIcon, XIcon } from "@/components/icons";
import { FileManagerLogo } from "@/components/file-manager-logo";

export type SidebarActionMenuCoords = {
  top: number;
  left: number;
};

type SidebarActionMenuItem = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  variant?: "default" | "destructive";
};

type SidebarActionMenuProps = {
  open: boolean;
  coords: SidebarActionMenuCoords | null;
  onClose: () => void;
  onCloseFocusRef?: React.RefObject<HTMLButtonElement | null>;
  items: SidebarActionMenuItem[];
  ariaLabel: string;
};

export function SidebarActionMenu({
  open,
  coords,
  onClose,
  onCloseFocusRef,
  items,
  ariaLabel,
}: SidebarActionMenuProps) {
  if (!open || !coords) {
    return null;
  }

  return createPortal(
    <>
      <button
        aria-label={ariaLabel}
        className="fixed inset-0 z-40 cursor-default bg-transparent outline-none"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
          window.requestAnimationFrame(() => {
            onCloseFocusRef?.current?.focus();
          });
        }}
        type="button"
        tabIndex={-1}
      />
      <div
        className="fixed z-50 w-[142px] rounded-md border border-border bg-popover py-1 shadow-lg"
        style={{ top: coords.top, left: coords.left }}
      >
        {items.map((item) => (
          <Button
            key={item.label}
            variant="ghost"
            size="sm"
            className={`h-auto w-full justify-start gap-2 rounded-none px-2.5 py-1.5 text-sm ${
              item.variant === "destructive"
                ? "hover:bg-destructive/10 hover:text-destructive"
                : "hover:bg-accent"
            }`}
            onClick={(event) => {
              event.stopPropagation();
              item.onClick();
              onClose();
            }}
            type="button"
          >
            {item.icon}
            {item.label}
          </Button>
        ))}
      </div>
    </>,
    document.body,
  );
}

export function buildFileMenuItems(options: {
  displayFileName: string;
  onRename: () => void;
  onRevealInFinder: () => void;
  onRemove: () => void;
  onDelete: () => void;
  revealLabel: string;
}): SidebarActionMenuItem[] {
  return [
    {
      label: "Rename",
      icon: <PencilIcon size={14} className="opacity-70" />,
      onClick: options.onRename,
    },
    {
      label: options.revealLabel,
      icon: <FileManagerLogo label={options.revealLabel} size={14} className="opacity-70" />,
      onClick: options.onRevealInFinder,
    },
    {
      label: "Remove",
      icon: <XIcon size={14} className="opacity-70" />,
      onClick: options.onRemove,
    },
    {
      label: "Delete",
      icon: <TrashIcon size={14} className="opacity-70" />,
      onClick: options.onDelete,
      variant: "destructive",
    },
  ];
}

export function buildFolderMenuItems(options: {
  folderName: string;
  onRename: () => void;
  onRevealInFinder: () => void;
  onRemove: () => void;
  onDelete?: () => void;
  revealLabel: string;
}): SidebarActionMenuItem[] {
  const items: SidebarActionMenuItem[] = [
    {
      label: "Rename",
      icon: <PencilIcon size={14} className="opacity-70" />,
      onClick: options.onRename,
    },
    {
      label: options.revealLabel,
      icon: <FileManagerLogo label={options.revealLabel} size={14} className="opacity-70" />,
      onClick: options.onRevealInFinder,
    },
    {
      label: "Remove",
      icon: <XIcon size={14} className="opacity-70" />,
      onClick: options.onRemove,
    },
  ];

  if (options.onDelete) {
    items.push({
      label: "Delete",
      icon: <TrashIcon size={14} className="opacity-70" />,
      onClick: options.onDelete,
      variant: "destructive",
    });
  }

  return items;
}
