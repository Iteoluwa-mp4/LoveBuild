import { describe, expect, it } from "vitest";

import {
  allowanceNotice,
  allowanceState,
  canCreateSite,
  type SiteAllowance,
} from "../entitlement";

const allowance = (overrides: Partial<SiteAllowance> = {}): SiteAllowance => ({
  freeAvailable: true,
  paidCredits: 0,
  deviceAvailable: true,
  ...overrides,
});

describe("site allowance", () => {
  it("allows the first free site", () => {
    expect(canCreateSite(allowance())).toBe(true);
    expect(allowanceState(allowance())).toBe("free");
    expect(allowanceNotice(allowance())?.title).toMatch(/first site is free/i);
  });

  it("blocks a second site when the account is spent", () => {
    const used = allowance({ freeAvailable: false });
    expect(canCreateSite(used)).toBe(false);
    expect(allowanceState(used)).toBe("blocked-account");
    expect(allowanceNotice(used)?.title).toMatch(/free site is already used/i);
  });

  it("blocks a new email on a phone that already gave away its free site", () => {
    const shared = allowance({ deviceAvailable: false });
    expect(canCreateSite(shared)).toBe(false);
    expect(allowanceState(shared)).toBe("blocked-device");
    expect(allowanceNotice(shared)?.title).toMatch(/phone/i);
  });

  it("spends the free site before a paid credit", () => {
    const both = allowance({ paidCredits: 2 });
    expect(canCreateSite(both)).toBe(true);
    expect(allowanceState(both)).toBe("free");
  });

  it("lets a paid credit outrank a used account and a used phone", () => {
    const paid = allowance({
      freeAvailable: false,
      paidCredits: 2,
      deviceAvailable: false,
    });
    expect(canCreateSite(paid)).toBe(true);
    expect(allowanceState(paid)).toBe("paid");
    expect(allowanceNotice(paid)?.title).toMatch(/2 paid sites/i);
  });

  it("shows the device problem before the account problem", () => {
    const both = allowance({ freeAvailable: false, deviceAvailable: false });
    expect(allowanceState(both)).toBe("blocked-device");
  });
});
