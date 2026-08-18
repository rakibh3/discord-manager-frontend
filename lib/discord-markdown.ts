/** A parser for the subset of Discord markup this app posts — deliberately not
 *  CommonMark, whose headings, `__underline__` and `<#id>` handling all differ. */

export type InlineNode =
  | { type: "text"; value: string }
  | { type: "bold"; children: InlineNode[] }
  | { type: "italic"; children: InlineNode[] }
  | { type: "underline"; children: InlineNode[] }
  | { type: "strike"; children: InlineNode[] }
  | { type: "spoiler"; children: InlineNode[] }
  | { type: "code"; value: string }
  | { type: "link"; href: string }
  /** `@everyone`, `@here`, `<@&id>`, `<@id>` and `<#id>` all land here. */
  | { type: "mention"; kind: "everyone" | "here" | "role" | "user" | "channel"; id: string | null };

export type BlockNode =
  | { type: "heading"; level: 1 | 2 | 3; children: InlineNode[] }
  | { type: "paragraph"; children: InlineNode[] }
  | { type: "list"; items: InlineNode[][] }
  | { type: "quote"; children: InlineNode[] }
  | { type: "codeblock"; language: string | null; value: string };

/** One alternation over every inline form, longest-first: `***` before `**`
 *  before `*`, or the shorter pattern claims the opening delimiter. */
const INLINE_SOURCE = [
  "`([^`\\n]+)`", // 1: inline code — first, so nothing inside it is parsed
  "\\*\\*\\*([\\s\\S]+?)\\*\\*\\*", // 2: bold italic
  "\\*\\*([\\s\\S]+?)\\*\\*", // 3: bold
  "__([\\s\\S]+?)__", // 4: underline (Discord, not emphasis)
  "~~([\\s\\S]+?)~~", // 5: strikethrough
  "\\|\\|([\\s\\S]+?)\\|\\|", // 6: spoiler
  "\\*([^*\\n]+?)\\*", // 7: italic
  "_([^_\\n]+?)_", // 8: italic
  "<#(\\d{17,20})>", // 9: channel mention
  "<@&(\\d{17,20})>", // 10: role mention
  "<@!?(\\d{17,20})>", // 11: user mention
  "(@everyone|@here)", // 12: guild-wide mention
  "(https?://[^\\s<>]+[^\\s<>.,;:!?)\\]])", // 13: bare link
].join("|");

/** Trailing `.`/`,` are excluded from links above; a bare domain is left alone. */
export function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let cursor = 0;

  // A fresh instance per call: `parseInline` recurses, and a shared global
  // regex carries one `lastIndex` that the inner call would rewind.
  const pattern = new RegExp(INLINE_SOURCE, "g");
  let match = pattern.exec(text);

  while (match !== null) {
    if (match.index > cursor) {
      nodes.push({ type: "text", value: text.slice(cursor, match.index) });
    }

    const [
      ,
      code,
      boldItalic,
      bold,
      underline,
      strike,
      spoiler,
      italicStar,
      italicUnderscore,
      channelId,
      roleId,
      userId,
      guildWide,
      link,
    ] = match;

    if (code !== undefined) {
      nodes.push({ type: "code", value: code });
    } else if (boldItalic !== undefined) {
      nodes.push({
        type: "bold",
        children: [{ type: "italic", children: parseInline(boldItalic) }],
      });
    } else if (bold !== undefined) {
      nodes.push({ type: "bold", children: parseInline(bold) });
    } else if (underline !== undefined) {
      nodes.push({ type: "underline", children: parseInline(underline) });
    } else if (strike !== undefined) {
      nodes.push({ type: "strike", children: parseInline(strike) });
    } else if (spoiler !== undefined) {
      nodes.push({ type: "spoiler", children: parseInline(spoiler) });
    } else if (italicStar !== undefined) {
      nodes.push({ type: "italic", children: parseInline(italicStar) });
    } else if (italicUnderscore !== undefined) {
      nodes.push({ type: "italic", children: parseInline(italicUnderscore) });
    } else if (channelId !== undefined) {
      nodes.push({ type: "mention", kind: "channel", id: channelId });
    } else if (roleId !== undefined) {
      nodes.push({ type: "mention", kind: "role", id: roleId });
    } else if (userId !== undefined) {
      nodes.push({ type: "mention", kind: "user", id: userId });
    } else if (guildWide !== undefined) {
      nodes.push({
        type: "mention",
        kind: guildWide === "@everyone" ? "everyone" : "here",
        id: null,
      });
    } else if (link !== undefined) {
      nodes.push({ type: "link", href: link });
    }

    cursor = match.index + match[0].length;
    match = pattern.exec(text);
  }

  if (cursor < text.length) {
    nodes.push({ type: "text", value: text.slice(cursor) });
  }

  return nodes;
}

const HEADING_PATTERN = /^(#{1,3})\s+(.*)$/;
const LIST_PATTERN = /^\s*[-*]\s+(.*)$/;
const QUOTE_PATTERN = /^>\s?(.*)$/;
const FENCE_PATTERN = /^```(\w+)?\s*$/;

/** Splits a message into blocks. Consecutive lines join into one paragraph with
 *  newlines preserved — Discord renders a single newline as a line break. */
export function parseDiscordMessage(content: string): BlockNode[] {
  const blocks: BlockNode[] = [];
  const lines = content.replace(/\r\n/g, "\n").split("\n");

  let paragraph: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ type: "paragraph", children: parseInline(paragraph.join("\n")) });
    paragraph = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push({ type: "list", items: listItems.map(parseInline) });
    listItems = [];
  };

  const flush = () => {
    flushParagraph();
    flushList();
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fence = FENCE_PATTERN.exec(line);

    // A fence swallows lines verbatim until it closes, so nothing inside is
    // mistaken for a heading or a list.
    if (fence) {
      flush();
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !FENCE_PATTERN.test(lines[index])) {
        body.push(lines[index]);
        index += 1;
      }
      blocks.push({
        type: "codeblock",
        language: fence[1] ?? null,
        value: body.join("\n"),
      });
      continue;
    }

    if (line.trim() === "") {
      flush();
      continue;
    }

    const heading = HEADING_PATTERN.exec(line);
    if (heading) {
      flush();
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3,
        children: parseInline(heading[2]),
      });
      continue;
    }

    const listItem = LIST_PATTERN.exec(line);
    if (listItem) {
      flushParagraph();
      listItems.push(listItem[1]);
      continue;
    }

    const quote = QUOTE_PATTERN.exec(line);
    if (quote) {
      flush();
      blocks.push({ type: "quote", children: parseInline(quote[1]) });
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flush();
  return blocks;
}
