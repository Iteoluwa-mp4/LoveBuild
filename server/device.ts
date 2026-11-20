import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";

import {
  DEVICE_COOKIE,
  DEVICE_COOKIE_MAX_AGE,
  DEVICE_HEADER,
  DEVICE_TOKEN_PATTERN,
} from "../src/lib/site/deviceProtocol";

/**
 * The device identity used by the one-free-site rule.
 *
 * The API prefers its own HttpOnly cookie. On the very first request — or when
 * a browser refuses cookies — it accepts the install id the app already keeps
 * in localStorage. Either way the database only sees a SHA-256 hash, so the
 * device table cannot be turned back into a list of people.
 *
 * This is deliberately not a browser fingerprint. Fingerprints are unstable,
 * follow people around the web, and still get shared phones wrong. A random
 * install id is a smaller claim: "this browser profile is the same browser
 * profile it was last time". It is enough to stop the ordinary new-email
 * bypass. It is not enough to stop someone who clears all browser storage; see
 * `src/lib/site/entitlement.ts` for the honest boundary.
 */

type ApiEnv = { Variables: { uid: string } };

/** A token is either the cookie the API set or the browser's install id. */
function usable(value: string | null | undefined): string | null {
  return value && DEVICE_TOKEN_PATTERN.test(value) ? value : null;
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

/**
 * Reads or starts the device identity and returns the hash the store uses.
 *
 * The cookie wins when both are present: it is the server-issued copy, while
 * the header is only a bootstrap value the client could have replaced. When the
 * cookie is missing and the header is good, the header is promoted to a cookie
 * so the identity survives the next request even if the app's storage is
 * unavailable.
 */
export async function deviceHashFor(c: Context<ApiEnv>): Promise<string> {
  const cookie = usable(getCookie(c, DEVICE_COOKIE));
  const header = usable(c.req.header(DEVICE_HEADER));
  const token = cookie ?? header ?? randomToken();

  if (token !== cookie) {
    setCookie(c, DEVICE_COOKIE, token, {
      httpOnly: true,
      secure: new URL(c.req.url).protocol === "https:",
      sameSite: "Lax",
      path: "/api",
      maxAge: DEVICE_COOKIE_MAX_AGE,
    });
  }

  return sha256(token);
}
