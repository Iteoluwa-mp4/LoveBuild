import { beforeEach, describe, expect, it } from "vitest";

import {
  MIN_PASSCODE_LENGTH,
  checkPasscode,
  isPasscodeSet,
  isUnlocked,
  setPasscode,
  subscribe,
} from "../auth";

/**
 * A minimal localStorage.
 *
 * Vitest runs in Node here, with no DOM environment — this project has no
 * component tests, so the config has never needed one. Rather than add jsdom for a
 * single file, the handful of operations `auth.ts` actually uses are stubbed.
 *
 * What is *not* modelled is quota exhaustion, which `auth.ts` guards against and
 * which this cannot reach without a fake — that branch stays unverified by
 * design rather than by accident.
 */
function stubStorage(): Map<string, string> {
  const map = new Map<string, string>();

  const storage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, String(value)),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  };

  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });

  return map;
}

/**
 * The map itself, not `Object.keys(localStorage)`.
 *
 * The stub's own methods are enumerable own properties, so enumerating it lists
 * `getItem`, `setItem` and friends rather than the stored keys — which reads as
 * "storage is empty" while a passcode is very much set. Holding the map sidesteps
 * the difference entirely.
 */
const store = stubStorage();

function reset(): void {
  store.clear();
}

/**
 * The local passcode.
 *
 * These assertions are about a *gate*, not a lock — `auth.ts` is explicit that
 * everything it protects already sits in this browser's localStorage. So what is
 * worth testing here is not "can this be broken" but "does it fail loudly and
 * leave the user in a state they can recover from". A gate that locks someone out
 * of an afternoon's work is a bug even though nobody broke in.
 */

describe("the local passcode", () => {
  beforeEach(reset);

  it("starts with no passcode set, so the login page asks for one", () => {
    expect(isPasscodeSet()).toBe(false);
    expect(isUnlocked()).toBe(false);
  });

  /**
   * The reason this exists at all rather than shipping with no gate. With no
   * passcode, "who is signed in" has to resolve to somebody or the dashboard is a
   * dead end.
   */
  it("unlocks on setting the first passcode", async () => {
    expect(await setPasscode("hunter2")).toEqual({ ok: true });
    expect(isPasscodeSet()).toBe(true);
    expect(isUnlocked()).toBe(true);
  });

  it("refuses a passcode that is too short", async () => {
    const result = await setPasscode("a".repeat(MIN_PASSCODE_LENGTH - 1));
    expect(result.ok).toBe(false);
    // The point of the check: nothing was written, so this is not a lockout.
    expect(isPasscodeSet()).toBe(false);
  });

  it("does not let a second passcode overwrite the first silently", async () => {
    await setPasscode("first-one");
    const second = await setPasscode("second-one");
    expect(second.ok).toBe(false);

    // And the original still works — a refused overwrite must not have broken it.
    expect(await checkPasscode("first-one")).toEqual({ ok: true });
  });

  it("checks a correct passcode", async () => {
    await setPasscode("correct-horse");
    expect(await checkPasscode("correct-horse")).toEqual({ ok: true });
  });

  /**
   * A wrong guess must not unlock, and must not lock out someone who was already
   * in. Both are one line each here and both are what makes this usable at all.
   */
  it("rejects a wrong one without locking anyone who was already in", async () => {
    await setPasscode("correct-horse");

    const result = await checkPasscode("wrong-one");
    expect(result.ok).toBe(false);
    // setPasscode unlocked on the way in; a failed check must not undo that.
    expect(isUnlocked()).toBe(true);
  });

  /**
   * The whole reason `reset` exists in a real browser: a failed check must not
   * leave someone locked out permanently. Nothing here is destructive.
   */
  it("reports a missing passcode rather than throwing", async () => {
    const result = await checkPasscode("anything");
    expect(result.ok).toBe(false);
  });

  it("never stores the passcode itself", async () => {
    await setPasscode("plaintext-secret");
    const stored = Object.keys(localStorage)
      .map((k) => localStorage.getItem(k) ?? "")
      .join(" ");
    expect(stored).not.toContain("plaintext-secret");
  });

  it("salts, so the same passcode does not store the same string twice", async () => {
    await setPasscode("same-passcode");
    const first = localStorage.getItem("lovebuilds:auth:hash");

    reset();
    await setPasscode("same-passcode");
    const second = localStorage.getItem("lovebuilds:auth:hash");

    expect(first).not.toBe(second);
  });

  it("trims before hashing, so a pasted trailing space is not a wrong passcode", async () => {
    await setPasscode("trimmed");
    expect(await checkPasscode("  trimmed  ")).toEqual({ ok: true });
  });

  /**
   * Regression, and the reason this file exists at all beyond coverage.
   *
   * Unlocking wrote the key but did not notify, so `useSession` never re-read and
   * the login page sat there after the *correct* passcode was accepted. Every test
   * above passed: the storage was genuinely correct. Only clicking through it
   * showed the page did not move.
   *
   * So the assertion is about the subscription, not the storage — it is the one
   * thing that a "did the write happen" test cannot see.
   */
  it("notifies subscribers when the passcode is set", async () => {
    let calls = 0;
    const stop = subscribe(() => {
      calls += 1;
    });

    await setPasscode("notified");
    expect(calls).toBe(1);

    stop();
  });

  it("notifies subscribers when a correct passcode unlocks", async () => {
    await setPasscode("notified");

    let calls = 0;
    const stop = subscribe(() => {
      calls += 1;
    });

    await checkPasscode("notified");
    expect(calls).toBe(1);

    stop();
  });

  it("does not notify on a wrong passcode", async () => {
    await setPasscode("notified");

    let calls = 0;
    const stop = subscribe(() => {
      calls += 1;
    });

    await checkPasscode("wrong");
    expect(calls).toBe(0);

    stop();
  });

  it("stops notifying once unsubscribed, so a dead listener cannot re-render", async () => {
    let calls = 0;
    const stop = subscribe(() => {
      calls += 1;
    });
    stop();

    await setPasscode("unsubscribed");
    expect(calls).toBe(0);
  });
});