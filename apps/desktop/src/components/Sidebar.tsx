import type { DirectoryNode } from "../shared/workspace";

type SidebarProps = {
  rootPath: string | null;
  tree: DirectoryNode[];
  activePath: string | null;
  recentFiles: string[];
  onOpenFile: (filePath: string) => void;
  onOpenSettings: () => void;
};

function TreeNode({
  node,
  activePath,
  depth,
  onOpenFile
}: {
  node: DirectoryNode;
  activePath: string | null;
  depth: number;
  onOpenFile: (filePath: string) => void;
}) {
  if (node.type === "directory") {
    return (
      <div className="sidebar-node">
        <div className="sidebar-directory" style={{ paddingLeft: `${depth * 14 + 18}px` }}>
          <span className="sidebar-directory-icon">▾</span>
          <span>{node.name}</span>
        </div>
        {node.children.map((child) => (
          <TreeNode
            key={child.path}
            node={child}
            activePath={activePath}
            depth={depth + 1}
            onOpenFile={onOpenFile}
          />
        ))}
      </div>
    );
  }

  return (
    <button
      className={`sidebar-file ${activePath === node.path ? "is-active" : ""}`}
      style={{ paddingLeft: `${depth * 14 + 18}px` }}
      onClick={() => onOpenFile(node.path)}
      type="button"
    >
      <span>{node.name}</span>
    </button>
  );
}

export function Sidebar({ rootPath, tree, activePath, recentFiles, onOpenFile, onOpenSettings }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div>
        <p className="sidebar-eyebrow">Workspace</p>
        <h1>Typist</h1>
        <p className="sidebar-caption">{rootPath ? rootPath.split("/").at(-1) : "Documents / Typist"}</p>
      </div>

      <div className="sidebar-section">
        <p className="sidebar-section-title">Recent</p>
        {recentFiles.length === 0 ? (
          <p className="sidebar-empty">Recently opened notes will appear here.</p>
        ) : (
          recentFiles.map((filePath) => (
            <button key={filePath} className="sidebar-file recent" type="button" onClick={() => onOpenFile(filePath)}>
              <span>{filePath.split("/").at(-1)}</span>
            </button>
          ))
        )}
      </div>

      <div className="sidebar-section sidebar-tree">
        <p className="sidebar-section-title">Notes</p>
        {tree.length === 0 ? (
          <p className="sidebar-empty">Create your first note from the command palette.</p>
        ) : (
          tree.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              activePath={activePath}
              depth={0}
              onOpenFile={onOpenFile}
            />
          ))
        )}
      </div>

      <div className="sidebar-footer">
        <button className="settings-launcher" type="button" onClick={onOpenSettings}>
          Settings
        </button>
      </div>
    </aside>
  );
}
