// Basic markdown rendering utilities
// Supports: links, bold, italic, inline code, strikethrough

/**
 * Escape HTML characters to prevent XSS
 */
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

/**
 * Parse inline markdown and return HTML
 * Supports:
 * - **bold** or __bold__
 * - *italic* or _italic_
 * - `inline code`
 * - ~~strikethrough~~
 * - [links](url)
 * - URLs automatically linked
 */
export function parseInlineMarkdown(text: string): string {
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

/**
 * Parse multi-line markdown with basic block support
 * Supports inline features plus:
 * - Line breaks (double newline = paragraph)
 * - Lists (- or *)
 */
export function parseMarkdown(text: string): string {
  // Split into paragraphs
  const paragraphs = text.split(/\n\n+/);

  return paragraphs
    .map((para) => {
      const trimmed = para.trim();
      if (!trimmed) return "";

      // Check for list items
      const lines = trimmed.split("\n");
      const isListStart = /^[-*]\s/.test(lines[0]);

      if (isListStart) {
        const items = lines
          .filter((line) => /^[-*]\s/.test(line))
          .map((line) => {
            const content = line.replace(/^[-*]\s+/, "");
            return `<li class="ml-4">${parseInlineMarkdown(content)}</li>`;
          });
        return `<ul class="list-disc list-inside space-y-1">${
          items.join("")
        }</ul>`;
      }

      // Regular paragraph
      const content = lines
        .map((line) => parseInlineMarkdown(line))
        .join("<br>");
      return `<p class="mb-2 last:mb-0">${content}</p>`;
    })
    .filter(Boolean)
    .join("");
}

/**
 * Strip markdown formatting and return plain text
 * Useful for previews and search
 */
export function stripMarkdown(text: string): string {
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

/**
 * Truncate text with ellipsis, respecting word boundaries
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > maxLength * 0.7) {
    return truncated.slice(0, lastSpace) + "…";
  }

  return truncated + "…";
}
