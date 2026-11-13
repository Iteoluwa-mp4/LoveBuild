import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  UPLOAD_NOT_CONFIGURED,
  UploadError,
  isEphemeralUrl,
  needsReupload,
  uploadAsset,
  uploadConfigured,
} from "../cloudinary";
import type { Media } from "../schema";

/**
 * The one module in the app that talks to the outside world.
 *
 * It cannot be checked by a test that runs the real upload — that needs an
 * account and a network — so what is pinned here is everything *around* the
 * request: when it refuses to start, how a response is read, and how a
 * failure becomes a message a person can act on. Those are the parts that
 * decide whether an author sees "your photo isn't saved and here's why" or a
 * bare `TypeError: Failed to fetch` in the console.
 */
describe("cloudinary", () => {
  const CLOUD = "VITE_CLOUDINARY_CLOUD_NAME";
  const PRESET = "VITE_CLOUDINARY_UPLOAD_PRESET";

  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    /*
      Unit tests must not inherit `.env.local`. Once Cloudinary is configured
      locally, the "unconfigured" cases below would start seeing real values and
      either fail or attempt a network request. Pin both keys empty here; the
      tests that need values stub them explicitly.
    */
    vi.stubEnv(CLOUD, "");
    vi.stubEnv(PRESET, "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const configure = (cloud: string, preset: string) => {
    vi.stubEnv(CLOUD, cloud);
    vi.stubEnv(PRESET, preset);
  };

  describe("uploadConfigured", () => {
    it("is false when nothing has been set, which is the normal case", () => {
      expect(uploadConfigured()).toBe(false);
    });

    it("is false when only one of the two is set", () => {
      vi.stubEnv(CLOUD, "demo-cloud");
      vi.stubEnv(PRESET, "");
      expect(uploadConfigured()).toBe(false);

      vi.stubEnv(CLOUD, "");
      vi.stubEnv(PRESET, "dashboard_unsigned");
      expect(uploadConfigured()).toBe(false);
    });

    it("is true when both are set", () => {
      configure("demo-cloud", "dashboard_unsigned");
      expect(uploadConfigured()).toBe(true);
    });

    it("ignores a value that is only whitespace", () => {
      configure("   ", "dashboard_unsigned");
      expect(uploadConfigured()).toBe(false);
    });
  });

  describe("uploadAsset without configuration", () => {
    it("refuses rather than sending a request that cannot succeed", async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);

      await expect(uploadAsset(new File([], "a.jpg"))).rejects.toBeInstanceOf(UploadError);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    /**
     * The person hitting this has just chosen a photograph. The message has to
     * name the file to edit and say what happens to the picture they can see,
     * because the obvious assumption is that it was saved.
     */
    it("says which file to edit and that the picture will not survive a reload", async () => {
      await expect(uploadAsset(new File([], "a.jpg"))).rejects.toThrow(/\.env\.local/);
      await expect(uploadAsset(new File([], "a.jpg"))).rejects.toThrow(
        /will not survive a reload/,
      );
      expect(UPLOAD_NOT_CONFIGURED).toContain(CLOUD);
      expect(UPLOAD_NOT_CONFIGURED).toContain(PRESET);
    });
  });

  describe("uploadAsset response handling", () => {
    const okResponse = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

    it("keeps only what is worth persisting, and turns seconds into milliseconds", async () => {
      configure("demo-cloud", "dashboard_unsigned");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          okResponse({
            secure_url: "https://res.cloudinary.com/demo-cloud/image/upload/v1/a.jpg",
            public_id: "lovebuilds/abc",
            width: 1600,
            height: 900,
            bytes: 482113,
            // Cloudinary reports duration in seconds; the schema stores ms.
            duration: 12.5,
            // Deliberately ignored: the app has no use for either, and a
            // response carrying more than it needs must not become more than
            // it stores.
            original_filename: "beach.jpg",
            created_at: "2026-10-25T00:00:00Z",
          }),
        ),
      );

      await expect(uploadAsset(new File([], "beach.jpg"))).resolves.toEqual({
        url: "https://res.cloudinary.com/demo-cloud/image/upload/v1/a.jpg",
        publicId: "lovebuilds/abc",
        width: 1600,
        height: 900,
        durationMs: 12500,
      });
    });

    it("reports a still as having no duration rather than zero of it", async () => {
      configure("demo-cloud", "dashboard_unsigned");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          okResponse({
            secure_url: "https://res.cloudinary.com/demo-cloud/image/upload/v1/a.jpg",
            public_id: "lovebuilds/abc",
            width: 800,
            height: 600,
          }),
        ),
      );

      const uploaded = await uploadAsset(new File([], "a.jpg"));
      expect(uploaded.durationMs).toBeNull();
      // `durationMs` is nullable, so null is the honest answer — but 0 would
      // also have passed a truthiness check, which is why it is asserted.
      expect(uploaded.durationMs).not.toBe(0);
    });

    it("surfaces Cloudinary's own reason for rejecting the file", async () => {
      configure("demo-cloud", "dashboard_unsigned");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          json: async () => ({ error: { message: "Invalid upload preset" } }),
        }),
      );

      // Not the HTTP status: "Upload failed (HTTP 400)" would tell them
      // nothing about the preset they need to go fix.
      await expect(uploadAsset(new File([], "a.jpg"))).rejects.toThrow("Invalid upload preset");
    });

    /**
     * A rejection with no `error` object is possible for account-level
     * problems, where Cloudinary's body may not be the usual shape. Falling
     * back to the status keeps the message truthful instead of empty.
     */
    it("falls back to the status when the body carries no message", async () => {
      configure("demo-cloud", "dashboard_unsigned");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }),
      );

      await expect(uploadAsset(new File([], "a.jpg"))).rejects.toThrow(/HTTP 401/);
    });

    it("does not treat a 200 as success if the address came back missing", async () => {
      configure("demo-cloud", "dashboard_unsigned");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(okResponse({ public_id: "lovebuilds/abc" })),
      );

      await expect(uploadAsset(new File([], "a.jpg"))).rejects.toThrow(
        /did not return an address/,
      );
    });

    it("turns an unreachable network into something to retry, not a stack trace", async () => {
      configure("demo-cloud", "dashboard_unsigned");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
      );

      await expect(uploadAsset(new File([], "a.jpg"))).rejects.toThrow(
        /Could not reach Cloudinary/,
      );
    });

    it("handles an unreadable reply without leaking a JSON parse error", async () => {
      configure("demo-cloud", "dashboard_unsigned");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => { throw new SyntaxError("Unexpected token"); } }),
      );

      await expect(uploadAsset(new File([], "a.jpg"))).rejects.toThrow(/unreadable/);
    });

    it("posts the file and the preset to the configured cloud", async () => {
      configure("demo-cloud", "dashboard_unsigned");
      const fetchSpy = vi.fn().mockResolvedValue(
        okResponse({ secure_url: "https://x/a.jpg", public_id: "p" }),
      );
      vi.stubGlobal("fetch", fetchSpy);

      const file = new File(["bytes"], "a.jpg", { type: "image/jpeg" });
      await uploadAsset(file);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://api.cloudinary.com/v1_1/demo-cloud/auto/upload");
      expect(init.method).toBe("POST");
      const form = init.body as FormData;
      expect(form.get("upload_preset")).toBe("dashboard_unsigned");
      expect(form.get("file")).toBe(file);
    });
  });

  /**
   * The distinction the whole media step rests on. `data:` was considered and
   * rejected: it carries its own bytes, so it survives a reload, and flagging
   * it would report a working image as broken.
   */
  describe("isEphemeralUrl", () => {
    it("names a blob URL as dead after a reload", () => {
      expect(isEphemeralUrl("blob:https://lovebuilds.test/0f8e")).toBe(true);
      expect(isEphemeralUrl("  blob:https://lovebuilds.test/0f8e  ")).toBe(true);
    });

    it("leaves a delivered URL and a data URL alone", () => {
      expect(isEphemeralUrl("https://res.cloudinary.com/demo/image/upload/a.jpg")).toBe(false);
      expect(isEphemeralUrl("data:image/svg+xml,")).toBe(false);
      expect(isEphemeralUrl("")).toBe(false);
    });
  });

  describe("needsReupload", () => {
    const withUrl = (url: string): Media => ({
      id: "i",
      publicId: null,
      url,
      alt: "",
      caption: "",
      width: null,
      height: null,
      durationMs: null,
    });

    it("is true only for a URL that used to work", () => {
      expect(needsReupload(withUrl("blob:https://lovebuilds.test/0f8e"))).toBe(true);
      expect(needsReupload(withUrl("https://res.cloudinary.com/demo/image/upload/a.jpg"))).toBe(
        false,
      );
      // Empty is a separate case with its own message in the to-do list:
      // "has no file yet", not "needs re-uploading".
      expect(needsReupload(withUrl(""))).toBe(false);
    });
  });
});
