import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDraft } from "../default";
import { LocalSiteRepository } from "../localRepository";

/**
 * A minimal localStorage for the test runner.
 *
 * Vitest runs in Node, where localStorage does not exist. The repository only
 * touches it inside methods, so installing this before constructing one is
 * enough to exercise the real storage code rather than a mock of it.
 */
class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    value: new MemoryStorage(),
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LocalSiteRepository.create", () => {
  it("keeps the requested slug when it is free", async () => {
    const repository = new LocalSiteRepository();
    const created = await repository.create(createDraft("for-sarah"));

    expect(created.slug).toBe("for-sarah");
    expect((await repository.get("for-sarah"))?.slug).toBe("for-sarah");
  });

  it("suffixes on collision and keeps both sites", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const repository = new LocalSiteRepository();

    const first = await repository.create(createDraft("for-sarah"));
    const second = await repository.create(createDraft("for-sarah"));

    expect(first.slug).toBe("for-sarah");
    expect(second.slug).toBe("for-sarah-i000");
    expect(await repository.get(first.slug)).not.toBeNull();
    expect(await repository.get(second.slug)).not.toBeNull();
    expect((await repository.list()).length).toBe(2);
  });
});

describe("LocalSiteRepository.save", () => {
  it("updates an existing site", async () => {
    const repository = new LocalSiteRepository();
    const created = await repository.create(createDraft("for-sarah"));

    await repository.save({
      ...created,
      identity: { ...created.identity, name: "For Sarah" },
    });

    expect((await repository.get("for-sarah"))?.identity.name).toBe("For Sarah");
  });

  it("refuses to create a site by saving a missing slug", async () => {
    const repository = new LocalSiteRepository();

    await expect(repository.save(createDraft("ghost"))).rejects.toMatchObject({
      code: "not-found",
    });
    expect(await repository.get("ghost")).toBeNull();
  });
});

describe("LocalSiteRepository publishing", () => {
  it("hides a draft from the public read and shows it once published", async () => {
    const repository = new LocalSiteRepository();
    await repository.create(createDraft("for-sarah"));

    expect(await repository.getPublic("for-sarah")).toBeNull();

    await repository.setStatus("for-sarah", "published");
    expect(await repository.getPublic("for-sarah")).not.toBeNull();
  });
});
