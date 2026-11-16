import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteAccount } from "../account";
import { apiRequest } from "../apiClient";
import { reauthenticate, removeAccount } from "../auth";
import { SaveError } from "../repository";

vi.mock("../apiClient", () => ({ apiRequest: vi.fn() }));
vi.mock("../auth", () => ({ reauthenticate: vi.fn(), removeAccount: vi.fn() }));

/**
 * The delete-account sequence, with Firebase and the API as stand-ins.
 *
 * What matters here is the order and the stopping: the identity must never be
 * removed before the data, and each stage must fail without attempting the
 * next. Copy is asserted only where it carries state — "nothing has been
 * deleted" and "your sites are already deleted" are promises to the person
 * reading them, not phrasing.
 */
describe("deleteAccount", () => {
  const reauth = vi.mocked(reauthenticate);
  const wipe = vi.mocked(apiRequest);
  const identity = vi.mocked(removeAccount);

  /** Every stage appends its name, so one array asserts the whole order. */
  let calls: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    calls = [];

    reauth.mockImplementation(async () => {
      calls.push("reauth");
      return { ok: true };
    });
    wipe.mockImplementation(async () => {
      calls.push("wipe");
      return { ok: true, removed: 1 };
    });
    identity.mockImplementation(async () => {
      calls.push("identity");
      return { ok: true };
    });
  });

  it("re-authenticates, wipes the data, then removes the identity", async () => {
    await expect(deleteAccount({ password: "correct horse" })).resolves.toEqual({ ok: true });

    expect(calls).toEqual(["reauth", "wipe", "identity"]);
    expect(reauth).toHaveBeenCalledWith("correct horse");
    expect(wipe).toHaveBeenCalledWith("/account", { method: "DELETE" });
    expect(identity).toHaveBeenCalledTimes(1);
  });

  it("stops at the password when it does not match, having deleted nothing", async () => {
    reauth.mockImplementation(async () => {
      calls.push("reauth");
      return { ok: false, message: "That password didn't match. Nothing has been deleted." };
    });

    const result = await deleteAccount({ password: "wrong" });

    expect(calls).toEqual(["reauth"]);
    expect(result).toEqual({
      ok: false,
      stage: "reauth",
      message: "That password didn't match. Nothing has been deleted.",
    });
    expect(wipe).not.toHaveBeenCalled();
    expect(identity).not.toHaveBeenCalled();
  });

  it("treats a closed Google window as a decision, not an error", async () => {
    reauth.mockImplementation(async () => {
      calls.push("reauth");
      return { ok: false, message: "", cancelled: true };
    });

    const result = await deleteAccount();

    expect(calls).toEqual(["reauth"]);
    expect(result).toEqual({ ok: false, stage: "reauth", message: "", cancelled: true });
    expect(wipe).not.toHaveBeenCalled();
    expect(identity).not.toHaveBeenCalled();
  });

  it("keeps the account whole when the wipe fails", async () => {
    wipe.mockImplementation(async () => {
      calls.push("wipe");
      throw new SaveError("Could not reach storage. Check your connection and try again.");
    });

    const result = await deleteAccount();

    expect(calls).toEqual(["reauth", "wipe"]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.stage).toBe("sites");
    expect(result.message).toContain("nothing has been deleted");
    expect(result.message).toContain("Could not reach storage");
    expect(identity).not.toHaveBeenCalled();
  });

  it("says what state things are in when the identity removal fails", async () => {
    identity.mockImplementation(async () => {
      calls.push("identity");
      return {
        ok: false,
        message:
          "Your sites are already deleted — the account is still here. Try again.",
      };
    });

    const result = await deleteAccount();

    expect(calls).toEqual(["reauth", "wipe", "identity"]);
    expect(result).toEqual({
      ok: false,
      stage: "account",
      message: "Your sites are already deleted — the account is still here. Try again.",
    });
  });
});
