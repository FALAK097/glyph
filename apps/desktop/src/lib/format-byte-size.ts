export function formatByteSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    const kilobytes = bytes / 1024;
    return `${kilobytes >= 10 ? Math.round(kilobytes) : kilobytes.toFixed(1)} KB`;
  }

  const megabytes = bytes / (1024 * 1024);
  return `${megabytes.toFixed(megabytes >= 10 ? 0 : 1)} MB`;
}
