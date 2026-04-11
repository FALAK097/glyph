import { Suspense, lazy } from "react";

const AgentationOverlay = import.meta.env.DEV
  ? lazy(async () => {
      const { Agentation } = await import("agentation");
      return { default: Agentation };
    })
  : null;

export async function bootReactGrab() {
  if (!import.meta.env.DEV) {
    return;
  }

  await import("react-grab");
}

export function DevToolsOverlay() {
  if (!AgentationOverlay) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <AgentationOverlay />
    </Suspense>
  );
}
