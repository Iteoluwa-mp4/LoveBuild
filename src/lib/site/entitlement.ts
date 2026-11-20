/**
 * Who may make another site.
 *
 * The allowance is deliberately small and boring: every account gets one free
 * site, and every device gets to be the home of one free site. The account rule
 * stops the same person from making a second free site by staying signed in; the
 * device rule stops the much cheaper trick of registering another email on the
 * same phone and starting again.
 *
 * These three facts are raw storage answers, not a policy. `canCreateSite` and
 * `allowanceState` derive the policy in one place, so the form and the shelf
 * cannot disagree about whether the button is a promise or a dead end.
 *
 * This is a deterrent, not phone attestation. A web page cannot read a SIM or a
 * phone number, and a determined person can clear browser storage or use another
 * browser. The next step up is a verified phone number (Firebase Phone Auth) or
 * payment identity; the server seam is already the place that would accept it.
 */

export const FREE_SITES_PER_ACCOUNT = 1;

export type SiteAllowance = {
  /** The account has not used its one free site. */
  freeAvailable: boolean;
  /** Paid-site credits waiting in the account. */
  paidCredits: number;
  /** This browser/device has not already used its free site on another account. */
  deviceAvailable: boolean;
};

export type AllowanceState = "free" | "paid" | "blocked-device" | "blocked-account";

export type AllowanceNotice = {
  title: string;
  body: string;
};

/** Local development has no account to meter, so it keeps the open path. */
export const DEV_ALLOWANCE: SiteAllowance = {
  freeAvailable: true,
  paidCredits: 0,
  deviceAvailable: true,
};

/**
 * The one decision.
 *
 * A paid credit outranks everything: someone who has bought a site may use it
 * on a phone that already gave away its free one. That is the whole point of
 * paying. Free creation needs both the account and the device to be unused.
 */
export function canCreateSite(allowance: SiteAllowance): boolean {
  return allowance.paidCredits > 0 || (allowance.freeAvailable && allowance.deviceAvailable);
}

/** The state the UI should describe, in the order creation actually spends it. */
export function allowanceState(allowance: SiteAllowance): AllowanceState {
  /*
    Free comes first on purpose. The store spends a free site before it touches
    a paid credit, so a form that said "this will use a paid site" while a free
    one was still available would be describing a different transaction.
  */
  if (allowance.freeAvailable && allowance.deviceAvailable) return "free";
  if (allowance.paidCredits > 0) return "paid";
  return allowance.deviceAvailable ? "blocked-account" : "blocked-device";
}

/**
 * How to explain the next creation, or why there isn't one.
 *
 * Kept here rather than in the form because the shelf uses the same words in a
 * shorter form. A device limit and an account limit are genuinely different
 * situations: one can be solved by signing into the account that owns the free
 * site; the other cannot be solved without paying.
 */
export function allowanceNotice(allowance: SiteAllowance): AllowanceNotice | null {
  switch (allowanceState(allowance)) {
    case "free":
      return {
        title: "Your first site is free.",
        body: "This phone will remember that it has been used, so another account on the same phone cannot claim a second free site.",
      };
    case "paid":
      return {
        title:
          allowance.paidCredits === 1
            ? "One paid site is ready."
            : `${allowance.paidCredits} paid sites are ready.`,
        body: "Creating this site will use one paid site from your account.",
      };
    case "blocked-device":
      return {
        title: "This phone has already used its free site.",
        body: "The free site on this phone belongs to the first account that made one. A second site is paid — it can be made on any account.",
      };
    case "blocked-account":
      return {
        title: "Your free site is already used.",
        body: "Every account includes one free site. The next one is paid.",
      };
  }
}
