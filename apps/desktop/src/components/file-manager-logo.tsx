import { cn } from "@/lib/utils";

type FileManagerLogoProps = {
  className?: string;
  label?: string | null;
  size?: number;
};

const fileManagerBasePath = `${import.meta.env.BASE_URL}skills`;

function getFileManagerLogoSrc(label?: string | null) {
  if (label?.toLowerCase().includes("explorer")) {
    return `${fileManagerBasePath}/file_explorer.svg`;
  }

  return `${fileManagerBasePath}/finder.svg`;
}

export function FileManagerLogo({ className, label, size = 14 }: FileManagerLogoProps) {
  return (
    <img
      src={getFileManagerLogoSrc(label)}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
