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
  /**
   * Firebase Authentication. Public identifiers, not secrets: they are compiled
   * into the bundle by design. See `.env.example`. When any of the four is
   * absent, `getFirebaseAuth` returns null. Development runs in local open
   * mode; production fails closed to the login screen.
   */
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;

  /**
   * Cloudinary cloud name. Public by design — it appears in every asset URL.
   * The server also reads it (or the unprefixed `CLOUDINARY_CLOUD_NAME`) when
   * it signs uploads; the browser only uses it to decide whether uploads are
   * configured at all.
   */
  readonly VITE_CLOUDINARY_CLOUD_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
