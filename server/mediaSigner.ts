import type { MediaKind } from "../src/lib/site/schema";
import { ApiError } from "./errors";

/**
 * Cloudinary signing, on the server only.
 *
 * The browser must never see `CLOUDINARY_API_SECRET`. It asks this API for a
 * short-lived upload signature, posts the file directly to Cloudinary, then
 * asks for a signed delivery URL for the asset it just created.
 *
 * There are two different signatures here, and they are not interchangeable:
 *
 *   - Upload signatures are a hex SHA-1 of the alphabetically sorted request
 *     fields plus the secret. Cloudinary accepts them for one hour.
 *   - Delivery signatures are the first eight characters of a URL-safe base64
 *     SHA-1 of `public_id.format` plus the secret. They are embedded in the
 *     URL and do not expire; the URL is a bearer link.
 *
 * The formulas come from Cloudinary's "authentication signatures" and
 * "delivery URL signatures" documentation. `mediaSigner.test.ts` pins both to
 * the published test vectors so a refactor cannot quietly change them.
 */

export type CloudinaryEnv = Record<string, string | undefined>;

export type UploadCredentials = {
  /** Sent to Cloudinary as `api_key`; public, but only handed to signed-in users. */
  apiKey: string;
  /** The Upload API endpoint for the picked kind. */
  uploadUrl: string;
  /** Unix seconds. Part of the signature and valid for one hour. */
  timestamp: number;
  /** Server-generated `lovebuilds/<uuid>` — never chosen by the browser. */
  publicId: string;
  /** Must be posted back as `type`; it is part of the signature. */
  type: "authenticated";
  /** Hex SHA-1 of `public_id`, `timestamp` and `type`, plus the API secret. */
  signature: string;
};

export type MediaSigner = {
  readonly configured: boolean;
  signUpload(kind: MediaKind): Promise<UploadCredentials>;
  signDelivery(kind: MediaKind, publicId: string, format: string): Promise<string>;
};

type Options = {
  env?: CloudinaryEnv;
  /** Injectable for tests. */
  now?: () => number;
  /** Injectable for tests; must return the part after `lovebuilds/`. */
  randomId?: () => string;
};

const PUBLIC_ID_PREFIX = "lovebuilds/";

/** The one error a missing deployment setting is allowed to produce. */
export const MEDIA_UNCONFIGURED_MESSAGE = "Uploads are not configured on this server.";

export function createCloudinarySigner({
  env = process.env,
  now = Date.now,
  randomId = () => crypto.randomUUID(),
}: Options = {}): MediaSigner {
  /*
    `||` rather than `??`: `.env.example` ships `CLOUDINARY_CLOUD_NAME=` empty,
    and an empty string is a real value to `??`. It must not shadow the VITE_
    fallback and turn a configured deployment into a 503.
  */
  const cloudName =
    env.CLOUDINARY_CLOUD_NAME?.trim() || env.VITE_CLOUDINARY_CLOUD_NAME?.trim() || "";
  const apiKey = env.CLOUDINARY_API_KEY?.trim() || "";
  const apiSecret = env.CLOUDINARY_API_SECRET?.trim() || "";
  const configured = Boolean(cloudName && apiKey && apiSecret);

  const requireConfigured = () => {
    if (!configured) {
      throw new ApiError(503, MEDIA_UNCONFIGURED_MESSAGE, "media-unconfigured");
    }
  };

  return {
    configured,

    async signUpload(kind) {
      requireConfigured();

      const timestamp = Math.floor(now() / 1000);
      const publicId = `${PUBLIC_ID_PREFIX}${randomId()}`;
      const type = "authenticated" as const;
      const signature = await uploadSignature(
        { public_id: publicId, timestamp, type },
        apiSecret,
      );

      return {
        apiKey,
        /*
          `/image/authenticated` is the path shown in some older examples, but
          Cloudinary now returns 404 for it. The current REST API takes the
          delivery type as a signed `type` field on `/image/upload`.
        */
        uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${kind}/upload`,
        timestamp,
        publicId,
        type,
        signature,
      };
    },

    async signDelivery(kind, publicId, format) {
      requireConfigured();

      const path = `${publicId}.${format.toLowerCase()}`;
      const signature = await deliverySignature(path, apiSecret);
      return `https://res.cloudinary.com/${cloudName}/${kind}/authenticated/s--${signature}--/${path}`;
    },
  };
}

/**
 * Hex SHA-1 over sorted `name=value` pairs, with the secret appended.
 *
 * `file`, `cloud_name`, `resource_type` and `api_key` are deliberately absent:
 * Cloudinary excludes them from the string to sign. This app signs
 * `public_id`, `timestamp` and `type`, which is the whole upload payload it
 * controls.
 */
export async function uploadSignature(
  fields: Record<string, string | number>,
  apiSecret: string,
): Promise<string> {
  const serialised = Object.entries(fields)
    // Byte order, not locale order: a server's locale must not change a
    // signature that another server has to reproduce.
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, value]) => `${name}=${value}`)
    .join("&");

  return hex(await sha1(serialised + apiSecret));
}

/**
 * Eight URL-safe characters covering the path after `/s--...--/`.
 *
 * The path is `public_id.format`; no transformations or version are used, so
 * the signature and the delivered URL cannot disagree. Including a version
 * would make the URL longer without making a UUID-named asset safer.
 */
export async function deliverySignature(path: string, apiSecret: string): Promise<string> {
  return base64Url(await sha1(path + apiSecret)).slice(0, 8);
}

async function sha1(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(value));
  return new Uint8Array(digest);
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
