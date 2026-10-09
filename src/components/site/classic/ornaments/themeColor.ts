/**
 * Reads a theme token at runtime.
 *
 * three.js needs colours as numbers, and CSS custom properties are strings, so
 * the 3D ornaments cannot simply be handed `var(--theme-gold)`. Reading the
 * computed value is what keeps them on-theme: change the preset and the gem
 * changes with it, with no duplicated palette in JavaScript.
 *
 * Called once per mount, not per frame — the tokens do not change while a scene
 * is alive.
 */

/** `#RRGGBB` as a number, for three.js. */
export function cssColorNumber(token: string, fallback = 0xffffff): number {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(`--theme-${token}`)
    .trim();

  if (!raw) return fallback;

  // Handles #abc and #aabbcc; anything else (rgb(), gradient) falls back.
  const hex = raw.startsWith("#") ? raw : null;
  if (!hex || (hex.length !== 4 && hex.length !== 7)) return fallback;

  const full = hex.length === 4 ? hex.replace(/./g, (c) => c + c) : hex;
  return parseInt(full.slice(1), 16);
}

/** `#RRGGBB` as a CSS string. */
export function cssColor(token: string, fallback = "#ffffff"): string {
  const n = cssColorNumber(token, Number.parseInt(fallback.replace("#", ""), 16));
  return `#${n.toString(16).padStart(6, "0")}`;
}