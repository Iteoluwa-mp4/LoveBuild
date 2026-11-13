import { getFirebaseAuth } from "./firebase";
import { SaveError } from "./repository";

/**
 * The one place the browser talks to the API.
 *
 * Owner requests carry a fresh Firebase ID token; public requests deliberately
 * do not, because a visitor opening `/s/:slug` has no session and must still
 * see the page. Keeping that difference in one file means the repository and
 * the media uploader cannot drift into two slightly different auth stories.
 */
export const API_ROOT = "/api";

/** A request as the signed-in owner. */
export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const user = getFirebaseAuth()?.currentUser;
  if (!user) throw new SaveError("Sign in to continue.");

  let token: string;
  try {
    token = await user.getIdToken();
  } catch {
    throw new SaveError("Your session has expired. Sign in again.", undefined, "unauthorized");
  }

  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  if (init.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return send<T>(`${API_ROOT}${path}`, { ...init, headers });
}

/** A request a signed-out visitor is allowed to make. */
export async function publicRequest<T>(path: string): Promise<T> {
  return send<T>(`${API_ROOT}${path}`, {});
}

async function send<T>(url: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new SaveError(
      "Could not reach storage. Check your connection and try again.",
      undefined,
      "unavailable",
    );
  }

  if (!response.ok) throw await errorFor(response);
  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}

/**
 * Turns an API failure into the same `SaveError` the repository contract has
 * always used, so every existing catch site keeps working.
 */
export async function errorFor(response: Response): Promise<SaveError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    /* A proxy or a crash can return HTML. Fall back to a sentence. */
  }

  const data =
    typeof body === "object" && body !== null
      ? (body as { error?: unknown; code?: unknown; path?: unknown })
      : {};

  const message =
    typeof data.error === "string"
      ? data.error
      : response.status === 401
        ? "Your session has expired. Sign in again."
        : "Could not reach storage. Try again.";

  return new SaveError(
    message,
    typeof data.path === "string" ? data.path : undefined,
    typeof data.code === "string" ? data.code : undefined,
  );
}
