import type { LogoProps } from "../types/logo";
import { GlyphLogoMark } from "./icons";

export const Logo = ({ size = 128 }: LogoProps) => {
  return (
    <div className="flex items-center gap-2.5 font-semibold text-current">
      <GlyphLogoMark size={size} className="text-current" />
    </div>
  );
};
