import type { MediaKind } from "./schema";

/**
 * The ceilings Cloudinary applies to an uploaded file.
 *
 * These are the Free plan values, which is what this deployment uses: 10 MB
 * and 25 megapixels per image, 100 MB per video. A photo is re-encoded in the
 * browser before it gets here, so a 48 MP camera file normally becomes a
 * ~1 MB WebP and never tests these numbers; they still matter when a format
 * cannot be re-encoded (GIF, for example) or the re-encode fails.
 *
 * If the Cloudinary account moves to Plus or Advanced, change the numbers here.
 * Nothing else hardcodes a limit.
 */
export type UploadLimit = {
  bytes: number;
  /** Width × height for stills. `null` when the kind has no pixel ceiling. */
  pixels: number | null;
};

export const UPLOAD_LIMITS: Record<MediaKind, UploadLimit> = {
  image: { bytes: 10 * 1024 * 1024, pixels: 25_000_000 },
  video: { bytes: 100 * 1024 * 1024, pixels: null },
};

/** A size a person can read at a glance: 4.8 MB, 720 KB, 940 B. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round(bytes)} B`;
}

/** Cloudinary counts megapixels in millions, not mebibytes. */
export function formatPixels(pixels: number): string {
  return `${(pixels / 1_000_000).toFixed(1)} MP`;
}
