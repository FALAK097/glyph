import { TrashIcon } from "./icons";
import { Button } from "@/components/ui/button";

type ImageControlsState = {
  left: number;
  top: number;
};

type ImageControlsProps = {
  controls: ImageControlsState | null;
  onDelete: () => void;
};

export function ImageControls({ controls, onDelete }: ImageControlsProps) {
  if (!controls) {
    return null;
  }

  return (
    <div
      className="fixed z-30"
      style={{
        left: controls.left,
        top: controls.top,
      }}
    >
      <Button
        variant="destructive"
        size="icon-xs"
        type="button"
        className="shadow-md"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onDelete}
      >
        <TrashIcon size={12} />
      </Button>
    </div>
  );
}
