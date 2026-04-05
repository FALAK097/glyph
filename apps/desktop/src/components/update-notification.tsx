import { useMemo } from "react";

import type { UpdateState } from "@/shared/workspace";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

type UpdateNotificationProps = {
  updateState: UpdateState | null;
  onUpdateAction: (() => void) | undefined;
};

export function UpdateNotification({ updateState, onUpdateAction }: UpdateNotificationProps) {
  const shouldShowUpdateButton =
    updateState?.status === "error" ||
    updateState?.status === "available" ||
    updateState?.status === "downloading" ||
    updateState?.status === "downloaded";

  const shouldShowChangelogButton =
    (updateState?.status === "idle" || updateState?.status === "not-available") &&
    Boolean(updateState?.recentlyInstalledVersion);

  const shouldShowUpdateActionButton = shouldShowUpdateButton || shouldShowChangelogButton;

  const isManualReleaseButton =
    updateState?.status === "available" && Boolean(updateState?.releasePageUrl);

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
          : updateState?.errorMessage
            ? `Glyph hit an update error. ${updateState.errorMessage}`
            : "Glyph is downloading the latest release in the background";

  const isUpdateButtonDisabled = updateState?.status === "downloading";
  const updateButtonVariant =
    shouldShowChangelogButton || isManualReleaseButton ? "outline" : "default";

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

export function useUpdateStateFlags(updateState: UpdateState | null) {
  return useMemo((): {
    shouldShowUpdateActionButton: boolean;
    updateButtonLabel: string;
    updateButtonTooltip: string;
    isUpdateButtonDisabled: boolean | undefined;
    updateButtonVariant: "default" | "outline";
  } => {
    const shouldShowUpdateButton =
      updateState?.status === "error" ||
      updateState?.status === "available" ||
      updateState?.status === "downloading" ||
      updateState?.status === "downloaded";

    const shouldShowChangelogButton =
      (updateState?.status === "idle" || updateState?.status === "not-available") &&
      Boolean(updateState?.recentlyInstalledVersion);

    const shouldShowUpdateActionButton = shouldShowUpdateButton || shouldShowChangelogButton;
    const isManualReleaseButton =
      updateState?.status === "available" && Boolean(updateState?.releasePageUrl);

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
            : updateState?.errorMessage
              ? `Glyph hit an update error. ${updateState.errorMessage}`
              : "Glyph is downloading the latest release in the background";

    const isUpdateButtonDisabled = updateState?.status === "downloading";
    const updateButtonVariant =
      shouldShowChangelogButton || isManualReleaseButton ? "outline" : "default";

    return {
      shouldShowUpdateActionButton,
      updateButtonLabel,
      updateButtonTooltip,
      isUpdateButtonDisabled,
      updateButtonVariant,
    };
  }, [updateState]);
}
