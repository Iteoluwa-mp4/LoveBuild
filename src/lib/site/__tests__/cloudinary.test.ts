import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "../apiClient";
import {
  UPLOAD_NOT_CONFIGURED,
  UploadError,
  isEphemeralUrl,
  needsReupload,
  uploadAsset,
  uploadConfigured,
} from "../cloudinary";
import type { Media } from "../schema";

vi.mock("../apiClient", () => ({ apiRequest: vi.fn() }));

/**
 * The browser half of the upload path.
 *
 * The real Cloudinary upload cannot run here — it needs an account and a
 * network — so this pins everything around it: when it refuses to start, what
 * it asks the API to sign, which fields it sends to Cloudinary, how a response
 * is read, and how a failure becomes a message a person can act on.
 */
describe("cloudinary", () => {
  const CLOUD = "VITE_CLOUDINARY_CLOUD_NAME";
  const request = vi.mocked(apiRequest);

  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    request.mockReset();
    /*
      Unit tests must not inherit `.env.local`. Once Cloudinary is configured
      locally, the "unconfigured" cases below would start seeing a real value.
    */
    vi.stubEnv(CLOUD, "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const configure = (cloud = "demo-cloud") => vi.stubEnv(CLOUD, cloud);

  const signedUpload = (kind: "image" | "video" = "image") => ({
    apiKey: "public-key",
    uploadUrl: `https://api.cloudinary.com/v1_1/demo-cloud/${kind}/upload`,
    timestamp: 1_700_000_000,
    publicId: "lovebuilds/abc",
    type: "authenticated" as const,
    signature: "upload-signature",
  });

  const okResponse = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

  describe("uploadConfigured", () => {
    it("is false when the cloud name is unset, which is the normal no-project case", () => {
      expect(uploadConfigured()).toBe(false);
    });

    it("ignores whitespace", () => {
      configure("   ");
      expect(uploadConfigured()).toBe(false);
    });

    it("is true when a cloud name is present", () => {
      configure();
      expect(uploadConfigured()).toBe(true);
    });
  });

  describe("uploadAsset without configuration", () => {
    it("refuses rather than asking the API for a signature that cannot be used", async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);

      await expect(uploadAsset(new File([], "a.jpg"))).rejects.toBeInstanceOf(UploadError);
      expect(request).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    /**
     * The person hitting this has just chosen a photograph. The message has to
     * say what happens to the picture they can see, because the obvious
     * assumption is that it was saved.
     */
    it("names the settings and says the picture will not survive a reload", async () => {
      await expect(uploadAsset(new File([], "a.jpg"))).rejects.toThrow(/\.env|server environment/);
      await expect(uploadAsset(new File([], "a.jpg"))).rejects.toThrow(
        /will not survive a reload/,
      );
      expect(UPLOAD_NOT_CONFIGURED).toContain(CLOUD);
      expect(UPLOAD_NOT_CONFIGURED).toContain("CLOUDINARY_API_KEY");
    });
  });

  describe("uploadAsset with a signed upload", () => {
    it("signs, uploads with type=authenticated, then stores a signed delivery URL", async () => {
      configure();
      request
        .mockResolvedValueOnce(signedUpload("image"))
        .mockResolvedValueOnce({
          url: "https://res.cloudinary.com/demo-cloud/image/authenticated/s--sig--/lovebuilds/abc.jpg",
        });

      const fetchSpy = vi.fn().mockResolvedValue(
        okResponse({
          public_id: "lovebuilds/abc",
          format: "jpg",
          width: 1600,
          height: 900,
          duration: 12.5,
          // Deliberately ignored: the app never persists Cloudinary's unsigned
          // `secure_url`, because it would not be protected.
          secure_url: "https://res.cloudinary.com/demo-cloud/image/upload/v1/a.jpg",
        }),
      );
      vi.stubGlobal("fetch", fetchSpy);

      const file = new File(["bytes"], "beach.jpg", { type: "image/jpeg" });
      await expect(uploadAsset(file, "image")).resolves.toEqual({
        url: "https://res.cloudinary.com/demo-cloud/image/authenticated/s--sig--/lovebuilds/abc.jpg",
        publicId: "lovebuilds/abc",
        width: 1600,
        height: 900,
        durationMs: 12500,
      });

      expect(request).toHaveBeenNthCalledWith(1, "/media/sign-upload", {
        method: "POST",
        body: JSON.stringify({ kind: "image" }),
      });
      expect(request).toHaveBeenNthCalledWith(2, "/media/sign-delivery", {
        method: "POST",
        body: JSON.stringify({
          kind: "image",
          publicId: "lovebuilds/abc",
          format: "jpg",
        }),
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://api.cloudinary.com/v1_1/demo-cloud/image/upload");
      expect(init.method).toBe("POST");

      const form = init.body as FormData;
      expect(form.get("file")).toBe(file);
      expect(form.get("api_key")).toBe("public-key");
      expect(form.get("timestamp")).toBe("1700000000");
      expect(form.get("public_id")).toBe("lovebuilds/abc");
      expect(form.get("type")).toBe("authenticated");
      expect(form.get("signature")).toBe("upload-signature");
      // The old unsigned flow's credential must not survive anywhere.
      expect(form.get("upload_preset")).toBeNull();
    });

    it("uses the video upload endpoint and keeps duration in milliseconds", async () => {
      configure();
      request
        .mockResolvedValueOnce(signedUpload("video"))
        .mockResolvedValueOnce({
          url: "https://res.cloudinary.com/demo-cloud/video/authenticated/s--sig--/lovebuilds/abc.mp4",
        });

      const fetchSpy = vi.fn().mockResolvedValue(
        okResponse({
          public_id: "lovebuilds/abc",
          format: "mp4",
          width: 1920,
          height: 1080,
          duration: 12.5,
        }),
      );
      vi.stubGlobal("fetch", fetchSpy);

      const file = new File(["bytes"], "clip.mp4", { type: "video/mp4" });
      const uploaded = await uploadAsset(file);

      expect(request).toHaveBeenNthCalledWith(1, "/media/sign-upload", {
        method: "POST",
        body: JSON.stringify({ kind: "video" }),
      });
      expect((fetchSpy.mock.calls[0] as [string])[0]).toBe(
        "https://api.cloudinary.com/v1_1/demo-cloud/video/upload",
      );
      expect(uploaded.durationMs).toBe(12500);
    });

    it("reports a still as having no duration rather than zero of it", async () => {
      configure();
      request
        .mockResolvedValueOnce(signedUpload())
        .mockResolvedValueOnce({ url: "https://res.cloudinary.com/a.jpg" });
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          okResponse({ public_id: "lovebuilds/abc", format: "jpg", width: 800, height: 600 }),
        ),
      );

      const uploaded = await uploadAsset(new File([], "a.jpg"));
      expect(uploaded.durationMs).toBeNull();
      // `durationMs` is nullable, so null is the honest answer — but 0 would
      // also have passed a truthiness check, which is why it is asserted.
      expect(uploaded.durationMs).not.toBe(0);
    });

    it("surfaces the API's reason when it will not sign the upload", async () => {
      configure();
      request.mockRejectedValueOnce(new Error("Uploads are not configured on this server."));

      await expect(uploadAsset(new File([], "a.jpg"))).rejects.toThrow(
        "Uploads are not configured on this server.",
      );
    });

    it("turns a missing session into a sentence about signing in", async () => {
      configure();
      request.mockRejectedValueOnce(new Error("Sign in to continue."));

      await expect(uploadAsset(new File([], "a.jpg"))).rejects.toThrow(
        /Sign in to upload photos and videos/,
      );
    });

    it("surfaces Cloudinary's own reason for rejecting the file", async () => {
      configure();
      request.mockResolvedValueOnce(signedUpload());
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          json: async () => ({ error: { message: "Invalid signature" } }),
        }),
      );

      // Not the HTTP status: "Upload failed (HTTP 400)" would tell them
      // nothing about the signature that needs to be regenerated.
      await expect(uploadAsset(new File([], "a.jpg"))).rejects.toThrow("Invalid signature");
    });

    it("falls back to the status when the body carries no message", async () => {
      configure();
      request.mockResolvedValueOnce(signedUpload());
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }),
      );

      await expect(uploadAsset(new File([], "a.jpg"))).rejects.toThrow(/HTTP 401/);
    });

    it("does not treat a 200 as success if the delivery details came back missing", async () => {
      configure();
      request.mockResolvedValueOnce(signedUpload());
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(okResponse({ public_id: "lovebuilds/abc" })),
      );

      await expect(uploadAsset(new File([], "a.jpg"))).rejects.toThrow(
        /did not return enough information/,
      );
    });

    it("reports a failed delivery signature instead of storing an unsigned URL", async () => {
      configure();
      request
        .mockResolvedValueOnce(signedUpload())
        .mockRejectedValueOnce(new Error("Your session has expired. Sign in again."));
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          okResponse({ public_id: "lovebuilds/abc", format: "jpg" }),
        ),
      );

      await expect(uploadAsset(new File([], "a.jpg"))).rejects.toThrow(
        /session has expired/,
      );
    });

    it("turns an unreachable network into something to retry, not a stack trace", async () => {
      configure();
      request.mockResolvedValueOnce(signedUpload());
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
      );

      await expect(uploadAsset(new File([], "a.jpg"))).rejects.toThrow(
        /Could not reach Cloudinary/,
      );
    });

    it("handles an unreadable reply without leaking a JSON parse error", async () => {
      configure();
      request.mockResolvedValueOnce(signedUpload());
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => {
            throw new SyntaxError("Unexpected token");
          },
        }),
      );

      await expect(uploadAsset(new File([], "a.jpg"))).rejects.toThrow(/unreadable/);
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
      expect(
        needsReupload(
          withUrl("https://res.cloudinary.com/demo/image/authenticated/s--sig--/a.jpg"),
        ),
      ).toBe(false);
      // Empty is a separate case with its own message in the to-do list:
      // "has no file yet", not "needs re-uploading".
      expect(needsReupload(withUrl(""))).toBe(false);
    });
  });
});
