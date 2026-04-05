import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleCopy = useCallback(async () => {
    await onCopy();
    setIsMenuOpen(false);
  }, [onCopy]);

  const handleCopyPath = useCallback(async () => {
    await onCopyPath();
    setIsMenuOpen(false);
  }, [onCopyPath]);

  const handleOpenExternal = useCallback(async () => {
    await onOpenExternal();
    setIsMenuOpen(false);
  }, [onOpenExternal]);

  const handleExportPDF = useCallback(async () => {
    await onExportPDF();
    setIsMenuOpen(false);
  }, [onExportPDF]);

  const handleTogglePinnedFile = useCallback(() => {
    onTogglePinnedFile?.();
    setIsMenuOpen(false);
  }, [onTogglePinnedFile]);

  const backTooltipLabel = `Back (${navigateBackShortcut ?? "⌘["})`;
  const forwardTooltipLabel = `Forward (${navigateForwardShortcut ?? "⌘]"})`;
  const searchButtonLabel = commandPaletteLabel ?? "Search notes";
  const MARKDOWN_FILE_SUFFIX_PATTERN = /\.(md|mdx|markdown)$/i;

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
                type="button"
              >
                {isSidebarCollapsed ? <PanelRightIcon size={16} /> : <PanelLeftIcon size={16} />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isSidebarCollapsed
                ? `Show Sidebar (${toggleSidebarShortcut ?? "⌘B"})`
                : `Hide Sidebar (${toggleSidebarShortcut ?? "⌘B"})`}
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
                type="button"
              >
                <ArrowRightIcon size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{forwardTooltipLabel}</TooltipContent>
          </Tooltip>
        ) : null}
        {onCreateNote ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground hover:bg-muted flex-shrink-0"
                onClick={onCreateNote}
                type="button"
              >
                <PlusIcon size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{`New Note (${newNoteShortcut ?? "⌘N"})`}</TooltipContent>
          </Tooltip>
        ) : null}
        {fileName ? (
          <span
            className="max-w-[220px] truncate pl-1 text-sm font-medium text-foreground"
            title={fileName}
          >
            {fileName.replace(MARKDOWN_FILE_SUFFIX_PATTERN, "")}
          </span>
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
              {commandPaletteShortcut ?? "⌘P"}
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
        {headerAccessory ? <div className="mr-1 flex items-center">{headerAccessory}</div> : null}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              type="button"
            >
              <DotsHorizontalIcon size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">More options</TooltipContent>
        </Tooltip>
        {onOpenSettings && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={onOpenSettings}
                type="button"
              >
                <GearIcon size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Settings</TooltipContent>
          </Tooltip>
        )}

        {isMenuOpen && (
          <>
            <button
              aria-label="Close menu"
              className="fixed inset-0 z-40 cursor-default bg-transparent outline-none"
              onClick={() => setIsMenuOpen(false)}
              type="button"
            />
            <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-md shadow-lg z-50 py-1 overflow-hidden">
              <Button
                variant="ghost"
                size="sm"
                className="h-auto w-full justify-start gap-2 rounded-none px-3 py-1.5 text-sm"
                onClick={handleCopy}
                disabled={!content}
                type="button"
              >
                <LinkIcon size={14} className="opacity-70" />
                Copy as Markdown
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto w-full justify-start gap-2 rounded-none px-3 py-1.5 text-sm"
                onClick={handleCopyPath}
                type="button"
              >
                <LinkIcon size={14} className="opacity-70" />
                {`Copy ${documentLabel} path`}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto w-full justify-start gap-2 rounded-none px-3 py-1.5 text-sm"
                onClick={handleOpenExternal}
                type="button"
              >
                <FileManagerLogo label={revealInFolderLabel} size={14} className="opacity-70" />
                {revealInFolderLabel}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto w-full justify-start gap-2 rounded-none px-3 py-1.5 text-sm"
                onClick={handleExportPDF}
                type="button"
              >
                <FileDownIcon size={14} className="opacity-70" />
                Export as PDF
              </Button>
              {onTogglePinnedFile ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto w-full justify-start gap-2 rounded-none px-3 py-1.5 text-sm"
                  onClick={handleTogglePinnedFile}
                  type="button"
                >
                  {isActiveFilePinned ? (
                    <PinOffIcon size={14} className="opacity-70" />
                  ) : (
                    <PinIcon size={14} className="opacity-70" />
                  )}
                  {isActiveFilePinned ? "Unpin note" : "Pin note"}
                </Button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
