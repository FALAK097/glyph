import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

type FrontmatterBlockProps = {
  value: string;
  isEditable: boolean;
  onChange: (value: string) => void;
};

export function FrontmatterBlock({ value, isEditable, onChange }: FrontmatterBlockProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isFocusedRef = useRef(false);
  const [draftValue, setDraftValue] = useState(value);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setDraftValue(value);
    }
  }, [value]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [draftValue]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const nextValue = event.target.value;
      setDraftValue(nextValue);
      onChange(nextValue);
    },
    [onChange],
  );

  const handleFocus = useCallback(() => {
    isFocusedRef.current = true;
  }, []);

  const handleBlur = useCallback(() => {
    isFocusedRef.current = false;
    setDraftValue(value);
  }, [value]);

  return (
    <div className="border-b border-border/55 pt-1 pb-5">
      <div className="px-0 py-1">
        {isEditable ? (
          <textarea
            ref={textareaRef}
            aria-label="Document frontmatter"
            className="block min-h-0 w-full resize-none overflow-hidden border-0 bg-transparent p-0 font-mono text-[13px] leading-6 text-muted-foreground outline-none placeholder:text-muted-foreground/40"
            spellCheck={false}
            rows={1}
            value={draftValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        ) : (
          <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-6 text-muted-foreground">
            {draftValue}
          </pre>
        )}
      </div>
    </div>
  );
}
