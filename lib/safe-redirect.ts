/**
 * `redirectTo` comes straight from a form field, so it can't be trusted to stay on this site
 * (`//evil.com`, `https://evil.com`, `/\evil.com`…). Only same-site absolute paths pass;
 * anything else falls back to a safe default.
 */
export function safeRedirectPath(value: unknown, fallback = '/equipos'): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  // No protocol-relative URLs, no backslashes (browsers treat them as slashes), no control characters.
  if (!raw.startsWith('/') || raw.startsWith('//') || /[\\\r\n\t]/.test(raw)) return fallback

  try {
    const url = new URL(raw, 'http://internal.invalid')
    if (url.origin !== 'http://internal.invalid') return fallback
    return `${url.pathname}${url.search}`
  } catch {
    return fallback
  }
}
