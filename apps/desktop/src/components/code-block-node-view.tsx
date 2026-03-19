import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';

import { CopyIcon, TickIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { SUPPORTED_LANGUAGES } from '@/types/code-block-node-view';

export const CodeBlockNodeView = (props: ReactNodeViewProps) => {
  const { node, updateAttributes, editor } = props;
  const codeRef = useRef<HTMLDivElement>(null);
  const copyResetTimeoutRef = useRef<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
    };
  }, []);

  const handleLanguageChange = (e: ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const language = e.target.value;
    updateAttributes({ language });
  };

  const handleCopy = async () => {
    const code = codeRef.current?.innerText ?? node.textContent;

    if (!code.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);

      if (copyResetTimeoutRef.current) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }

      copyResetTimeoutRef.current = window.setTimeout(() => {
        setCopied(false);
        copyResetTimeoutRef.current = null;
      }, 1600);
    } catch (error) {
      console.error('Failed to copy code block:', error);
      setCopied(false);
    }
  };

  const currentLanguage = (node.attrs.language as string | null) || 'plaintext';
  const isEditing = editor.isActive('codeBlock');

  return (
    <NodeViewWrapper
      as="pre"
      className="code-block-shell relative my-3 overflow-hidden rounded-xl border border-border/80 bg-muted/88 pt-12 text-foreground shadow-[0_1px_0_rgba(255,255,255,0.45)_inset] outline-none"
      data-testid="code-block"
    >
      <div className="code-block-toolbar absolute top-2 right-2 left-2 z-20 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleCopy}
          onMouseDown={(e) => e.stopPropagation()}
          className={cn(
            'code-block-copy-button inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-border/70 bg-background/92 px-2 text-muted-foreground shadow-sm transition-[background-color,border-color,color,transform] duration-100 ease-out outline-none hover:border-border hover:bg-background hover:text-foreground focus-visible:border-primary focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-primary/20 active:translate-y-px',
            copied && 'border-primary/50 bg-primary/10 text-primary'
          )}
          aria-label={copied ? 'Code copied' : 'Copy code'}
          title={copied ? 'Copied' : 'Copy code'}
        >
          {copied ? (
            <span className="relative flex h-4 w-5 items-center justify-center" aria-hidden="true">
              <TickIcon size={12} className="absolute left-0 top-1/2 -translate-y-1/2" />
              <TickIcon size={12} className="absolute right-0 top-1/2 -translate-y-1/2" />
            </span>
          ) : (
            <CopyIcon size={15} />
          )}
        </button>
        {isEditing ? (
          <select
            value={currentLanguage}
            onChange={handleLanguageChange}
            onMouseDown={(e) => e.stopPropagation()}
            className="code-block-language-select h-8 min-w-[7.5rem] cursor-pointer appearance-none rounded-md border border-border/70 bg-background/92 px-3 pr-7 text-xs font-semibold tracking-[0.18em] text-foreground uppercase shadow-sm outline-none transition-[border-color,box-shadow,background-color] duration-100 ease-out focus:border-primary focus:ring-2 focus:ring-primary/20"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='currentColor' d='M2.5 4.5L5 7l2.5-2.5'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
              backgroundSize: '10px',
            }}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div ref={codeRef} className="hljs-content">
        <NodeViewContent as="div" className="hljs code-block-surface" />
      </div>
    </NodeViewWrapper>
  );
};
