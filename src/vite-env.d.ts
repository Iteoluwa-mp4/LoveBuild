/// <reference types="vite/client" />

/**
 * The environment variables this app actually reads.
 *
 * Declared rather than left to the `vite/client` index signature, which types
 * every unknown `VITE_` key as `any` — that turns a typo like
 * `VITE_CLOUDINARY_CLOD_NAME` into `undefined` at runtime instead of a build
 * error, and the failure only shows up when somebody tries to upload a photo.
 *
 * Note what is deliberately absent: any secret. Anything declared here is
 * compiled into the bundle and readable by anyone who loads the page.
 * `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` are unprefixed for that
 * reason and are read by nothing in this bundle.
 */
interface ImportMetaEnv {
  /** Cloudinary cloud name. Public by design — it appears in every asset URL. */
  readonly VITE_CLOUDINARY_CLOUD_NAME?: string;
  /**
   * Unsigned upload preset. Also public, and that is the trade: an unsigned
   * preset means the browser can upload without a server, so anyone who learns
   * the name can upload too. Restrict it on the Cloudinary side (folder,
   * formats, max size) and replace it with signed uploads once a backend can
   * hold the secret — see `.env.example`.
   */
  readonly VITE_CLOUDINARY_UPLOAD_PRESET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
