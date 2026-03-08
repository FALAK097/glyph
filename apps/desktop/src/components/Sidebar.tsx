import { useState } from "react";
import type { DirectoryNode } from "../shared/workspace";

function getBaseName(targetPath: string | null) {
  if (!targetPath) {
    return null;
  }

  return targetPath.split(/[\\/]/).at(-1) ?? targetPath;
}

type SidebarProps = {
  rootPath: string | null;
  tree: DirectoryNode[];
  activePath: string | null;
  recentFiles: string[];
  noteCount: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenFile: (filePath: string) => void;
  onCreateNote: () => void;
  onOpenPalette: () => void;
  onOpenSettings: () => void;
  onDeleteFile: (filePath: string) => void;
  onRenameFile: (filePath: string, newName: string) => void;
};

function TreeNode({
  node,
  activePath,
  depth,
  onOpenFile,
  onDeleteFile,
  onRenameFile
}: {
  node: DirectoryNode;
  activePath: string | null;
  depth: number;
  onOpenFile: (filePath: string) => void;
  onDeleteFile: (filePath: string) => void;
  onRenameFile: (filePath: string, newName: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showMenu, setShowMenu] = useState(false);

  if (node.type === "directory") {
    return (
      <div className="sidebar-node">
        <button
          className="sidebar-directory flex items-center gap-2 w-full text-left hover:bg-sidebar-accent rounded-md transition-colors"
          style={{ paddingLeft: `${depth * 14 + 18}px`, paddingRight: '8px', paddingTop: '6px', paddingBottom: '6px' }}
          onClick={() => setIsExpanded(!isExpanded)}
          type="button"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="12" 
            height="12" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className={`text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
          <span className="font-medium text-foreground truncate">{node.name}</span>
        </button>
        {isExpanded && node.children.map((child) => (
          <TreeNode
            key={child.path}
            node={child}
            activePath={activePath}
            depth={depth + 1}
            onOpenFile={onOpenFile}
            onDeleteFile={onDeleteFile}
            onRenameFile={onRenameFile}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="group relative flex items-center">
      <button
        className={`sidebar-file flex-1 text-left ${activePath === node.path ? "is-active bg-sidebar-accent text-sidebar-accent-foreground" : ""}`}
        style={{ paddingLeft: `${depth * 14 + 18}px`, paddingRight: '28px', paddingTop: '4px', paddingBottom: '4px' }}
        onClick={() => onOpenFile(node.path)}
        type="button"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground mr-2 flex-shrink-0"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span className="truncate text-sm">{node.name}</span>
      </button>
      <div className="absolute right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
        <div className="relative">
          <button 
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            title="Options"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-md shadow-lg py-1 z-50 min-w-[120px]">
              <button
                className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent"
                onClick={(e) => {
                  e.stopPropagation();
                  const newName = prompt("Enter new name:", node.name);
                  if (newName && newName !== node.name) {
                    onRenameFile(node.path, newName);
                  }
                  setShowMenu(false);
                }}
              >
                Rename
              </button>
              <button
                className="w-full px-3 py-1.5 text-sm text-left text-red-500 hover:bg-accent"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteFile(node.path);
                  setShowMenu(false);
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Sidebar({
  rootPath,
  tree,
  activePath,
  recentFiles,
  noteCount,
  isCollapsed,
  onToggleCollapse,
  onOpenFile,
  onCreateNote,
  onOpenPalette,
  onOpenSettings,
  onDeleteFile,
  onRenameFile
}: SidebarProps) {
  const workspaceName = getBaseName(rootPath) ?? "Documents / Typist";

  if (isCollapsed) {
    return (
      <aside className="flex flex-col h-full w-14 bg-sidebar border-r border-border items-center py-4">
        <button 
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          onClick={onToggleCollapse}
          title="Expand Sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
        </button>
        <button 
          className="p-2 mt-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          onClick={onCreateNote}
          title="New Note"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
        </button>
        <button 
          className="p-2 mt-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          onClick={onOpenSettings}
          title="Settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </aside>
    );
  }

  return (
    <aside className="sidebar flex flex-col h-full w-[280px] bg-sidebar border-r border-border">
      <div className="flex items-center justify-end px-4 h-14 border-b border-border">
        <div className="flex items-center gap-1">
          <div className="flex items-center mr-1">
            <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors opacity-50" title="Back">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors opacity-50" title="Forward">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
          <button 
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors" 
            onClick={onCreateNote}
            title="New Note (⌘N)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="sidebar-section sidebar-tree">
          <p className="sidebar-section-title px-2 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes</p>
          {recentFiles.length > 0 && (
            <div className="mb-3">
              {recentFiles.map((filePath) => (
                <button 
                  key={filePath} 
                  className={`sidebar-file recent w-full text-left ${activePath === filePath ? "is-active bg-sidebar-accent text-sidebar-accent-foreground" : ""}`} 
                  style={{ paddingLeft: '18px', paddingRight: '8px', paddingTop: '4px', paddingBottom: '4px' }} 
                  type="button" 
                  onClick={() => onOpenFile(filePath)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground mr-2 flex-shrink-0"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <span className="truncate text-sm">{getBaseName(filePath)}</span>
                </button>
              ))}
            </div>
          )}
          {tree.length === 0 && recentFiles.length === 0 ? (
            <p className="sidebar-empty text-sm text-muted-foreground px-2">Create your first note from the command palette.</p>
          ) : (
            tree.map((node) => (
              <TreeNode
                key={node.path}
                node={node}
                activePath={activePath}
                depth={0}
                onOpenFile={onOpenFile}
                onDeleteFile={onDeleteFile}
                onRenameFile={onRenameFile}
              />
            ))
          )}
        </div>
      </div>

      <div className="p-3 border-t border-border">
        <button 
          className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-md transition-colors" 
          type="button" 
          onClick={onOpenSettings}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          Settings
        </button>
      </div>
    </aside>
  );
}
