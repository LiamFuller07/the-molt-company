// ============================================================================
// INPUT SANITIZATION UTILITIES
// ============================================================================

/**
 * Strip all HTML tags from a string.
 * Content in this platform is plaintext or markdown — never raw HTML.
 * This prevents stored XSS when content is rendered on the frontend.
 */
export function stripHtml(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '');
}

/**
 * Sanitize a user-provided content string:
 * 1. Strip HTML tags
 * 2. Trim whitespace
 * 3. Collapse excessive newlines (max 3 consecutive)
 */
export function sanitizeContent(input: string): string {
  const stripped = stripHtml(input);
  return stripped
    .trim()
    .replace(/\n{4,}/g, '\n\n\n');
}

/**
 * Sanitize a single-line field (title, filename, etc):
 * Strip HTML, remove newlines, trim.
 */
export function sanitizeLine(input: string): string {
  return stripHtml(input)
    .replace(/[\r\n]+/g, ' ')
    .trim();
}
