import { STORAGE_PREFIX } from "./brand";

/**
 * Local authentication.
 *
 * Replaces a hosted auth provider, and there is no other copy of this file's job
 * to compare it against — so what this *is* matters more than usual:
 *
 * **This is a gate, not a lock.** Everything it protects — the sites, the config,
 * the photos — lives in this browser's localStorage. Anyone with this machine and
 * this browser profile already has all of it, and any script running on the origin
 * can read the same keys. The passcode decides who gets the *editor*, not who can
 * read the *data*.
 *
 * It exists because the dashboard is where you write someone's love letter, and
 * "don't lose an afternoon of work to a stray keystroke" is worth a four-character
 * prompt. It is not a security boundary, and it must not be described as one.
 *
 * ## Why it is shaped like a session
 *
 * `useSession` and `RequireAuth` already exist and were built against a real
 * provider. Rather than delete them and rebuild the gate when a backend arrives,
 * this keeps the same three states and the same call sites, so swapping the
 * implementation later is a one-file change:
 *
 *   checking    → storage not read yet
 *   signed-out  → known, nobody entered the passcode
 *   signed-in   → unlocked
 *
 * ## What replaces this
 *
 * Whichever backend comes next, this file goes and `useSession` points at it. The
 * hash function and the storage keys are the only things that are genuinely local;
 * the contract around them is not.
 */

/** Storage keys, namespaced with the app prefix so they cannot collide. */
const HASH_KEY = `${STORAGE_PREFIX}auth:hash`;
const SALT_KEY = `${STORAGE_PREFIX}auth:salt`;
const UNLOCKED_KEY = `${STORAGE_PREFIX}auth:unlocked`;

/**
 * Short enough that a four-year-old can be handed the machine without it becoming
 * a puzzle, long enough to not be "a".
 */
export const MIN_PASSCODE_LENGTH = 4;

export type AuthResult = { ok: true } | { ok: false; message: string };

/* ------------------------------------------------------------------ *
 * STORAGE
 *
 * Every access is wrapped. localStorage throws rather than returning null when
 * storage is full, and in private browsing it may not exist at all — and an auth
 * module that throws on read takes the whole app down with it.
 * ------------------------------------------------------------------ */

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* nothing useful to do; the session simply will not survive a reload */
  }
}

function clear(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* nothing useful to do */
  }
}

function hasStorage(): boolean {
  try {
    const probe = `${STORAGE_PREFIX}auth-probe`;
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * HASHING
 *
 * SHA-256 via WebCrypto, salted.
 *
 * The salt is not defence against anything real — this is a local gate and anyone
 * with access to the data has access to the salt too. It exists so two people
 * choosing the same passcode do not produce the same stored string, which would
 * be a needless tell if this ever moved behind a shared store.
 *
 * The async API is the reason `checkPasscode` is a promise rather than a
 * comparison. Nothing else in the app hashes, so there is no sync equivalent.
 * ------------------------------------------------------------------ */

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hash(passcode: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${passcode}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time-ish comparison, so a wrong guess reveals no timing detail. */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ------------------------------------------------------------------ *
 * THE CONTRACT
 * ------------------------------------------------------------------ */

/** True when a passcode has been set for this browser. */
export function isPasscodeSet(): boolean {
  return read(HASH_KEY) !== null;
}

/**
 * True when the editor is unlocked right now.
 *
 * Distinct from `isPasscodeSet` because they mean opposite things for the login
 * page: no passcode set means nothing to type, while a passcode set and no unlock
 * means the login form should be showing.
 */
export function isUnlocked(): boolean {
  return read(UNLOCKED_KEY) === "1";
}

/**
 * Sets the passcode.
 *
 * Refuses to overwrite an existing one. The passcode is the only thing standing
 * between the dashboard and a stray edit, so silently replacing it because a form
 * said so would undo the point of having one. Changing it is a separate, explicit
 * action.
 */
export async function setPasscode(passcode: string): Promise<AuthResult> {
  if (!hasStorage()) {
    return {
      ok: false,
      message:
        "This browser will not let the app save anything, so there is nothing to protect. " +
        "Private browsing usually causes this.",
    };
  }
  if (isPasscodeSet()) {
    return {
      ok: false,
      message: "A passcode is already set for this browser. Sign out and change it instead.",
    };
  }
  if (passcode.trim().length < MIN_PASSCODE_LENGTH) {
    return {
      ok: false,
      message: `Use at least ${MIN_PASSCODE_LENGTH} characters.`,
    };
  }

  const salt = randomSalt();
  const digest = await hash(passcode.trim(), salt);
  write(SALT_KEY, salt);
  write(HASH_KEY, digest);
  write(UNLOCKED_KEY, "1");
  // Subscribers decide what to do about it. The login page navigates from that
  // subscription rather than redirecting itself, because a redirect here would
  // race the listener and can land back on this page.
  notify();
  return { ok: true };
}

/** Checks a passcode and, if it matches, unlocks the editor for this session. */
export async function checkPasscode(passcode: string): Promise<AuthResult> {
  const storedHash = read(HASH_KEY);
  const salt = read(SALT_KEY);
  if (!storedHash || !salt) {
    return { ok: false, message: "No passcode has been set for this browser yet." };
  }

  const attempt = await hash(passcode.trim(), salt);
  if (!same(attempt, storedHash)) {
    return { ok: false, message: "That passcode didn't match." };
  }

  write(UNLOCKED_KEY, "1");
  // Same reason as `setPasscode`: without this the correct passcode would unlock
  // storage and leave the person staring at the form they just filled in.
  notify();
  return { ok: true };
}

/** Replaces the passcode. Requires the current one — see `setPasscode`. */
export async function changePasscode(current: string, next: string): Promise<AuthResult> {
  const check = await checkPasscode(current);
  if (!check.ok) return check;

  clear(HASH_KEY);
  clear(SALT_KEY);
  return setPasscode(next);
}

/**
 * Locks the editor again.
 *
 * Data is untouched — this only stops the dashboard rendering. Sites stay exactly
 * where they are, which is the entire point of a session as opposed to a
 * "delete my work" button.
 */
export function lock(): void {
  clear(UNLOCKED_KEY);
  notify();
}

/**
 * Subscribers to the session.
 *
 * A plain listener set rather than a DOM event. The earlier version dispatched on
 * `window` inside a `try`, with a comment saying a test environment has no window
 * — which is precisely the problem: the notification was silently dropped
 * anywhere that was not a browser, including every test. Storage is the real
 * source of truth and nothing here needs the DOM to say so.
 *
 * It also means the "did it notify" question is answerable, which a
 * `window.dispatchEvent` in a try/catch can never be.
 */
const listeners = new Set<() => void>();

function notify(): void {
  // Copied first: a listener may unsubscribe itself, and mutating the set while
  // iterating it would skip whoever comes next.
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {
      /* one bad subscriber must not stop the others */
    }
  }
}

/** Subscribes to session changes. Returns an unsubscribe function. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}