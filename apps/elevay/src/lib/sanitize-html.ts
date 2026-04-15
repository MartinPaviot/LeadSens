/**
 * Lightweight HTML sanitizer for rendering LLM-generated email previews.
 * Strips script tags, event handlers, and dangerous attributes.
 * For production, consider using DOMPurify.
 */
export function sanitizeHtml(html: string): string {
  return html
    // Remove script tags and their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    // Remove event handlers (onclick, onerror, onload, etc.)
    .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\s+on\w+\s*=\s*\S+/gi, "")
    // Remove javascript: URIs
    .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"')
    .replace(/src\s*=\s*["']javascript:[^"']*["']/gi, 'src=""')
    // Remove data: URIs in src (potential XSS vector)
    .replace(/src\s*=\s*["']data:[^"']*["']/gi, 'src=""')
    // Remove style expressions (IE legacy but still good practice)
    .replace(/expression\s*\(/gi, "")
    // Remove iframe, object, embed tags
    .replace(/<(iframe|object|embed|form|input|textarea)\b[^>]*>/gi, "")
    .replace(/<\/(iframe|object|embed|form|input|textarea)>/gi, "")
}
