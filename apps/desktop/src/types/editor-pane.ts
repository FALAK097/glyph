export type ToolbarAction = {
  label: string;
  insert: (selected: string) => string;
};

export type EditorPaneProps = {
  content: string;
  path: string | null;
  isDirty: boolean;
  isSaving: boolean;
  saveStateLabel: string;
  onChange: (value: string) => void;
  onSave: () => void;
};
