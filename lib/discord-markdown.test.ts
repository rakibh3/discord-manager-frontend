import { describe, expect, test } from "bun:test";

import { parseDiscordMessage, parseInline } from "./discord-markdown";

/**
 * The parser's failure mode is silent and public: anything it mis-reads is
 * shown to an admin as "this is exactly what students will see" immediately
 * before it is posted to ~5,000 of them. So the cases pinned here are the ones
 * where Discord's flavour differs from Markdown, plus the real template.
 */

const inlineText = (nodes: ReturnType<typeof parseInline>): string =>
  nodes
    .map((node) => {
      if (node.type === "text") return node.value;
      if (node.type === "code") return node.value;
      if (node.type === "link") return node.href;
      if (node.type === "mention") return `<${node.kind}:${node.id ?? ""}>`;
      return inlineText(node.children);
    })
    .join("");

describe("parseInline", () => {
  test("reads bold, italic and underline as Discord does", () => {
    expect(parseInline("**bold**")).toEqual([
      { type: "bold", children: [{ type: "text", value: "bold" }] },
    ]);

    // `__` is *underline* in Discord, not the emphasis CommonMark makes it.
    expect(parseInline("__under__")).toEqual([
      { type: "underline", children: [{ type: "text", value: "under" }] },
    ]);

    expect(parseInline("*it*")).toEqual([
      { type: "italic", children: [{ type: "text", value: "it" }] },
    ]);
  });

  test("prefers the longest delimiter, so `**` never parses as two italics", () => {
    const [node] = parseInline("**23:59**");
    expect(node).toEqual({
      type: "bold",
      children: [{ type: "text", value: "23:59" }],
    });
  });

  test("does not parse markup inside inline code", () => {
    expect(parseInline("`**not bold**`")).toEqual([
      { type: "code", value: "**not bold**" },
    ]);
  });

  test("recognises every mention form", () => {
    expect(parseInline("<#1466726103602429973>")).toEqual([
      { type: "mention", kind: "channel", id: "1466726103602429973" },
    ]);
    expect(parseInline("<@&1466726103602429973>")).toEqual([
      { type: "mention", kind: "role", id: "1466726103602429973" },
    ]);
    expect(parseInline("<@1466726103602429973>")).toEqual([
      { type: "mention", kind: "user", id: "1466726103602429973" },
    ]);
    expect(parseInline("@everyone")).toEqual([
      { type: "mention", kind: "everyone", id: null },
    ]);
  });

  test("links stop before trailing sentence punctuation", () => {
    expect(parseInline("see http://localhost:3001.")).toEqual([
      { type: "text", value: "see " },
      { type: "link", href: "http://localhost:3001" },
      { type: "text", value: "." },
    ]);
  });

  test("leaves unmatched delimiters as literal text", () => {
    expect(parseInline("2 * 3 = 6")).toEqual([{ type: "text", value: "2 * 3 = 6" }]);
  });
});

describe("parseDiscordMessage", () => {
  test("reads the three heading levels and nothing deeper", () => {
    const blocks = parseDiscordMessage("# one\n## two\n### three\n#### four");
    expect(blocks.map((block) => block.type)).toEqual([
      "heading",
      "heading",
      "heading",
      "paragraph",
    ]);
    expect(blocks.slice(0, 3).map((block) => "level" in block && block.level)).toEqual([
      1, 2, 3,
    ]);
  });

  test("groups consecutive bullets into one list", () => {
    const blocks = parseDiscordMessage("- **Date:**\n- **Learning Hour:**");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("list");
    expect(blocks[0].type === "list" && blocks[0].items).toHaveLength(2);
  });

  test("keeps a single newline as a line break inside one paragraph", () => {
    const blocks = parseDiscordMessage("first\nsecond");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type === "paragraph" && inlineText(blocks[0].children)).toBe(
      "first\nsecond",
    );
  });

  test("a fenced block is verbatim — no heading or list inside it", () => {
    const blocks = parseDiscordMessage("```json\n# not a heading\n```");
    expect(blocks).toEqual([
      { type: "codeblock", language: "json", value: "# not a heading" },
    ]);
  });

  test("parses the live attendance announcement end to end", () => {
    const blocks = parseDiscordMessage(
      [
        "# 📢 ডেইলি অ্যাটেন্ডেন্স ও আপডেট",
        "### 📅 Date: 2026-08-18",
        "",
        "সবাই রাত **23:59** এর মধ্যে <#1466726103602429973> চ্যানেলে আপডেট দিবেন।",
        "",
        "## 📝 অ্যাটেন্ডেন্স ফর্ম",
        "http://localhost:3001",
        "",
        "- **Date:**",
        "- **Learning Hour:**",
        "",
        "@everyone",
      ].join("\n"),
    );

    expect(blocks.map((block) => block.type)).toEqual([
      "heading",
      "heading",
      "paragraph",
      "heading",
      "paragraph",
      "list",
      "paragraph",
    ]);

    // The syntax an admin should never have to read is gone from the output.
    const flattened = blocks
      .map((block) =>
        block.type === "list"
          ? block.items.map(inlineText).join("")
          : block.type === "codeblock"
            ? block.value
            : inlineText(block.children),
      )
      .join("\n");

    expect(flattened).not.toContain("**");
    expect(flattened).not.toContain("###");
    expect(flattened).toContain("<channel:1466726103602429973>");
    expect(flattened).toContain("<everyone:>");
  });
});
