import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { getDb } from "../server/db";
import { sites } from "../server/schema";
import { parseStoredSite } from "../src/lib/site/parseSite";
import type { SiteStatus } from "../src/lib/site/schema";

/**
 * One-time Firestore -> Neon copy.
 *
 * It uses the Firebase CLI's existing login rather than a service-account file:
 * the refresh token in the CLI's config store is exchanged for an access token,
 * and the Firestore REST API lists the project's documents. No user content is
 * printed; only counts and failures.
 *
 * Safe to run more than once. A slug that already exists in Neon is updated, so
 * a half-finished migration can be resumed without duplicating rows.
 *
 * Usage:
 *   firebase login        # once, if not already signed in
 *   npm run db:migrate:firestore
 */

/*
  These are the Firebase CLI's public OAuth client constants, not a user
  credential. The refresh token stays in the CLI config and is only exchanged
  locally; nothing here is bundled into the app or committed as a secret file.
*/
const FIREBASE_CLI_CLIENT_ID =
  "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
const FIREBASE_CLI_CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi";
const PAGE_SIZE = 300;

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID;
if (!projectId) {
  throw new Error("FIREBASE_PROJECT_ID or VITE_FIREBASE_PROJECT_ID is required.");
}

type FirestoreValue = {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  timestampValue?: string;
  nullValue?: null;
  mapValue?: { fields?: Record<string, FirestoreValue> };
  arrayValue?: { values?: FirestoreValue[] };
};

type FirestoreDocument = {
  name: string;
  fields?: Record<string, FirestoreValue>;
};

function decode(value: FirestoreValue): unknown {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if (value.mapValue) return decodeFields(value.mapValue.fields ?? {});
  if (value.arrayValue) return (value.arrayValue.values ?? []).map(decode);
  return null;
}

function decodeFields(fields: Record<string, FirestoreValue>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, decode(value)]),
  );
}

function firebaseCliConfigPath(): string {
  const candidates = [
    join(homedir(), ".config", "configstore", "firebase-tools.json"),
    join(process.env.APPDATA ?? "", "configstore", "firebase-tools.json"),
    join(process.env.LOCALAPPDATA ?? "", "configstore", "firebase-tools.json"),
  ];
  const found = candidates.find((candidate) => candidate && existsSync(candidate));
  if (!found) throw new Error("Firebase CLI config not found. Run `firebase login` first.");
  return found;
}

async function accessToken(): Promise<string> {
  const config = JSON.parse(readFileSync(firebaseCliConfigPath(), "utf8")) as {
    tokens?: { refresh_token?: string };
  };
  const refreshToken = config.tokens?.refresh_token;
  if (!refreshToken) throw new Error("Firebase CLI has no refresh token. Run `firebase login`.");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: FIREBASE_CLI_CLIENT_ID,
      client_secret: FIREBASE_CLI_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`Could not refresh the Firebase CLI token (${response.status}).`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("The token refresh returned no access token.");
  return data.access_token;
}

async function listDocuments(token: string): Promise<FirestoreDocument[]> {
  const documents: FirestoreDocument[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/sites`,
    );
    url.searchParams.set("pageSize", String(PAGE_SIZE));
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url, {
      headers: { authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Firestore list failed (${response.status}). ${detail.slice(0, 200)}`);
    }

    const body = (await response.json()) as {
      documents?: FirestoreDocument[];
      nextPageToken?: string;
    };

    documents.push(...(body.documents ?? []));
    pageToken = body.nextPageToken;
  } while (pageToken);

  return documents;
}

function statusOf(value: unknown): SiteStatus {
  return value === "published" || value === "submitted" ? value : "draft";
}

function dateOf(value: unknown): Date {
  if (typeof value !== "string" || !value) return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

const token = await accessToken();
const documents = await listDocuments(token);
const db = getDb();

let imported = 0;
const skipped: string[] = [];

for (const document of documents) {
  const slug = document.name.split("/").pop() ?? "";
  const fields = decodeFields(document.fields ?? {});
  const ownerId = typeof fields.ownerId === "string" ? fields.ownerId : "";

  if (!slug || !ownerId) {
    skipped.push(slug || "(missing slug)");
    continue;
  }

  let site;
  try {
    site = parseStoredSite(fields.site, slug);
  } catch {
    skipped.push(slug);
    continue;
  }

  const row = {
    slug,
    ownerId,
    status: statusOf(fields.status),
    schemaVersion: site.version,
    name: typeof fields.name === "string" && fields.name ? fields.name : site.identity.name || slug,
    site,
    createdAt: dateOf(fields.createdAt),
    updatedAt: dateOf(fields.updatedAt),
  };

  await db
    .insert(sites)
    .values(row)
    .onConflictDoUpdate({
      target: sites.slug,
      set: {
        ownerId: row.ownerId,
        status: row.status,
        schemaVersion: row.schemaVersion,
        name: row.name,
        site: row.site,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });

  imported += 1;
}

console.log(`Firestore documents found: ${documents.length}`);
console.log(`Imported into Neon: ${imported}`);
if (skipped.length > 0) {
  console.log(`Skipped (invalid or missing owner): ${skipped.join(", ")}`);
}
