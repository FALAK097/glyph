import { useEffect, useRef, useState } from "react";
import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";

import { CopyIcon, TickIcon } from "@/components/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SUPPORTED_LANGUAGES } from "@/types/code-block-node-view";

const LANGUAGE_LABELS: Record<(typeof SUPPORTED_LANGUAGES)[number], string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  html: "HTML",
  css: "CSS",
  plaintext: "Plain Text",
  bash: "Bash",
  dockerfile: "Dockerfile",
  json: "JSON",
  yaml: "YAML",
  sql: "SQL",
  go: "Go",
  rust: "Rust",
  markdown: "Markdown",
};

export const CodeBlockNodeView = (props: ReactNodeViewProps) => {
  const { node, updateAttributes, editor } = props;
  const codeRef = useRef<HTMLDivElement>(null);
  const copyResetTimeoutRef = useRef<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
    };
  }, []);

  const handleLanguageChange = (language: string) => {
    updateAttributes({ language });
    setIsLanguageMenuOpen(false);
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
      console.error("Failed to copy code block:", error);
      setCopied(false);
    }
  };

  const currentLanguage = (node.attrs.language as string | null) || "plaintext";
  const isEditing = editor.isActive("codeBlock");

  return (
    <NodeViewWrapper
      as="pre"
      className="code-block-shell relative my-3 overflow-hidden rounded-xl border border-border/80 bg-muted/88 pt-14 text-foreground shadow-[0_1px_0_rgba(255,255,255,0.45)_inset] outline-none"
      data-testid="code-block"
    >
      <div className="code-block-toolbar absolute top-2 right-2 left-2 z-20 flex items-center justify-end gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleCopy}
              onMouseDown={(e) => e.stopPropagation()}
              className={cn(
                "code-block-copy-button inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-border/70 bg-background/92 px-2 text-muted-foreground shadow-sm transition-[background-color,border-color,color,transform] duration-100 ease-out outline-none hover:border-border hover:bg-background hover:text-foreground focus-visible:border-primary focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-primary/20 active:translate-y-px",
                copied && "border-primary/50 bg-primary/10 text-primary",
              )}
              aria-label={copied ? "Code copied" : "Copy code"}
            >
              {copied ? (
                <span
                  className="relative flex h-4 w-5 items-center justify-center"
                  aria-hidden="true"
                >
                  <TickIcon size={12} className="absolute left-0 top-1/2 -translate-y-1/2" />
                  <TickIcon size={12} className="absolute right-0 top-1/2 -translate-y-1/2" />
                </span>
              ) : (
                <CopyIcon size={15} />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{copied ? "Copied" : "Copy code"}</TooltipContent>
        </Tooltip>
        <div className="min-w-0">
          {isEditing ? (
            <DropdownMenu
              modal={false}
              open={isLanguageMenuOpen}
              onOpenChange={setIsLanguageMenuOpen}
            >
              <DropdownMenuTrigger
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                className="inline-flex h-8 max-w-full items-center gap-2 rounded-md border border-border/70 bg-background/92 px-3 text-[11px] font-semibold tracking-[0.16em] text-foreground uppercase shadow-sm outline-none transition-[background-color,border-color,color,transform] duration-100 ease-out hover:cursor-pointer hover:border-border hover:bg-background focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 active:translate-y-px"
                aria-label="Select code language"
              >
                <span className="truncate">
                  {LANGUAGE_LABELS[currentLanguage as keyof typeof LANGUAGE_LABELS] ??
                    currentLanguage}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                side="bottom"
                sideOffset={8}
                className="w-56 rounded-xl border border-border/70 bg-card/95 p-1.5 shadow-xl supports-backdrop-filter:backdrop-blur-xl"
                onMouseDown={(event) => {
                  event.stopPropagation();
                }}
              >
                <DropdownMenuRadioGroup
                  value={currentLanguage}
                  onValueChange={handleLanguageChange}
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <DropdownMenuRadioItem
                      key={lang}
                      value={lang}
                      className="cursor-pointer rounded-lg px-3 py-2 text-sm text-foreground data-[highlighted]:bg-accent/70"
                    >
                      {LANGUAGE_LABELS[lang]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      <div ref={codeRef} className="hljs-content">
        <NodeViewContent as="div" className="hljs code-block-surface" />
      </div>
    </NodeViewWrapper>
  );
};
