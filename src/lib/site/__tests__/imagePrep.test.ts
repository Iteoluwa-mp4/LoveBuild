import { describe, expect, it } from "vitest";

import {
  IMAGE_MAX_EDGE,
  isReencodableImage,
  outputName,
  scaledSize,
} from "../imagePrep";

/**
 * The pure half of image preparation.
 *
 * `prepareImage` itself needs a browser: it decodes with `createImageBitmap` and
 * encodes through a canvas. Everything the caller makes decisions with — the
 * target dimensions, the output filename, which files are safe to touch — is a
 * plain function, so it is tested here without a fake DOM.
 */
describe("imagePrep", () => {
  describe("scaledSize", () => {
    it("leaves an image inside the limit at its original size", () => {
      expect(scaledSize(1600, 900)).toEqual({ width: 1600, height: 900 });
    });

    it("fits a landscape photo by its longest edge", () => {
      expect(scaledSize(6000, 4000)).toEqual({
        width: IMAGE_MAX_EDGE,
        height: 1707,
      });
    });

    it("fits a portrait photo by its longest edge", () => {
      expect(scaledSize(4000, 6000)).toEqual({
        width: 1707,
        height: IMAGE_MAX_EDGE,
      });
    });

    it("preserves a square's shape", () => {
      expect(scaledSize(5000, 5000)).toEqual({
        width: IMAGE_MAX_EDGE,
        height: IMAGE_MAX_EDGE,
      });
    });

    it("never returns a zero edge after rounding", () => {
      expect(scaledSize(10_000, 1)).toEqual({
        width: IMAGE_MAX_EDGE,
        height: 1,
      });
    });

    it("accepts a caller-supplied edge", () => {
      expect(scaledSize(1000, 500, 100)).toEqual({ width: 100, height: 50 });
    });

    it("reports unreadable dimensions as zero rather than guessing", () => {
      expect(scaledSize(0, 100)).toEqual({ width: 0, height: 0 });
      expect(scaledSize(100, 0)).toEqual({ width: 0, height: 0 });
      expect(scaledSize(Number.NaN, 100)).toEqual({ width: 0, height: 0 });
      expect(scaledSize(Number.POSITIVE_INFINITY, 100)).toEqual({
        width: 0,
        height: 0,
      });
      expect(scaledSize(100, 100, 0)).toEqual({ width: 0, height: 0 });
    });
  });

  describe("outputName", () => {
    it("replaces the extension with the encoded format", () => {
      expect(outputName("beach.JPG", "image/webp")).toBe("beach.webp");
      expect(outputName("beach.jpeg", "image/jpeg")).toBe("beach.jpg");
      expect(outputName("beach.png", "image/png")).toBe("beach.png");
    });

    it("keeps dots that are part of the name", () => {
      expect(outputName("beach.sunset.2026.jpg", "image/webp")).toBe(
        "beach.sunset.2026.webp",
      );
    });

    it("adds an extension when the picked file had none", () => {
      expect(outputName("photo", "image/jpeg")).toBe("photo.jpg");
    });

    it("does not leave a blank name", () => {
      expect(outputName(".jpg", "image/webp")).toBe("photo.webp");
      expect(outputName("   ", "image/jpeg")).toBe("photo.jpg");
    });
  });

  describe("isReencodableImage", () => {
    const file = (type: string) => new File(["bytes"], "a.bin", { type });

    it("accepts still photo formats", () => {
      expect(isReencodableImage(file("image/jpeg"))).toBe(true);
      expect(isReencodableImage(file("image/png"))).toBe(true);
      expect(isReencodableImage(file("image/webp"))).toBe(true);
      expect(isReencodableImage(file("image/avif"))).toBe(true);
      expect(isReencodableImage(file("image/heic"))).toBe(true);
    });

    it("leaves formats whose frames a canvas would flatten", () => {
      expect(isReencodableImage(file("image/gif"))).toBe(false);
    });

    it("leaves vector files alone", () => {
      expect(isReencodableImage(file("image/svg+xml"))).toBe(false);
    });

    it("is not for videos", () => {
      expect(isReencodableImage(file("video/mp4"))).toBe(false);
    });
  });
});
