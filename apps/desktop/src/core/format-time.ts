export function formatSaveTime(timestamp: number | null | undefined): string {
  if (!timestamp) {
    return "Ready";
  }

  return `Saved ${new Date(timestamp).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}
