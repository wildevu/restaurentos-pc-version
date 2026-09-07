/**
 * Universal UUID v4 generator.
 * Safely falls back if crypto is not available (e.g., non-secure HTTP LAN environments).
 */
export function uuidv4(): string {
  // Browser standard Web Crypto API (only available in HTTPS or localhost)
  if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  
  // RFC 4122 compliant fallback (Math.random)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
