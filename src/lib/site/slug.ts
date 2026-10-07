/**
 * Turning a name into a URL segment.
 *
 * Someone will type "For Sarah" or "Sarah & James" and it has to become
 * `for-sarah` without them learning what a slug is. The rule is boring on
 * purpose — predictable beats clever, and predictable means they can guess what
 * their link will be.
 */

/** Matches what the schema and the database both accept. */
const VALID_SLUG = /^[a-z0-9-]+$/;

/**
 * Reduces a name to a slug.
 *
 * Returns "" when nothing usable survives, so the caller can say "that name
 * doesn't give us a usable web address" instead of creating `/` .
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    // Drop accents first, so "Zoë" becomes "zoe" rather than "zo".
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export type SlugCheck =
  | { ok: true; slug: string }
  | { ok: false; reason: string };

/**
 * Validates a proposed slug and explains what is wrong with it.
 *
 * A free-text explanation rather than a boolean, because "invalid" tells the
 * person nothing about which of the several possible problems they hit.
 */
export function checkSlug(raw: string): SlugCheck {
  const slug = raw.trim();

  if (!slug) return { ok: false, reason: "Give it a name to begin with." };

  if (slug.length > 60) {
    return { ok: false, reason: "That address is too long. Try something shorter." };
  }

  if (!VALID_SLUG.test(slug)) {
    return {
      ok: false,
      reason: "Use lower-case letters, numbers and hyphens only — no spaces or symbols.",
    };
  }

  if (slug.startsWith("-") || slug.endsWith("-")) {
    return { ok: false, reason: "It can't start or end with a hyphen." };
  }

  return { ok: true, slug };
}

/** The public address for a site. */
export function publicUrl(slug: string): string {
  return `/s/${slug}`;
}