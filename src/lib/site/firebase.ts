import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

/**
 * Firebase, initialised once.
 *
 * Everything here is a *public identifier*. The web API key is not a secret:
 * Firebase expects it to ship in the bundle, and protects the project with
 * authorized domains, security rules and (later) App Check. That is why these
 * variables carry the `VITE_` prefix and `.env.example` says so.
 *
 * Development must still run with no Firebase project configured. That is not
 * a fallback bolted on afterwards — it is how the project has always worked,
 * and it is what keeps `npm run dev` usable on a fresh clone. When these
 * variables are absent, `getFirebaseAuth` returns null and development reports
 * the local open mode. Production fails closed to the login screen instead.
 */

type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
};

/**
 * Reads the four settings, or null when any is missing.
 *
 * Built as one function so the guard and the `initializeApp` argument cannot
 * disagree: `exactOptionalPropertyTypes` rejects a config whose fields are
 * `string | undefined`, and narrowing them here is what makes the call total.
 */
function readConfig(): FirebaseConfig | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID;

  if (!apiKey || !authDomain || !projectId || !appId) return null;

  return { apiKey, authDomain, projectId, appId };
}

/** True only when every setting the Auth SDK needs is present. */
export function isFirebaseConfigured(): boolean {
  return readConfig() !== null;
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

/**
 * The one app instance, or null in local mode.
 *
 * `initializeApp` throws when called twice for the same name, and Vite's HMR
 * re-runs modules often enough that the difference matters.
 */
function getFirebaseApp(): FirebaseApp | null {
  const config = readConfig();
  if (!config) return null;
  app ??= getApps().length > 0 ? getApp() : initializeApp(config);
  return app;
}

/** The Auth instance, or null in local mode. */
export function getFirebaseAuth(): Auth | null {
  const instance = getFirebaseApp();
  if (!instance) return null;
  auth ??= getAuth(instance);
  return auth;
}
