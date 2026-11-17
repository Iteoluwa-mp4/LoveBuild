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

/** The longest address the create form accepts, and that a suffix must respect. */
export const MAX_SLUG_LENGTH = 60;

/**
 * Appends a short random suffix to an address that is already taken.
 *
 * Only used on collision, never on the first attempt: a site should keep the
 * name someone chose unless the world forces otherwise. The base is trimmed so
 * the result still fits the same limit as a hand-typed slug.
 */
export function suffixSlug(slug: string, suffix: string): string {
  const tail = `-${suffix}`;
  const base = slug
    .slice(0, Math.max(1, MAX_SLUG_LENGTH - tail.length))
    .replace(/-+$/, "");
  return `${base}${tail}`;
}

/**
 * Four lower-case base-36 characters.
 *
 * Not a security token — this only makes two people who chose the same name get
 * different links. Math.random is enough for that, and it keeps the helper
 * synchronous and testable.
 */
export function randomSlugSuffix(): string {
  return Math.random().toString(36).slice(2, 6).padEnd(4, "0");
}