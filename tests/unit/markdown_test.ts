// Unit tests for markdown parsing utilities

import { assertEquals, assertStringIncludes } from "@std/assert";

// ---------------------------------------------------------------------------
// HTML Escaping (tested via parseInlineMarkdown)
// ---------------------------------------------------------------------------

// Helper: Escape HTML characters to prevent XSS
function escapeHtml(text: string): string {
  if (!text) return "";
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

// Parse inline markdown and return HTML
function parseInlineMarkdown(text: string): string {
  if (!text) return "";

  // First escape HTML
  let result = escapeHtml(text);

  // Links: [text](url)
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-lime-600 hover:underline">$1</a>',
  );

  // Auto-link URLs (not already in an anchor)
  result = result.replace(
    /(?<!href="|">)(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-lime-600 hover:underline">$1</a>',
  );

  // Bold: **text** or __text__
  result = result.replace(
    /\*\*([^*]+)\*\*/g,
    '<strong class="font-semibold">$1</strong>',
  );
  result = result.replace(
    /__([^_]+)__/g,
    '<strong class="font-semibold">$1</strong>',
  );

  // Italic: *text* or _text_ (not inside bold)
  result = result.replace(
    /(?<!\*)\*([^*]+)\*(?!\*)/g,
    '<em class="italic">$1</em>',
  );
  result = result.replace(
    /(?<!_)_([^_]+)_(?!_)/g,
    '<em class="italic">$1</em>',
  );

  // Inline code: `text`
  result = result.replace(
    /`([^`]+)`/g,
    '<code class="px-1 py-0.5 bg-gray-100 rounded text-sm font-mono">$1</code>',
  );

  // Strikethrough: ~~text~~
  result = result.replace(/~~([^~]+)~~/g, '<del class="line-through">$1</del>');

  return result;
}

// Strip markdown formatting and return plain text
function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Links
    .replace(/\*\*([^*]+)\*\*/g, "$1") // Bold
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1") // Italic
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1") // Code
    .replace(/~~([^~]+)~~/g, "$1") // Strikethrough
    .replace(/https?:\/\/[^\s]+/g, "[link]"); // URLs
}

// Truncate text with ellipsis
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > maxLength * 0.7) {
    return truncated.slice(0, lastSpace) + "…";
  }

  return truncated + "…";
}

// ---------------------------------------------------------------------------
// HTML Escaping Tests
// ---------------------------------------------------------------------------

Deno.test("escapeHtml - escapes ampersand", () => {
  assertEquals(escapeHtml("Tom & Jerry"), "Tom &amp; Jerry");
});

Deno.test("escapeHtml - escapes angle brackets", () => {
  assertEquals(
    escapeHtml("<script>alert(1)</script>"),
    "&lt;script&gt;alert(1)&lt;/script&gt;",
  );
});

Deno.test("escapeHtml - escapes quotes", () => {
  assertEquals(escapeHtml('Say "hello"'), "Say &quot;hello&quot;");
});

Deno.test("escapeHtml - escapes single quotes", () => {
  assertEquals(escapeHtml("It's mine"), "It&#039;s mine");
});

Deno.test("escapeHtml - returns empty string for empty input", () => {
  assertEquals(escapeHtml(""), "");
});

// ---------------------------------------------------------------------------
// Link Tests
// ---------------------------------------------------------------------------

Deno.test("parseInlineMarkdown - parses markdown links", () => {
  const result = parseInlineMarkdown("[Click here](https://example.com)");
  assertStringIncludes(result, 'href="https://example.com"');
  assertStringIncludes(result, ">Click here</a>");
});

Deno.test("parseInlineMarkdown - auto-links bare URLs", () => {
  const result = parseInlineMarkdown("Visit https://example.com today");
  assertStringIncludes(result, 'href="https://example.com"');
});

Deno.test("parseInlineMarkdown - handles http URLs", () => {
  const result = parseInlineMarkdown("http://example.com");
  assertStringIncludes(result, 'href="http://example.com"');
});

Deno.test("parseInlineMarkdown - adds security attributes to links", () => {
  const result = parseInlineMarkdown("[test](https://example.com)");
  assertStringIncludes(result, 'target="_blank"');
  assertStringIncludes(result, 'rel="noopener noreferrer"');
});

// ---------------------------------------------------------------------------
// Bold Tests
// ---------------------------------------------------------------------------

Deno.test("parseInlineMarkdown - parses double asterisk bold", () => {
  const result = parseInlineMarkdown("This is **bold** text");
  assertStringIncludes(result, "<strong");
  assertStringIncludes(result, ">bold</strong>");
});

Deno.test("parseInlineMarkdown - parses double underscore bold", () => {
  const result = parseInlineMarkdown("This is __bold__ text");
  assertStringIncludes(result, "<strong");
  assertStringIncludes(result, ">bold</strong>");
});

Deno.test("parseInlineMarkdown - handles multiple bold sections", () => {
  const result = parseInlineMarkdown("**first** and **second**");
  const boldCount = (result.match(/<strong/g) || []).length;
  assertEquals(boldCount, 2);
});

// ---------------------------------------------------------------------------
// Italic Tests
// ---------------------------------------------------------------------------

Deno.test("parseInlineMarkdown - parses single asterisk italic", () => {
  const result = parseInlineMarkdown("This is *italic* text");
  assertStringIncludes(result, "<em");
  assertStringIncludes(result, ">italic</em>");
});

Deno.test("parseInlineMarkdown - parses single underscore italic", () => {
  const result = parseInlineMarkdown("This is _italic_ text");
  assertStringIncludes(result, "<em");
  assertStringIncludes(result, ">italic</em>");
});

// ---------------------------------------------------------------------------
// Inline Code Tests
// ---------------------------------------------------------------------------

Deno.test("parseInlineMarkdown - parses inline code", () => {
  const result = parseInlineMarkdown("Use `console.log()` for debugging");
  assertStringIncludes(result, "<code");
  assertStringIncludes(result, ">console.log()</code>");
});

Deno.test("parseInlineMarkdown - preserves special chars in code", () => {
  const result = parseInlineMarkdown("Type `<div>` tag");
  assertStringIncludes(result, "&lt;div&gt;");
});

Deno.test("parseInlineMarkdown - applies code styling", () => {
  const result = parseInlineMarkdown("`code`");
  assertStringIncludes(result, "bg-gray-100");
  assertStringIncludes(result, "font-mono");
});

// ---------------------------------------------------------------------------
// Strikethrough Tests
// ---------------------------------------------------------------------------

Deno.test("parseInlineMarkdown - parses strikethrough", () => {
  const result = parseInlineMarkdown("This is ~~deleted~~ text");
  assertStringIncludes(result, "<del");
  assertStringIncludes(result, ">deleted</del>");
});

Deno.test("parseInlineMarkdown - applies strikethrough styling", () => {
  const result = parseInlineMarkdown("~~struck~~");
  assertStringIncludes(result, "line-through");
});

// ---------------------------------------------------------------------------
// Combined Formatting Tests
// ---------------------------------------------------------------------------

Deno.test("parseInlineMarkdown - handles bold and italic together", () => {
  const result = parseInlineMarkdown("**bold** and *italic*");
  assertStringIncludes(result, "<strong");
  assertStringIncludes(result, "<em");
});

Deno.test("parseInlineMarkdown - handles multiple formatting types", () => {
  const result = parseInlineMarkdown("**bold** `code` [link](http://x.com)");
  assertStringIncludes(result, "<strong");
  assertStringIncludes(result, "<code");
  assertStringIncludes(result, "<a href");
});

Deno.test("parseInlineMarkdown - returns empty for empty input", () => {
  assertEquals(parseInlineMarkdown(""), "");
});

// ---------------------------------------------------------------------------
// XSS Prevention Tests
// ---------------------------------------------------------------------------

Deno.test("parseInlineMarkdown - prevents script injection", () => {
  const result = parseInlineMarkdown("<script>alert('xss')</script>");
  assertStringIncludes(result, "&lt;script&gt;");
  assertEquals(result.includes("<script>"), false);
});

Deno.test("parseInlineMarkdown - escapes HTML in link text", () => {
  const result = parseInlineMarkdown("[<img>](http://evil.com)");
  assertStringIncludes(result, "&lt;img&gt;");
});

// ---------------------------------------------------------------------------
// Strip Markdown Tests
// ---------------------------------------------------------------------------

Deno.test("stripMarkdown - removes link syntax", () => {
  assertEquals(
    stripMarkdown("[Click here](https://example.com)"),
    "Click here",
  );
});

Deno.test("stripMarkdown - removes bold asterisks", () => {
  assertEquals(stripMarkdown("This is **bold**"), "This is bold");
});

Deno.test("stripMarkdown - removes bold underscores", () => {
  assertEquals(stripMarkdown("This is __bold__"), "This is bold");
});

Deno.test("stripMarkdown - removes italic asterisks", () => {
  assertEquals(stripMarkdown("This is *italic*"), "This is italic");
});

Deno.test("stripMarkdown - removes italic underscores", () => {
  assertEquals(stripMarkdown("This is _italic_"), "This is italic");
});

Deno.test("stripMarkdown - removes inline code backticks", () => {
  assertEquals(stripMarkdown("Use `code` here"), "Use code here");
});

Deno.test("stripMarkdown - removes strikethrough", () => {
  assertEquals(stripMarkdown("~~deleted~~"), "deleted");
});

Deno.test("stripMarkdown - replaces URLs with [link]", () => {
  assertEquals(stripMarkdown("Visit https://example.com"), "Visit [link]");
});

Deno.test("stripMarkdown - handles combined formatting", () => {
  assertEquals(stripMarkdown("**bold** *italic* `code`"), "bold italic code");
});

// ---------------------------------------------------------------------------
// Truncate Tests
// ---------------------------------------------------------------------------

Deno.test("truncate - returns original if within limit", () => {
  assertEquals(truncate("short text", 100), "short text");
});

Deno.test("truncate - truncates at word boundary", () => {
  const result = truncate(
    "This is a longer piece of text that needs truncation",
    20,
  );
  assertEquals(result, "This is a longer…");
});

Deno.test("truncate - adds ellipsis", () => {
  const result = truncate("This is long text", 10);
  assertStringIncludes(result, "…");
});

Deno.test("truncate - handles text shorter than maxLength", () => {
  assertEquals(truncate("Hi", 100), "Hi");
});

Deno.test("truncate - handles exact length", () => {
  assertEquals(truncate("12345", 5), "12345");
});
