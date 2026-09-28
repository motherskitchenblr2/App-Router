import { memo, useState, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

function CodeBlock({ className, children, ...props }: ComponentPropsWithoutRef<"code">) {
  const [copied, setCopied] = useState(false);
  const text = String(children ?? "").replace(/\n$/, "");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const isBlock = /language-/.test(className ?? "") || text.includes("\n");

  if (!isBlock) {
    return (
      <code
        className="rounded bg-surface px-1.5 py-0.5 font-mono text-[0.85em] text-ink hairline"
        {...props}
      >
        {children}
      </code>
    );
  }

  return (
    <div className="group relative my-2 overflow-hidden rounded-lg bg-elevated hairline">
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
        <span className="font-mono text-[11px] text-faint">
          {(className ?? "").replace("language-", "") || "code"}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy code"
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-faint transition-colors hover:text-ink"
        >
          {copied ? <Check className="h-3 w-3 text-ok" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="scroll-thin overflow-x-auto p-3">
        <code className={cn("font-mono text-[13px] leading-relaxed", className)} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

const components = {
  code: CodeBlock,
  a: ({ ...props }: ComponentPropsWithoutRef<"a">) => (
    <a
      className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
  p: ({ ...props }: ComponentPropsWithoutRef<"p">) => <p className="my-2 leading-relaxed" {...props} />,
  ul: ({ ...props }: ComponentPropsWithoutRef<"ul">) => (
    <ul className="my-2 list-disc space-y-1 pl-5" {...props} />
  ),
  ol: ({ ...props }: ComponentPropsWithoutRef<"ol">) => (
    <ol className="my-2 list-decimal space-y-1 pl-5" {...props} />
  ),
  li: ({ ...props }: ComponentPropsWithoutRef<"li">) => <li className="leading-relaxed" {...props} />,
  h1: ({ ...props }: ComponentPropsWithoutRef<"h1">) => (
    <h1 className="mb-2 mt-4 text-xl font-semibold" {...props} />
  ),
  h2: ({ ...props }: ComponentPropsWithoutRef<"h2">) => (
    <h2 className="mb-2 mt-4 text-lg font-semibold" {...props} />
  ),
  h3: ({ ...props }: ComponentPropsWithoutRef<"h3">) => (
    <h3 className="mb-2 mt-3 text-base font-semibold" {...props} />
  ),
  blockquote: ({ ...props }: ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote className="my-2 border-l-2 border-line-strong pl-3 text-muted" {...props} />
  ),
  table: ({ ...props }: ComponentPropsWithoutRef<"table">) => (
    <div className="scroll-thin my-2 overflow-x-auto rounded-lg hairline">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  th: ({ ...props }: ComponentPropsWithoutRef<"th">) => (
    <th className="border-b border-line bg-surface px-3 py-2 text-left font-medium" {...props} />
  ),
  td: ({ ...props }: ComponentPropsWithoutRef<"td">) => (
    <td className="border-b border-line/60 px-3 py-2" {...props} />
  ),
};

export const Markdown = memo(function Markdown({ children }: { children: string }) {
  return (
    <div className="text-[13px]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
});