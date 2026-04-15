import DOMPurify from "isomorphic-dompurify"

/**
 * Sanitize HTML using DOMPurify.
 * Used for rendering LLM-generated email previews safely.
 * Only allows safe formatting tags — no scripts, iframes, or event handlers.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      "b", "i", "em", "strong", "p", "br", "ul", "ol", "li", "a",
      "h1", "h2", "h3", "h4", "span", "div", "table", "tr", "td", "th",
      "thead", "tbody", "blockquote", "hr", "img",
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "style", "class"],
    ALLOW_DATA_ATTR: false,
    FORCE_BODY: true,
  })
}
