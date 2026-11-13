import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Firebase ID token verification without a service account.
 *
 * Firebase tokens are ordinary JWTs signed by Google. The public keys are
 * published at a fixed JWKS endpoint, so the API only needs the project id to
 * check the issuer and audience. That keeps the deployment free of a service
 * account file and still verifies the token cryptographically on every request.
 *
 * `createRemoteJWKSet` caches keys inside the process, so this is not a network
 * call per request in a warm function.
 */
const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export type TokenVerifier = (token: string) => Promise<string>;

export function createTokenVerifier(): TokenVerifier {
  return async (token) => {
    const projectId =
      process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID;

    if (!projectId) {
      throw new Error(
        "FIREBASE_PROJECT_ID is not set. Add the Firebase project id to the server environment.",
      );
    }

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      clockTolerance: 5,
    });

    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      throw new Error("The Firebase token has no subject.");
    }

    return payload.sub;
  };
}
