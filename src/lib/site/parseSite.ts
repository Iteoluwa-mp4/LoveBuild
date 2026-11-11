import { SaveError } from "./repository";
import { siteSchema, type Site } from "./schema";

/**
 * Parsing, in the two places storage touches a config.
 *
 * Both repositories need the same answer to the same two questions — is this
 * safe to write, and can this old row still be read? Keeping the wording here
 * means a schema failure looks the same whether the bytes came from Firestore
 * or localStorage.
 */

/** Validates a config before writing it, or explains which field is wrong. */
export function parseForStorage(site: Site): Site {
  const result = siteSchema.safeParse(site);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new SaveError(
      `Not saved: ${first?.message ?? "the config is invalid"}` +
        (first?.path.length ? ` at ${first.path.join(".")}` : "") + ".",
      first?.path.join("."),
    );
  }
  return result.data;
}

/**
 * Validates a config read back from storage.
 *
 * The document id is authoritative. A row whose stored `slug` disagrees with
 * the address it lives at is corrected here rather than returned with a link
 * that points somewhere else.
 */
export function parseStoredSite(raw: unknown, slug: string): Site {
  const result = siteSchema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new SaveError(
      `Saved config for "${slug}" no longer matches the current schema` +
        (first ? ` (at ${first.path.join(".")})` : "") + ".",
      first?.path.join("."),
    );
  }

  return result.data.slug === slug ? result.data : { ...result.data, slug };
}
