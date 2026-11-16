import { apiRequest } from "./apiClient";
import { reauthenticate, removeAccount } from "./auth";

/**
 * Deleting the whole account, in the order that cannot lose data halfway.
 *
 * Three stages, each with its own failure copy, because what a person should
 * do next is different at each one:
 *
 *   1. Re-authenticate — the password field or the Google popup in the
 *      confirm step. Nothing is touched until the owner has proved they are
 *      the owner, so failing here costs nothing.
 *   2. Wipe the account's data — one request, one DELETE on the server, one
 *      statement underneath. It either happens or it does not; a failure
 *      leaves the account exactly as it was.
 *   3. Remove the Firebase identity itself. By this point the data is gone,
 *      so a failure says so plainly rather than implying the account is
 *      still whole.
 *
 * The identity goes last on purpose. Deleting the user first would leave rows
 * in the database pointing at a uid nobody can sign in as — the one outcome
 * the privacy promise cannot afford.
 *
 * This runs against the hosted backend only. There is no account to delete in
 * a local build, and the profile page does not offer the option there.
 */
export type DeleteAccountResult =
  | { ok: true }
  | {
      ok: false;
      /** Which step failed, so a caller (or a test) knows what state things are in. */
      stage: "reauth" | "sites" | "account";
      message: string;
      /** True when the person closed the Google window. A decision, not an error. */
      cancelled?: boolean;
    };

/** `password` is only meaningful for email accounts; Google ignores it. */
export async function deleteAccount(options?: {
  password?: string;
}): Promise<DeleteAccountResult> {
  const reauth = await reauthenticate(options?.password);
  if (!reauth.ok) {
    // `cancelled` is only carried when it is true: the flag marks a closed
    // popup, and `exactOptionalPropertyTypes` keeps an explicit undefined
    // out of the result shape.
    return reauth.cancelled
      ? { ok: false, stage: "reauth", message: reauth.message, cancelled: true }
      : { ok: false, stage: "reauth", message: reauth.message };
  }

  try {
    await apiRequest<{ ok: true; removed: number }>("/account", { method: "DELETE" });
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : "Try again.";
    return {
      ok: false,
      stage: "sites",
      message: `Your sites could not be removed, so nothing has been deleted. ${detail}`,
    };
  }

  const removed = await removeAccount();
  if (!removed.ok) {
    return { ok: false, stage: "account", message: removed.message };
  }

  return { ok: true };
}
