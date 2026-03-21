import type { LogoProps } from "../types/logo";

const logoWordmarkDarkSrc = `${import.meta.env.BASE_URL}logo-wordmark-dark.png`;
const logoWordmarkLightSrc = `${import.meta.env.BASE_URL}logo-wordmark-light.png`;

export const LogoComponent = ({ size = 128 }: LogoProps) => {
  return (
    <div className="flex items-center" aria-label="Glyph">
      <img
        src={logoWordmarkDarkSrc}
        alt="Glyph"
        width={size}
        height={Math.round(size * 0.62)}
        className="block dark:hidden"
      />
      <img
        src={logoWordmarkLightSrc}
        alt="Glyph"
        width={size}
        height={Math.round(size * 0.62)}
        className="hidden dark:block"
      />
    </div>
  );
};
