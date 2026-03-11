type LogoProps = {
  size?: number;
  showText?: boolean;
};

export function Logo({ size = 128, showText = false }: LogoProps) {
  return (
    <div className="logo" style={{ display: "flex", alignItems: "center", gap: "8px", color: "currentColor", fontWeight: 600 }}>
      <svg
        viewBox="0 0 128 128"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        style={{ color: "currentColor" }}
      >
        <rect width="128" height="128" rx="36" fill="currentColor" />
        <path
          d="M38 38H90"
          stroke="var(--background)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M64 38V90"
          stroke="var(--background)"
          strokeWidth="12"
          strokeLinecap="round"
        />
      </svg>
      {showText && <span style={{ fontSize: "0.875rem" }}>Typist</span>}
    </div>
  );
}
