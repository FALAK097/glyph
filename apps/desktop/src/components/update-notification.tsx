import { useMemo } from "react";

import type { AppInfo, UpdateState } from "@/core/workspace";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

type UpdateNotificationProps = {
  updateState: UpdateState | null;
  updatesMode?: AppInfo["updatesMode"];
  onUpdateAction: (() => void) | undefined;
  dismissedUpdateVersion?: string | null;
  onDismissUpdateAction?: (() => void) | undefined;
};

export function useUpdateStateFlags(
  updateState: UpdateState | null,
  updatesMode?: AppInfo["updatesMode"],
  dismissedUpdateVersion?: string | null,
) {
  return useMemo((): {
    shouldShowUpdateActionButton: boolean;
    updateButtonLabel: string;
    updateButtonTooltip: string;
    isUpdateButtonDisabled: boolean | undefined;
    updateButtonVariant: "default" | "outline";
    isManualReleaseButton: boolean;
  } => {
    const shouldShowUpdateButton =
      updateState?.status === "error" ||
      updateState?.status === "available" ||
      updateState?.status === "downloading" ||
      updateState?.status === "downloaded";

    const shouldShowChangelogButton =
      (updateState?.status === "idle" || updateState?.status === "not-available") &&
      Boolean(updateState?.recentlyInstalledVersion);

    const isManualReleaseButton =
      updatesMode === "manual" &&
      (updateState?.status === "available" ||
        updateState?.status === "downloading" ||
        updateState?.status === "downloaded");

    const isDismissed = Boolean(
      isManualReleaseButton &&
      updateState?.availableVersion &&
      updateState.availableVersion === dismissedUpdateVersion,
    );

    const shouldShowUpdateActionButton =
      !isDismissed && (shouldShowUpdateButton || shouldShowChangelogButton);

    const updateButtonLabel = shouldShowChangelogButton
      ? "View changelog"
      : isManualReleaseButton
        ? "Download latest release"
        : updateState?.status === "downloaded"
          ? "Restart to Update"
          : updateState?.status === "downloading"
            ? `Downloading ${Math.round(updateState.progressPercent ?? 0)}%`
            : updateState?.errorMessage
              ? "Retry update"
              : "Update available";

    const updateButtonTooltip = shouldShowChangelogButton
      ? `See what's new in Glyph ${updateState?.recentlyInstalledVersion ?? ""}`.trim()
      : isManualReleaseButton
        ? "A newer Glyph release is available on GitHub. Download and install it manually."
        : updateState?.status === "downloaded"
          ? updateState.errorMessage
            ? `Restart Glyph to retry the update. ${updateState.errorMessage}`
            : "Restart Glyph to install the downloaded release"
          : updateState?.status === "downloading"
            ? "Glyph is downloading the latest release in the background"
            : updateState?.status === "available"
              ? updateState.errorMessage
                ? `Glyph hit an update error. ${updateState.errorMessage}`
                : "A new Glyph update is available to download"
              : updateState?.errorMessage
                ? `Glyph hit an update error. ${updateState.errorMessage}`
                : "Check whether a newer Glyph release is available";

    const isUpdateButtonDisabled = isManualReleaseButton
      ? false
      : updateState?.status === "downloading";
    const updateButtonVariant =
      shouldShowChangelogButton || isManualReleaseButton ? "outline" : "default";

    return {
      shouldShowUpdateActionButton,
      updateButtonLabel,
      updateButtonTooltip,
      isUpdateButtonDisabled,
      updateButtonVariant,
      isManualReleaseButton,
    };
  }, [updateState, updatesMode, dismissedUpdateVersion]);
}

export function UpdateNotification({
  updateState,
  updatesMode,
  onUpdateAction,
  dismissedUpdateVersion,
}: UpdateNotificationProps) {
  const {
    shouldShowUpdateActionButton,
    updateButtonLabel,
    updateButtonTooltip,
    isUpdateButtonDisabled,
    updateButtonVariant,
  } = useUpdateStateFlags(updateState, updatesMode, dismissedUpdateVersion);

  if (!shouldShowUpdateActionButton || !onUpdateAction) {
    return null;
  }

  return (
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
  );
}
