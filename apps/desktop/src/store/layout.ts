import { create } from "zustand";

import type {
  LayoutNode,
  PaneNode,
  PaneState,
  SplitDirection,
  SplitNode,
  TabMovePosition,
} from "@/core/workspace";

// ─── Helpers ─────────────────────────────────────────────────────────

let paneCounter = 0;
let splitCounter = 0;

const createPaneId = (): string => `pane-${++paneCounter}`;
const createSplitId = (): string => `split-${++splitCounter}`;

const DEFAULT_PANE_ID = "pane-0";

const createDefaultPaneState = (): PaneState => ({
  tabIds: [],
  activeTabId: null,
});

/**
 * Find the parent split of a given pane ID and which child index it is.
 */
const findParent = (
  node: LayoutNode,
  targetId: string,
): { parent: SplitNode; childIndex: 0 | 1 } | null => {
  if (node.type === "pane") {
    return null;
  }

  for (const idx of [0, 1] as const) {
    const child = node.children[idx];
    if (child.type === "pane" && child.id === targetId) {
      return { parent: node, childIndex: idx };
    }
    if (child.type === "split" && child.id === targetId) {
      return { parent: node, childIndex: idx };
    }
    const found = findParent(child, targetId);
    if (found) {
      return found;
    }
  }

  return null;
};

/**
 * Replace a node in the layout tree by ID. Returns a new tree.
 */
const replaceNode = (root: LayoutNode, targetId: string, replacement: LayoutNode): LayoutNode => {
  if (root.type === "pane") {
    return root.id === targetId ? replacement : root;
  }

  if (root.id === targetId) {
    return replacement;
  }

  return {
    ...root,
    children: [
      replaceNode(root.children[0], targetId, replacement),
      replaceNode(root.children[1], targetId, replacement),
    ],
  };
};

/**
 * Remove a pane from the tree. The sibling takes its parent's place.
 * Returns null if the pane is the root (can't remove the last pane).
 */
const removePaneFromTree = (root: LayoutNode, paneId: string): LayoutNode | null => {
  if (root.type === "pane") {
    return root.id === paneId ? null : root;
  }

  const parentInfo = findParent(root, paneId);
  if (!parentInfo) {
    return root;
  }

  const { parent, childIndex } = parentInfo;
  const siblingIndex = childIndex === 0 ? 1 : 0;
  const sibling = parent.children[siblingIndex];

  // Replace the parent split with the sibling
  return replaceNode(root, parent.id, sibling);
};

/**
 * Get the first pane ID in tree order (depth-first, left-first).
 */
const getFirstPaneId = (node: LayoutNode): string => {
  if (node.type === "pane") {
    return node.id;
  }

  return getFirstPaneId(node.children[0]);
};

/**
 * Collect pane IDs in display order (left-to-right / top-to-bottom).
 */
const collectPaneIdsInOrder = (node: LayoutNode): string[] => {
  if (node.type === "pane") {
    return [node.id];
  }

  return [...collectPaneIdsInOrder(node.children[0]), ...collectPaneIdsInOrder(node.children[1])];
};

const pruneLayoutTree = (node: LayoutNode, validPaneIds: Set<string>): LayoutNode | null => {
  if (node.type === "pane") {
    return validPaneIds.has(node.id) ? node : null;
  }

  const left = pruneLayoutTree(node.children[0], validPaneIds);
  const right = pruneLayoutTree(node.children[1], validPaneIds);
  if (left && right) {
    return { ...node, children: [left, right] };
  }

  return left ?? right;
};

// ─── Store ───────────────────────────────────────────────────────────

type LayoutState = {
  root: LayoutNode;
  activePaneId: string;
  panes: Record<string, PaneState>;

  // ── Queries ──
  getActivePaneState: () => PaneState;
  getPane: (paneId: string) => PaneState;
  getAllTabIds: () => string[];
  getPaneForTab: (tabId: string) => string | null;
  getPaneCount: () => number;
  getOrderedPaneIds: () => string[];

  // ── Layout mutations ──
  splitPane: (direction: SplitDirection, tabIdToCopy?: string | null) => string;
  closePane: (paneId: string) => void;
  setActivePaneId: (paneId: string) => void;
  focusNextPane: () => void;
  focusPreviousPane: () => void;

  // ── Tab-in-pane mutations ──
  addTabToPane: (paneId: string, tabId: string) => void;
  removeTabFromPane: (paneId: string, tabId: string) => string | null;
  activateTabInPane: (paneId: string, tabId: string) => void;
  reorderTabInPane: (
    paneId: string,
    sourceTabId: string,
    targetTabId: string,
    position: TabMovePosition,
  ) => void;
  moveTabToPane: (
    tabId: string,
    fromPaneId: string,
    toPaneId: string,
    targetTabId?: string | null,
    position?: TabMovePosition,
  ) => void;
  replaceTabId: (oldTabId: string, newTabId: string) => void;
  removeTabFromAllPanes: (tabId: string) => void;

  // ── Bulk initialisation (boot / session restore) ──
  initializePane: (tabIds: string[], activeTabId: string | null) => void;
  restoreLayout: (root: LayoutNode, activePaneId: string, panes: Record<string, PaneState>) => void;
  resetLayout: () => void;
};

export const useLayoutStore = create<LayoutState>((set, get) => ({
  root: { type: "pane", id: DEFAULT_PANE_ID } as LayoutNode,
  activePaneId: DEFAULT_PANE_ID,
  panes: { [DEFAULT_PANE_ID]: createDefaultPaneState() },

  // ── Queries ────────────────────────────────────────────────────────

  getActivePaneState: () => {
    const state = get();
    return state.panes[state.activePaneId] ?? createDefaultPaneState();
  },

  getPane: (paneId) => {
    return get().panes[paneId] ?? createDefaultPaneState();
  },

  getAllTabIds: () => {
    const seen = new Set<string>();
    for (const pane of Object.values(get().panes)) {
      for (const tabId of pane.tabIds) {
        seen.add(tabId);
      }
    }
    return [...seen];
  },

  getPaneForTab: (tabId) => {
    for (const [paneId, pane] of Object.entries(get().panes)) {
      if (pane.tabIds.includes(tabId)) {
        return paneId;
      }
    }
    return null;
  },

  getPaneCount: () => Object.keys(get().panes).length,

  getOrderedPaneIds: () => collectPaneIdsInOrder(get().root),

  // ── Layout mutations ───────────────────────────────────────────────

  splitPane: (direction, tabIdToCopy) => {
    const state = get();
    const sourcePaneId = state.activePaneId;
    const sourcePane = state.panes[sourcePaneId];
    if (!sourcePane) {
      return sourcePaneId;
    }

    const newPaneId = createPaneId();
    const splitId = createSplitId();

    // The new pane gets a copy of the active tab (or specified tab)
    const tabToCopy = tabIdToCopy ?? sourcePane.activeTabId;
    const newPaneState: PaneState = {
      tabIds: tabToCopy ? [tabToCopy] : [],
      activeTabId: tabToCopy ?? null,
    };

    // Wrap the source pane and new pane in a split
    const sourcePaneNode: PaneNode = { type: "pane", id: sourcePaneId };
    const newPaneNode: PaneNode = { type: "pane", id: newPaneId };
    const splitNode: SplitNode = {
      type: "split",
      id: splitId,
      direction,
      children: [sourcePaneNode, newPaneNode],
    };

    const nextRoot = replaceNode(state.root, sourcePaneId, splitNode);

    set({
      root: nextRoot,
      activePaneId: newPaneId,
      panes: {
        ...state.panes,
        [newPaneId]: newPaneState,
      },
    });

    return newPaneId;
  },

  closePane: (paneId) => {
    set((state) => {
      const paneIds = Object.keys(state.panes);

      // Can't close the last pane
      if (paneIds.length <= 1) {
        return state;
      }

      const nextRoot = removePaneFromTree(state.root, paneId);
      if (!nextRoot) {
        return state;
      }

      const { [paneId]: _removed, ...remainingPanes } = state.panes;
      const nextActivePaneId =
        state.activePaneId === paneId ? getFirstPaneId(nextRoot) : state.activePaneId;

      return {
        root: nextRoot,
        panes: remainingPanes,
        activePaneId: nextActivePaneId,
      };
    });
  },

  setActivePaneId: (paneId) => {
    set((state) => {
      if (state.panes[paneId]) {
        return { activePaneId: paneId };
      }
      return state;
    });
  },

  focusNextPane: () => {
    set((state) => {
      const ordered = collectPaneIdsInOrder(state.root);
      const currentIndex = ordered.indexOf(state.activePaneId);
      const nextIndex = (currentIndex + 1) % ordered.length;
      return { activePaneId: ordered[nextIndex] };
    });
  },

  focusPreviousPane: () => {
    set((state) => {
      const ordered = collectPaneIdsInOrder(state.root);
      const currentIndex = ordered.indexOf(state.activePaneId);
      const prevIndex = (currentIndex - 1 + ordered.length) % ordered.length;
      return { activePaneId: ordered[prevIndex] };
    });
  },

  // ── Tab-in-pane mutations ──────────────────────────────────────────

  addTabToPane: (paneId, tabId) => {
    set((state) => {
      const pane = state.panes[paneId];
      if (!pane) {
        return state;
      }

      // Don't add duplicates
      if (pane.tabIds.includes(tabId)) {
        return {
          panes: {
            ...state.panes,
            [paneId]: { ...pane, activeTabId: tabId },
          },
        };
      }

      return {
        panes: {
          ...state.panes,
          [paneId]: {
            tabIds: [...pane.tabIds, tabId],
            activeTabId: tabId,
          },
        },
      };
    });
  },

  removeTabFromPane: (paneId, tabId) => {
    const pane = get().panes[paneId];
    if (!pane) {
      return null;
    }

    const tabIndex = pane.tabIds.indexOf(tabId);
    if (tabIndex < 0) {
      return pane.activeTabId;
    }

    const nextTabIds = pane.tabIds.filter((id) => id !== tabId);
    const nextActiveTabId =
      pane.activeTabId === tabId
        ? (pane.tabIds[tabIndex - 1] ?? pane.tabIds[tabIndex + 1] ?? null)
        : pane.activeTabId;

    set((state) => ({
      panes: {
        ...state.panes,
        [paneId]: {
          tabIds: nextTabIds,
          activeTabId: nextActiveTabId,
        },
      },
    }));

    return nextActiveTabId;
  },

  activateTabInPane: (paneId, tabId) => {
    set((state) => {
      const pane = state.panes[paneId];
      if (!pane || !pane.tabIds.includes(tabId)) {
        return state;
      }

      return {
        panes: {
          ...state.panes,
          [paneId]: { ...pane, activeTabId: tabId },
        },
      };
    });
  },

  reorderTabInPane: (paneId, sourceTabId, targetTabId, position) => {
    set((state) => {
      const pane = state.panes[paneId];
      if (!pane) {
        return state;
      }

      const sourceIndex = pane.tabIds.indexOf(sourceTabId);
      const targetIndex = pane.tabIds.indexOf(targetTabId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
        return state;
      }

      const remaining = pane.tabIds.filter((id) => id !== sourceTabId);
      const newTargetIndex = remaining.indexOf(targetTabId);
      if (newTargetIndex < 0) {
        return state;
      }

      const insertAt = position === "before" ? newTargetIndex : newTargetIndex + 1;
      const nextTabIds = [
        ...remaining.slice(0, insertAt),
        sourceTabId,
        ...remaining.slice(insertAt),
      ];

      return {
        panes: {
          ...state.panes,
          [paneId]: { ...pane, tabIds: nextTabIds },
        },
      };
    });
  },

  moveTabToPane: (tabId, fromPaneId, toPaneId, targetTabId, position = "after") => {
    set((state) => {
      const fromPane = state.panes[fromPaneId];
      const toPane = state.panes[toPaneId];
      if (!fromPane || !toPane) {
        return state;
      }

      // Remove from source pane
      const nextFromTabIds = fromPane.tabIds.filter((id) => id !== tabId);
      let nextFromActiveTabId = fromPane.activeTabId;
      if (fromPane.activeTabId === tabId) {
        const idx = fromPane.tabIds.indexOf(tabId);
        nextFromActiveTabId = fromPane.tabIds[idx - 1] ?? fromPane.tabIds[idx + 1] ?? null;
      }

      const targetIdsWithoutTab = toPane.tabIds.filter((id) => id !== tabId);
      const targetIndex = targetTabId ? targetIdsWithoutTab.indexOf(targetTabId) : -1;
      const insertAt =
        targetIndex < 0
          ? targetIdsWithoutTab.length
          : position === "before"
            ? targetIndex
            : targetIndex + 1;
      const nextToTabIds = [
        ...targetIdsWithoutTab.slice(0, insertAt),
        tabId,
        ...targetIdsWithoutTab.slice(insertAt),
      ];

      if (nextFromTabIds.length === 0 && Object.keys(state.panes).length > 1) {
        const nextRoot = removePaneFromTree(state.root, fromPaneId);
        if (!nextRoot) {
          return state;
        }

        const { [fromPaneId]: _removed, ...remainingPanes } = state.panes;
        return {
          root: nextRoot,
          panes: {
            ...remainingPanes,
            [toPaneId]: { tabIds: nextToTabIds, activeTabId: tabId },
          },
          activePaneId: toPaneId,
        };
      }

      return {
        panes: {
          ...state.panes,
          [fromPaneId]: { tabIds: nextFromTabIds, activeTabId: nextFromActiveTabId },
          [toPaneId]: { tabIds: nextToTabIds, activeTabId: tabId },
        },
        activePaneId: toPaneId,
      };
    });
  },

  // ── Cross-pane tab mutations ───────────────────────────────────────

  replaceTabId: (oldTabId, newTabId) => {
    if (oldTabId === newTabId) return;
    set((state) => {
      let changed = false;
      const nextPanes: Record<string, PaneState> = {};
      for (const [paneId, pane] of Object.entries(state.panes)) {
        const hasOld = pane.tabIds.includes(oldTabId) || pane.activeTabId === oldTabId;
        if (!hasOld) {
          nextPanes[paneId] = pane;
          continue;
        }
        changed = true;
        nextPanes[paneId] = {
          tabIds: pane.tabIds.map((id) => (id === oldTabId ? newTabId : id)),
          activeTabId: pane.activeTabId === oldTabId ? newTabId : pane.activeTabId,
        };
      }
      return changed ? { panes: nextPanes } : state;
    });
  },

  removeTabFromAllPanes: (tabId) => {
    set((state) => {
      const nextPanes: Record<string, PaneState> = {};
      let changed = false;
      for (const [paneId, pane] of Object.entries(state.panes)) {
        if (!pane.tabIds.includes(tabId)) {
          nextPanes[paneId] = pane;
          continue;
        }
        changed = true;
        const nextTabIds = pane.tabIds.filter((id) => id !== tabId);
        let nextActiveTabId = pane.activeTabId;
        if (pane.activeTabId === tabId) {
          const idx = pane.tabIds.indexOf(tabId);
          nextActiveTabId = pane.tabIds[idx - 1] ?? pane.tabIds[idx + 1] ?? null;
        }
        nextPanes[paneId] = {
          tabIds: nextTabIds,
          activeTabId: nextActiveTabId,
        };
      }
      return changed ? { panes: nextPanes } : state;
    });
  },

  // ── Bulk initialisation ────────────────────────────────────────────

  initializePane: (tabIds, activeTabId) => {
    set((state) => ({
      panes: {
        ...state.panes,
        [state.activePaneId]: {
          tabIds,
          activeTabId,
        },
      },
    }));
  },

  restoreLayout: (root, activePaneId, panes) => {
    const validPaneIds = new Set(Object.keys(panes));
    const prunedRoot = pruneLayoutTree(root, validPaneIds);
    if (!prunedRoot) {
      get().resetLayout();
      return;
    }

    const restoredPaneIds = new Set(collectPaneIdsInOrder(prunedRoot));
    const restoredPanes = Object.fromEntries(
      Object.entries(panes).filter(([paneId]) => restoredPaneIds.has(paneId)),
    );

    // Reset counters to avoid ID collisions with restored IDs
    const maxPaneNum = Object.keys(restoredPanes).reduce((max, id) => {
      const match = id.match(/^pane-(\d+)$/);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    paneCounter = maxPaneNum;

    const countSplits = (node: LayoutNode): number => {
      if (node.type === "pane") return 0;
      const match = node.id.match(/^split-(\d+)$/);
      const num = match ? Number(match[1]) : 0;
      return Math.max(num, countSplits(node.children[0]), countSplits(node.children[1]));
    };
    splitCounter = countSplits(prunedRoot);

    // Validate activePaneId exists in the restored tree and pane map
    const validActivePaneId = restoredPanes[activePaneId]
      ? activePaneId
      : getFirstPaneId(prunedRoot);

    set({
      root: prunedRoot,
      activePaneId: validActivePaneId,
      panes: restoredPanes,
    });
  },

  resetLayout: () => {
    paneCounter = 0;
    splitCounter = 0;
    set({
      root: { type: "pane", id: DEFAULT_PANE_ID },
      activePaneId: DEFAULT_PANE_ID,
      panes: { [DEFAULT_PANE_ID]: createDefaultPaneState() },
    });
  },
}));
