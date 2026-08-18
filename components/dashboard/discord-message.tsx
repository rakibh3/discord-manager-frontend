import { Fragment, type ComponentProps, type ReactNode } from "react";

import {
  parseDiscordMessage,
  type BlockNode,
  type InlineNode,
} from "@/lib/discord-markdown";
import { cn } from "@/lib/utils";

/** Renders an announcement the way Discord will, so an admin proof-reads the
 *  message and not the syntax. React elements only — never `innerHTML`. */
export function DiscordMessage({
  content,
  className,
  ...props
}: { content: string } & Omit<ComponentProps<"div">, "children">) {
  const blocks = parseDiscordMessage(content);

  return (
    <div
      {...props}
      className={cn(
        "bg-muted text-foreground flex flex-col gap-2 rounded-md p-4 text-sm break-words",
        className,
      )}
    >
      {blocks.map((block, index) => (
        <Block key={index} node={block} />
      ))}
    </div>
  );
}

/** Discord caps headings at three levels; there is no `####`. */
const HEADING_CLASS = {
  1: "text-xl font-bold",
  2: "text-lg font-bold",
  3: "text-base font-semibold",
} as const;

function Block({ node }: { node: BlockNode }) {
  switch (node.type) {
    case "heading": {
      const Tag = `h${node.level}` as "h1" | "h2" | "h3";
      return (
        <Tag className={cn("mt-1 first:mt-0", HEADING_CLASS[node.level])}>
          <Inlines nodes={node.children} />
        </Tag>
      );
    }

    case "list":
      return (
        <ul className="ml-4 flex list-disc flex-col gap-0.5">
          {node.items.map((item, index) => (
            <li key={index}>
              <Inlines nodes={item} />
            </li>
          ))}
        </ul>
      );

    case "quote":
      return (
        <blockquote className="border-muted-foreground/40 border-l-2 pl-3">
          <Inlines nodes={node.children} />
        </blockquote>
      );

    case "codeblock":
      return (
        <pre className="bg-background overflow-x-auto rounded p-2 font-mono text-xs">
          {node.value}
        </pre>
      );

    case "paragraph":
      // `whitespace-pre-wrap` keeps single newlines as line breaks, which is
      // how Discord renders them — unlike Markdown, which folds them away.
      return (
        <p className="whitespace-pre-wrap">
          <Inlines nodes={node.children} />
        </p>
      );
  }
}

function Inlines({ nodes }: { nodes: InlineNode[] }): ReactNode {
  return nodes.map((node, index) => <Inline key={index} node={node} />);
}

function Inline({ node }: { node: InlineNode }): ReactNode {
  switch (node.type) {
    case "text":
      return <Fragment>{node.value}</Fragment>;

    case "bold":
      return (
        <strong className="font-semibold">
          <Inlines nodes={node.children} />
        </strong>
      );

    case "italic":
      return (
        <em>
          <Inlines nodes={node.children} />
        </em>
      );

    case "underline":
      return (
        <u>
          <Inlines nodes={node.children} />
        </u>
      );

    case "strike":
      return (
        <s>
          <Inlines nodes={node.children} />
        </s>
      );

    case "spoiler":
      // Not interactive: an admin proof-reading needs to see the text, and the
      // shading is enough to show it will arrive hidden.
      return (
        <span className="bg-foreground/15 rounded px-1">
          <Inlines nodes={node.children} />
        </span>
      );

    case "code":
      return (
        <code className="bg-background rounded px-1 py-0.5 font-mono text-xs">
          {node.value}
        </code>
      );

    case "link":
      return (
        <a
          href={node.href}
          target="_blank"
          rel="noreferrer noopener"
          className="text-primary underline underline-offset-2"
        >
          {node.href}
        </a>
      );

    case "mention":
      return <Mention node={node} />;
  }
}

/** A mention chip. The payload carries IDs only, so the chip names the kind of
 *  target and keeps the snowflake in the tooltip. */
function Mention({
  node,
}: {
  node: Extract<InlineNode, { type: "mention" }>;
}) {
  const label =
    node.kind === "everyone"
      ? "@everyone"
      : node.kind === "here"
        ? "@here"
        : node.kind === "channel"
          ? "#channel"
          : node.kind === "role"
            ? "@role"
            : "@user";

  // A guild-wide ping is the one mention with a blast radius worth colouring
  // differently — it is the difference between a notification and 5,000.
  const guildWide = node.kind === "everyone" || node.kind === "here";

  return (
    <span
      title={node.id ?? undefined}
      className={cn(
        "rounded px-1 py-0.5 font-medium",
        guildWide
          ? "bg-warning/20 text-warning"
          : "bg-primary/15 text-primary",
      )}
    >
      {label}
    </span>
  );
}
