import { apiRequest } from "./apiClient";
import type { Media, MediaKind } from "./schema";

/**
 * Uploading files to Cloudinary.
 *
 * This exists because the app used to persist a `blob:` URL for every picture.
 * A blob URL is bound to the document that created it, so it died with the tab
 * that made it — the config saved cleanly, and on reload every photograph was a
 * broken image. Storing a URL you know to be dead is worse than storing none,
 * so the rule this module enforces is: **persist nothing that does not resolve.**
 *
 * ## Signed, not unsigned
 *
 * The browser no longer posts to an unsigned preset. It asks the API for a
 * one-hour upload signature, sends the file to Cloudinary's upload endpoint
 * with `type=authenticated`, and asks the API for a signed delivery URL for the
 * new asset. The
 * API secret never reaches the bundle, and an anonymous visitor cannot use the
 * cloud as free storage.
 *
 * The delivery URL is long-lived and bearer-style: it cannot be transformed or
 * guessed, but anyone given it can view the asset. That is the accepted trade
 * for media that works in a plain `<img>` and survives a reload.
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
  /** The signed delivery URL. Resolves, unlike the blob it replaces. */
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

/** True when this build knows which Cloudinary cloud to talk to. */
export function uploadConfigured(): boolean {
  return Boolean(readCloudName());
}

/**
 * The message shown when uploads are not set up.
 *
 * Names the setting rather than saying "not configured", because the person
 * reading it is partway through adding a photograph and needs to know what to
 * do next. The server keys are named too: a cloud name alone cannot sign.
 */
export const UPLOAD_NOT_CONFIGURED =
  "This build has no Cloudinary cloud name, so the file cannot be kept. " +
  `Set ${CLOUD_NAME_KEY} and add CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET ` +
  "to the server environment, then reload. The picture above is a preview only " +
  "and will not survive a reload.";

function readCloudName(): string {
  /*
    A static property access, not `import.meta.env[name]`. Vite can only
    tree-shake what it can see at build time; a dynamic lookup makes it inline
    the whole environment object, which would ship every other `VITE_` value
    (including the old unsigned preset name) into the public bundle.
  */
  return (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME ?? "").trim();
}

type SignUploadResponse = {
  apiKey: string;
  uploadUrl: string;
  timestamp: number;
  publicId: string;
  type: "authenticated";
  signature: string;
};

type SignDeliveryResponse = { url: string };

/** What Cloudinary returns, success or failure. */
type UploadResponse = {
  error?: { message?: string };
  public_id?: string;
  format?: string;
  width?: number;
  height?: number;
  /** Seconds. Present for video and audio only. */
  duration?: number;
};

/**
 * Uploads one file and returns the fields worth persisting.
 *
 * `kind` comes from the picker's own probe rather than the MIME type alone: the
 * file was already decoded to show a preview, so this is the same answer with
 * less guessing. It decides whether Cloudinary sees an image or a video, and
 * therefore which endpoint signs the upload.
 *
 * Throws `UploadError` with a message written for the person who picked the
 * file. A raw `TypeError: Failed to fetch` tells them nothing they can act on,
 * and a Cloudinary constraint error is exactly the thing they need to see.
 */
export async function uploadAsset(file: File, kind?: MediaKind): Promise<UploadedMedia> {
  if (!uploadConfigured()) throw new UploadError(UPLOAD_NOT_CONFIGURED);

  const mediaKind: MediaKind =
    kind ?? (file.type.startsWith("video/") ? "video" : "image");

  let signed: SignUploadResponse;
  try {
    signed = await apiRequest<SignUploadResponse>("/media/sign-upload", {
      method: "POST",
      body: JSON.stringify({ kind: mediaKind }),
    });
  } catch (cause) {
    throw new UploadError(messageFor(cause, "Could not get permission to upload."));
  }

  const body = new FormData();
  body.append("file", file);
  body.append("api_key", signed.apiKey);
  body.append("timestamp", String(signed.timestamp));
  body.append("public_id", signed.publicId);
  body.append("type", signed.type);
  body.append("signature", signed.signature);

  let response: Response;
  try {
    response = await fetch(signed.uploadUrl, { method: "POST", body });
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

  const publicId = payload.public_id ?? signed.publicId;
  const format = payload.format?.trim();

  if (!publicId || !format) {
    throw new UploadError(
      "Cloudinary accepted the file but did not return enough information to deliver it.",
    );
  }

  let delivered: SignDeliveryResponse;
  try {
    delivered = await apiRequest<SignDeliveryResponse>("/media/sign-delivery", {
      method: "POST",
      body: JSON.stringify({ kind: mediaKind, publicId, format }),
    });
  } catch (cause) {
    // The bytes are already stored, but without a signed address they are not
    // usable. Saying so is better than persisting an unsigned URL that would
    // be rejected on the next reload.
    throw new UploadError(
      messageFor(cause, "The file uploaded, but its protected link could not be created."),
    );
  }

  const number = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) ? value : null;

  const durationSeconds = number(payload.duration);

  return {
    url: delivered.url,
    publicId,
    width: number(payload.width),
    height: number(payload.height),
    durationMs: durationSeconds === null ? null : Math.round(durationSeconds * 1000),
  };
}

function messageFor(cause: unknown, fallback: string): string {
  if (!(cause instanceof Error) || !cause.message) return fallback;
  // The generic API client speaks to more than uploads; make the two cases a
  // person can actually hit name the thing they were trying to do.
  if (cause.message === "Sign in to continue.") {
    return "Sign in to upload photos and videos. Uploads need an account.";
  }
  return cause.message;
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
