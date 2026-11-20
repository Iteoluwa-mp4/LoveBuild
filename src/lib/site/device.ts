import { DEVICE_STORAGE_KEY, DEVICE_TOKEN_PATTERN } from "./deviceProtocol";

/**
 * The browser's side of the device identity.
 *
 * One random id per browser profile, made once and kept. It is deliberately not
 * derived from a fingerprint: a fingerprint would be unstable, would follow
 * people between sites, and would still be wrong for the person who shares a
 * phone. This is an install id, and it means exactly what it says.
 *
 * `localStorage` can be unavailable in private mode. In that case the id still
 * lives for the lifetime of the page, which is enough to make the first request
 * and set the API's cookie.
 */

let cached: string | null = null;

function generate(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      const bytes = crypto.getRandomValues(new Uint8Array(24));
      return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    }
  } catch {
    /* Fall through to the non-cryptographic id below. */
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

function readStored(): string | null {
  try {
    const value = localStorage.getItem(DEVICE_STORAGE_KEY);
    return value && DEVICE_TOKEN_PATTERN.test(value) ? value : null;
  } catch {
    return null;
  }
}

function store(value: string): void {
  try {
    localStorage.setItem(DEVICE_STORAGE_KEY, value);
  } catch {
    /* The in-memory id still covers this page. */
  }
}

/** The stable id this browser sends to the API. */
export function installId(): string {
  if (cached) return cached;

  const stored = readStored();
  if (stored) {
    cached = stored;
    return stored;
  }

  const generated = generate();
  cached = generated;
  store(generated);
  return generated;
}
