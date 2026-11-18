import { describe, expect, it } from "vitest";

import {
  UPLOAD_LIMITS,
  formatBytes,
  formatPixels,
} from "../uploadLimits";

/**
 * The numbers shown in the uploader have to match the ones Cloudinary enforces.
 * They are the Free plan's limits, which is what this deployment uses.
 */
describe("uploadLimits", () => {
  it("caps still images at the Free plan's 10 MB / 25 MP", () => {
    expect(UPLOAD_LIMITS.image.bytes).toBe(10 * 1024 * 1024);
    expect(UPLOAD_LIMITS.image.pixels).toBe(25_000_000);
  });

  it("caps video at 100 MB and has no pixel ceiling", () => {
    expect(UPLOAD_LIMITS.video.bytes).toBe(100 * 1024 * 1024);
    expect(UPLOAD_LIMITS.video.pixels).toBeNull();
  });

  describe("formatBytes", () => {
    it("uses the unit that keeps the number readable", () => {
      expect(formatBytes(940)).toBe("940 B");
      expect(formatBytes(1536)).toBe("2 KB");
      expect(formatBytes(4.8 * 1024 * 1024)).toBe("4.8 MB");
    });

    it("does not print a negative or meaningless size", () => {
      expect(formatBytes(0)).toBe("0 B");
      expect(formatBytes(-1)).toBe("0 B");
      expect(formatBytes(Number.NaN)).toBe("0 B");
    });

    it("rounds kilobytes instead of showing a fraction", () => {
      expect(formatBytes(1024)).toBe("1 KB");
      expect(formatBytes(1023)).toBe("1023 B");
      expect(formatBytes(10 * 1024 * 1024)).toBe("10.0 MB");
    });
  });

  describe("formatPixels", () => {
    it("uses megapixels, because that is how the limit is written", () => {
      expect(formatPixels(25_000_000)).toBe("25.0 MP");
      expect(formatPixels(1_500_000)).toBe("1.5 MP");
    });
  });
});
