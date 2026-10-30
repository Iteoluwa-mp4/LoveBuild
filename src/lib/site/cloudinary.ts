import type { Media } from "./schema";

/**
 * Uploading files to Cloudinary.
 *
 * This exists because the app used to persist a `blob:` URL for every picture.
 * A blob URL is bound to the document that created it, so it died with the tab
 * that made it — the config saved cleanly, and on reload every photograph was a
 * broken image. Storing a URL you know to be dead is worse than storing none,
 * so the rule this module enforces is: **persist nothing that does not resolve.**
 *
 * ## Configuration
 *
 * Read from the environment on every call rather than captured at import, so a
 * test can set them and because Vite inlines them anyway — there is no cost to
 * re-reading and there is a cost to freezing them early.
 *
 * Both values are public and necessarily so: the cloud name appears in every
 * delivery URL, and an unsigned preset has to ship to the browser in order to
 * be used from the browser. That is the trade for having no server. What is
 * *not* here is any secret — `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`
 * are deliberately unprefixed so Vite will not compile them into the bundle,
 * and nothing in this file reads them.
 *
 * ## Why "auto" and not image/ or video/
 *
 * The dashboard's uploader accepts both, and the caller knows which only from
 * the file's MIME type. `auto/upload` lets Cloudinary detect it from the bytes,
 * which is also what handles the awkward case where a file's extension and its
 * actual type disagree.
 */

/**
 * What an upload gives back.
 *
 * Deliberately not a `Media`: the caller already has one, and its `id` is the
 * stable React key the form is keyed on. Spreading these over the existing
 * object keeps that id, so an upload never remounts the field it was started
 * from.
 */
export type UploadedMedia = {
  /** The delivered URL. Resolves, unlike the blob it replaces. */
  url: string;
  /** Cloudinary asset id — needed to replace or delete the asset later. */
  publicId: string;
  width: number | null;
  height: number | null;
  /** Video length in milliseconds; null for stills. */
  durationMs: number | null;
};

/** An upload that failed in a way worth showing a human. */
export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

const CLOUD_NAME_KEY = "VITE_CLOUDINARY_CLOUD_NAME";
const PRESET_KEY = "VITE_CLOUDINARY_UPLOAD_PRESET";

/** True when the environment is set up enough to attempt an upload. */
export function uploadConfigured(): boolean {
  const { cloudName, preset } = readConfig();
  return Boolean(cloudName && preset);
}

/**
 * The message shown when uploads are not set up.
 *
 * Names the file to edit rather than saying "not configured", because the
 * person reading it is partway through adding a photograph and needs to know
 * what to do next.
 */
export const UPLOAD_NOT_CONFIGURED =
  "This browser has no Cloudinary settings, so the file cannot be kept. " +
  `Copy .env.example to .env.local and set ${CLOUD_NAME_KEY} and ${PRESET_KEY}, ` +
  "then reload. The picture above is a preview only and will not survive a reload.";

function readConfig(): { cloudName: string; preset: string } {
  const env = import.meta.env as Record<string, string | undefined>;
  return {
    cloudName: (env[CLOUD_NAME_KEY] ?? "").trim(),
    preset: (env[PRESET_KEY] ?? "").trim(),
  };
}

/** What Cloudinary returns, success or failure. */
type UploadResponse = {
  error?: { message?: string };
  secure_url?: string;
  public_id?: string;
  width?: number;
  height?: number;
  /** Seconds. Present for video and audio only. */
  duration?: number;
};

/**
 * Uploads one file and returns the fields worth persisting.
 *
 * Throws `UploadError` with a message written for the person who picked the
 * file. A raw `TypeError: Failed to fetch` tells them nothing they can act on,
 * and a Cloudinary constraint error ("Invalid upload preset") is exactly the
 * thing they need to see.
 */
export async function uploadAsset(file: File): Promise<UploadedMedia> {
  const { cloudName, preset } = readConfig();

  if (!cloudName || !preset) throw new UploadError(UPLOAD_NOT_CONFIGURED);

  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", preset);

  let response: Response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
      method: "POST",
      body,
    });
  } catch {
    throw new UploadError("Could not reach Cloudinary. Check the connection and try again.");
  }

  let payload: UploadResponse;
  try {
    payload = (await response.json()) as UploadResponse;
  } catch {
    throw new UploadError(`Cloudinary replied with something unreadable (HTTP ${response.status}).`);
  }

  // The error object and the HTTP status can disagree — Cloudinary returns 400
  // for most rejections, but an account problem may not — so both are checked
  // and the service's own message wins, because it is the one that says why.
  if (payload.error || !response.ok) {
    throw new UploadError(
      payload.error?.message?.trim() || `Upload failed (HTTP ${response.status}).`,
    );
  }

  if (!payload.secure_url || !payload.public_id) {
    throw new UploadError("Cloudinary accepted the file but did not return an address for it.");
  }

  const number = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) ? value : null;

  const durationSeconds = number(payload.duration);

  return {
    // The original, not a derived one. `f_auto,q_auto` would shrink a 12 MB
    // photograph down to something a phone can actually load, and it is the
    // obvious next step — but it is a delivery change layered on top of the
    // correctness fix, and this URL is the one that is known to work.
    url: payload.secure_url,
    publicId: payload.public_id,
    width: number(payload.width),
    height: number(payload.height),
    durationMs: durationSeconds === null ? null : Math.round(durationSeconds * 1000),
  };
}

/**
 * True when a stored URL resolves only inside the tab that created it.
 *
 * `blob:` and nothing else. A `data:` URL was deliberately considered and
 * rejected: it carries its own bytes, so it survives a reload and persists
 * correctly — flagging it would report a working image as broken.
 */
export function isEphemeralUrl(url: string): boolean {
  return url.trim().startsWith("blob:");
}

/**
 * Whether a `Media` is holding something the dashboard should re-upload.
 *
 * Separate from "empty" on purpose: an empty slot is obviously empty, while a
 * `blob:` URL looks like a working image right up until somebody reloads. They
 * fail differently and need to be reported differently.
 */
export function needsReupload(media: Media): boolean {
  return media.url.trim().length > 0 && isEphemeralUrl(media.url);
}
