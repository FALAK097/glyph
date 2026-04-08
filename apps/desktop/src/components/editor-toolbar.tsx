import { useCallback } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  DotsHorizontalIcon,
  FileDownIcon,
  FocusIcon,
  GearIcon,
  LinkIcon,
  PanelLeftIcon,
  PanelRightIcon,
  PinIcon,
  PinOffIcon,
  PlusIcon,
  SearchIcon,
} from "@/components/icons";
import { FileManagerLogo } from "./file-manager-logo";

const MARKDOWN_FILE_SUFFIX_PATTERN = /\.(md|mdx|markdown)$/i;

type EditorToolbarProps = {
  _isMacLike: boolean;
  isSidebarCollapsed: boolean | undefined;
  toggleSidebarShortcut: string | undefined;
  onToggleSidebar: (() => void) | undefined;
  canGoBack: boolean | undefined;
  canGoForward: boolean | undefined;
  navigateBackShortcut: string | undefined;
  navigateForwardShortcut: string | undefined;
  onNavigateBack: (() => void) | undefined;
  onNavigateForward: (() => void) | undefined;
  onCreateNote: (() => void) | undefined;
  newNoteShortcut: string | undefined;
  fileName: string | null;
  filePath: string | null;
  shouldShowCommandPalette: boolean;
  onOpenCommandPalette: (() => void) | undefined;
  commandPaletteShortcut: string | undefined;
  commandPaletteLabel: string | undefined;
  isFocusMode: boolean | undefined;
  onToggleFocusMode: (() => void) | undefined;
  focusModeShortcut: string | undefined;
  shouldShowUpdateActionButton: boolean;
  updateButtonVariant: "default" | "outline";
  isUpdateButtonDisabled: boolean | undefined;
  updateButtonLabel: string;
  updateButtonTooltip: string;
  onUpdateAction: (() => void) | undefined;
  headerPaddingClass: string;
  onOpenSettings: (() => void) | undefined;
  headerAccessory: React.ReactNode;
  content: string;
  documentLabel: string;
  revealInFolderLabel: string;
  onCopy: () => Promise<void>;
  onCopyPath: () => Promise<void>;
  onOpenExternal: () => Promise<void>;
  onExportPDF: () => Promise<void>;
  onTogglePinnedFile: (() => void) | undefined;
  isActiveFilePinned: boolean | undefined;
};

export function EditorToolbar({
  _isMacLike,
  isSidebarCollapsed,
  toggleSidebarShortcut,
  onToggleSidebar,
  canGoBack,
  canGoForward,
  navigateBackShortcut,
  navigateForwardShortcut,
  onNavigateBack,
  onNavigateForward,
  onCreateNote,
  newNoteShortcut,
  fileName,
  shouldShowCommandPalette,
  onOpenCommandPalette,
  commandPaletteShortcut,
  commandPaletteLabel,
  isFocusMode,
  onToggleFocusMode,
  focusModeShortcut,
  shouldShowUpdateActionButton,
  updateButtonVariant,
  isUpdateButtonDisabled,
  updateButtonLabel,
  updateButtonTooltip,
  onUpdateAction,
  headerPaddingClass,
  onOpenSettings,
  headerAccessory,
  content,
  documentLabel,
  revealInFolderLabel,
  onCopy,
  onCopyPath,
  onOpenExternal,
  onExportPDF,
  onTogglePinnedFile,
  isActiveFilePinned,
}: EditorToolbarProps) {
  const handleCopy = useCallback(async () => {
    await onCopy();
  }, [onCopy]);

  const handleCopyPath = useCallback(async () => {
    await onCopyPath();
  }, [onCopyPath]);

  const handleOpenExternal = useCallback(async () => {
    await onOpenExternal();
  }, [onOpenExternal]);

  const handleExportPDF = useCallback(async () => {
    await onExportPDF();
  }, [onExportPDF]);

  const handleTogglePinnedFile = useCallback(() => {
    onTogglePinnedFile?.();
  }, [onTogglePinnedFile]);

  const backTooltipLabel = navigateBackShortcut ? `Back (${navigateBackShortcut})` : "Back";
  const forwardTooltipLabel = navigateForwardShortcut
    ? `Forward (${navigateForwardShortcut})`
    : "Forward";
  const searchButtonLabel = commandPaletteLabel ?? "Search notes";

  return (
    <div className={`flex items-center py-2 border-b border-border/40 gap-2 ${headerPaddingClass}`}>
      {/* Left: toolbar + title */}
      <div className="flex items-center gap-1 flex-shrink-0 min-w-0">
        {onToggleSidebar && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground hover:bg-muted flex-shrink-0"
                onClick={onToggleSidebar}
                aria-label={isSidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
                type="button"
              >
                {isSidebarCollapsed ? <PanelRightIcon size={16} /> : <PanelLeftIcon size={16} />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isSidebarCollapsed
                ? `Show Sidebar${toggleSidebarShortcut ? ` (${toggleSidebarShortcut})` : ""}`
                : `Hide Sidebar${toggleSidebarShortcut ? ` (${toggleSidebarShortcut})` : ""}`}
            </TooltipContent>
          </Tooltip>
        )}
        {onNavigateBack ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={!canGoBack}
                onClick={onNavigateBack}
                className="flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted disabled:text-muted-foreground/40 disabled:opacity-40"
                aria-label="Navigate back"
                type="button"
              >
                <ArrowLeftIcon size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{backTooltipLabel}</TooltipContent>
          </Tooltip>
        ) : null}
        {onNavigateForward ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={!canGoForward}
                onClick={onNavigateForward}
                className="flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted disabled:text-muted-foreground/40 disabled:opacity-40"
                aria-label="Navigate forward"
                type="button"
              >
                <ArrowRightIcon size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{forwardTooltipLabel}</TooltipContent>
          </Tooltip>
        ) : null}
        {fileName ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="max-w-[220px] truncate pl-1 text-sm font-medium text-foreground">
                {fileName.replace(MARKDOWN_FILE_SUFFIX_PATTERN, "")}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">{fileName}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      {/* Center: search bar */}
      {shouldShowCommandPalette && onOpenCommandPalette ? (
        <div className="flex-1 flex justify-center px-2 min-w-0">
          <Button
            variant="outline"
            size="sm"
            className="w-full max-w-sm justify-between px-3 py-1.5 text-sm text-muted-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
            onClick={onOpenCommandPalette}
            type="button"
          >
            <div className="flex items-center gap-2">
              <SearchIcon size={13} className="opacity-60 flex-shrink-0" />
              <span>{searchButtonLabel}</span>
            </div>
            <span className="font-mono text-xs opacity-50 ml-4 flex-shrink-0">
              {commandPaletteShortcut}
            </span>
          </Button>
        </div>
      ) : null}

      {/* Right: actions */}
      <div className="flex items-center gap-1 relative flex-shrink-0">
        {onToggleFocusMode ? (
          <div className="flex items-center gap-0.5 relative after:absolute after:right-0 after:-mr-1.5 after:h-4 after:w-px after:bg-border/50 pr-2.5 mr-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className={`text-muted-foreground transition-colors ${
                    isFocusMode ? "text-foreground" : "hover:text-foreground hover:bg-muted"
                  }`}
                  onClick={onToggleFocusMode}
                  aria-pressed={isFocusMode}
                  aria-label={isFocusMode ? "Exit focus mode" : "Enter focus mode"}
                  type="button"
                >
                  <FocusIcon size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {isFocusMode ? "Exit Focus Mode" : "Enter Focus Mode"}
                {focusModeShortcut ? ` (${focusModeShortcut})` : ""}
              </TooltipContent>
            </Tooltip>
          </div>
        ) : null}
        {shouldShowUpdateActionButton && onUpdateAction ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={updateButtonVariant}
                size="sm"
                className="h-8 shrink-0 rounded-full px-3 text-xs font-semibold shadow-sm"
                onClick={onUpdateAction}
                disabled={isUpdateButtonDisabled}
                type="button"
              >
                {updateButtonLabel}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{updateButtonTooltip}</TooltipContent>
          </Tooltip>
        ) : null}
        {onCreateNote ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 shrink-0 rounded-full px-3 text-xs font-semibold shadow-sm"
                onClick={onCreateNote}
                aria-label="New note"
                type="button"
              >
                <PlusIcon size={14} />
                <span>New Note</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{`New Note${newNoteShortcut ? ` (${newNoteShortcut})` : ""}`}</TooltipContent>
          </Tooltip>
        ) : null}
        {headerAccessory ? <div className="mr-1 flex items-center">{headerAccessory}</div> : null}
        <DropdownMenu>
          <Tooltip>
            <DropdownMenuTrigger
              render={
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-foreground hover:bg-muted"
                      aria-label="More options"
                      type="button"
                    />
                  }
                />
              }
            >
              <DotsHorizontalIcon size={16} />
            </DropdownMenuTrigger>
            <TooltipContent side="bottom">More options</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" side="bottom" sideOffset={4} className="w-48">
            <DropdownMenuItem disabled={!content} onClick={handleCopy}>
              <LinkIcon size={14} className="opacity-70" />
              Copy as Markdown
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!fileName} onClick={handleCopyPath}>
              <LinkIcon size={14} className="opacity-70" />
              {`Copy ${documentLabel} path`}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!fileName} onClick={handleOpenExternal}>
              <FileManagerLogo label={revealInFolderLabel} size={14} className="opacity-70" />
              {revealInFolderLabel}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!fileName} onClick={handleExportPDF}>
              <FileDownIcon size={14} className="opacity-70" />
              Export as PDF
            </DropdownMenuItem>
            {onTogglePinnedFile ? (
              <DropdownMenuItem onClick={handleTogglePinnedFile}>
                {isActiveFilePinned ? (
                  <PinOffIcon size={14} className="opacity-70" />
                ) : (
                  <PinIcon size={14} className="opacity-70" />
                )}
                {isActiveFilePinned ? "Unpin note" : "Pin note"}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
        {onOpenSettings && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={onOpenSettings}
                aria-label="Settings"
                type="button"
              >
                <GearIcon size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Settings</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
