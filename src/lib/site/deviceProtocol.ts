import { STORAGE_PREFIX } from "./brand";

/**
 * The small contract between the browser's device id and the API.
 *
 * The browser keeps a random install id in localStorage and sends it as a
 * header as a fallback. The API prefers its own HttpOnly cookie, but accepts the
 * header on the first request so a browser that blocks cookies still has a
 * stable identity across tabs and account switches. The server stores only a
 * SHA-256 hash, never the token itself.
 *
 * These constants live outside `device.ts` because the server imports them too,
 * and the browser module touches `localStorage` and `crypto`.
 */

export const DEVICE_COOKIE = "lovebuilds_device";
export const DEVICE_HEADER = "x-lovebuilds-device";
export const DEVICE_STORAGE_KEY = `${STORAGE_PREFIX}device`;

/** Long enough to be random, short enough to reject junk before hashing it. */
export const DEVICE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

/**
 * Browsers cap persistent cookies at 400 days, so this is the longest useful
 * lifetime rather than a round number of years. The install id in localStorage
 * normally outlives it and is promoted back into a cookie on the next request.
 */
export const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;
