import { useEffect, useRef } from "react";
import { Editor } from "@toast-ui/react-editor";

type MarkdownEditorProps = {
  content: string;
  fileName: string | null;
  saveStateLabel: string;
  onChange: (value: string) => void;
};

export function MarkdownEditor({ content, fileName, saveStateLabel, onChange }: MarkdownEditorProps) {
  const editorRef = useRef<Editor>(null);

  useEffect(() => {
    const instance = editorRef.current?.getInstance();

    if (!instance) {
      return;
    }

    if (instance.getMarkdown() !== content) {
      instance.setMarkdown(content, false);
    }
  }, [content]);

  return (
    <section className="editor-shell">
      <div className="editor-topbar">
        <div>
          <p className="panel-label">Note</p>
          <h1>{fileName ?? "Untitled"}</h1>
        </div>
        <p className="editor-status">{saveStateLabel}</p>
      </div>
      <div className="editor-canvas">
        <Editor
          ref={editorRef}
          initialValue={content}
          initialEditType="wysiwyg"
          hideModeSwitch
          toolbarItems={[]}
          usageStatistics={false}
          height="100%"
          onChange={() => {
            const value = editorRef.current?.getInstance().getMarkdown() ?? "";
            onChange(value);
          }}
        />
      </div>
    </section>
  );
}
