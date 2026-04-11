export const DOWNLOAD_URLS = {
  mac: "https://github.com/FALAK097/glyph/releases/latest/download/Glyph-mac.dmg",
  windows: "https://github.com/FALAK097/glyph/releases/latest/download/Glyph-windows.exe",
  changelog: "/changelog/",
  github: "https://github.com/FALAK097/glyph",
} as const;

export const BREW_INSTALL_COMMAND = "brew install --cask FALAK097/glyph/glyph";

export function AppleIcon() {
  return (
    <svg
      viewBox="0 0 384 512"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      height="18"
      width="18"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 56-12 69.5-34.3z" />
    </svg>
  );
}

export function WindowsIcon() {
  return (
    <svg
      viewBox="0 0 88 88"
      xmlns="http://www.w3.org/2000/svg"
      height="18"
      width="18"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="m0 12.402 35.687-4.86.016 34.423-35.67.203zm35.67 33.529.028 34.453L.028 75.48.026 45.7zm4.326-39.025L87.314 0v41.527l-47.318.376zm47.329 39.349-.011 41.34-47.318-6.678-.066-34.739z"
        fill="currentColor"
      />
    </svg>
  );
}
