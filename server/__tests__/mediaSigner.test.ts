import { describe, expect, it } from "vitest";

import {
  createCloudinarySigner,
  deliverySignature,
  MEDIA_UNCONFIGURED_MESSAGE,
  uploadSignature,
} from "../mediaSigner";
import { ApiError } from "../errors";

/**
 * The signatures are the security boundary, so they are pinned to Cloudinary's
 * own published examples rather than to whatever this implementation happens
 * to produce. A refactor that changes the algorithm must fail here first.
 */
describe("media signer", () => {
  describe("uploadSignature", () => {
    it("matches Cloudinary's minimal timestamp example", async () => {
      await expect(uploadSignature({ timestamp: 1315060510 }, "abcd")).resolves.toBe(
        "a21ad0f63beb4de2e5575204b79ab90bffb02c10",
      );
    });

    it("sorts fields by name and excludes nothing by accident", async () => {
      await expect(
        uploadSignature(
          {
            timestamp: 1315060510,
            public_id: "sample_image",
            eager: "w_400,h_300,c_pad|w_260,h_200,c_crop",
          },
          "abcd",
        ),
      ).resolves.toBe("bfd09f95f331f558cbd1320e67aa8d488770583e");
    });
  });

  describe("deliverySignature", () => {
    it("matches Cloudinary's transformation example", async () => {
      await expect(
        deliverySignature(
          "c_fill,w_300,h_250/e_grayscale/sample-authenticated.png",
          "abcd",
        ),
      ).resolves.toBe("iDy_JeBq");
    });
  });

  describe("createCloudinarySigner", () => {
    const env = {
      CLOUDINARY_CLOUD_NAME: "demo-cloud",
      CLOUDINARY_API_KEY: "public-key",
      CLOUDINARY_API_SECRET: "abcd",
    };

    it("issues a one-hour upload credential for a server-chosen public id", async () => {
      const signer = createCloudinarySigner({
        env,
        now: () => 1315060510_000,
        randomId: () => "abc",
      });

      await expect(signer.signUpload("image")).resolves.toEqual({
        apiKey: "public-key",
        uploadUrl: "https://api.cloudinary.com/v1_1/demo-cloud/image/upload",
        timestamp: 1315060510,
        publicId: "lovebuilds/abc",
        type: "authenticated",
        signature: "630f532e120dbe8a6529b553e790c08291206fc5",
      });
    });

    it("uses the video endpoint when the picker chose a video", async () => {
      const signer = createCloudinarySigner({ env, randomId: () => "clip" });
      const signed = await signer.signUpload("video");
      expect(signed.uploadUrl).toContain("/video/upload");
    });

    it("builds a long-lived authenticated delivery URL", async () => {
      const signer = createCloudinarySigner({ env });
      await expect(signer.signDelivery("image", "lovebuilds/abc", "JPG")).resolves.toBe(
        "https://res.cloudinary.com/demo-cloud/image/authenticated/s--sFYnluWA--/lovebuilds/abc.jpg",
      );
    });

    it("accepts the VITE_ cloud name as a server fallback", async () => {
      const signer = createCloudinarySigner({
        env: {
          // An empty alias (as copied from `.env.example`) must not shadow it.
          CLOUDINARY_CLOUD_NAME: "",
          VITE_CLOUDINARY_CLOUD_NAME: "demo-cloud",
          CLOUDINARY_API_KEY: "public-key",
          CLOUDINARY_API_SECRET: "abcd",
        },
      });
      expect(signer.configured).toBe(true);
    });

    it("fails closed when any setting is missing", async () => {
      const signer = createCloudinarySigner({
        env: { CLOUDINARY_CLOUD_NAME: "demo-cloud", CLOUDINARY_API_KEY: "public-key" },
      });

      expect(signer.configured).toBe(false);
      await expect(signer.signUpload("image")).rejects.toMatchObject({
        status: 503,
        code: "media-unconfigured",
        message: MEDIA_UNCONFIGURED_MESSAGE,
      } satisfies Partial<ApiError>);
    });
  });
});
