/**
 * Reusable class strings.
 *
 * These used to be Tailwind arbitrary values with hex colours baked in, which
 * meant a theme change could not reach them. Every colour here is now a
 * `var(--theme-*)` reference, so the browser resolves it against whatever theme
 * the site shell published — no JavaScript involved, and switching preset is
 * free.
 */

/** The site's signature corner treatment. Two small, two large. */
export const blocky = "rounded-tl-[6px] rounded-tr-[42px] rounded-bl-[42px] rounded-br-[6px]";
export const blockySm = "rounded-tl-[4px] rounded-tr-[20px] rounded-bl-[20px] rounded-br-[4px]";

/** Raised, accent-filled button surface. */
export const glossyGold = "bg-[image:var(--theme-grad-gold-btn)] shadow-btn";

/** Frosted panel behind the magnetic buttons. */
export const glassPurple =
  "bg-[image:var(--theme-grad-glass)] backdrop-blur-md border border-lavender/15";

/** Small round monogram in the nav. */
export const monogramGradient = "bg-[image:var(--theme-grad-ring)]";

/** Page wash behind the hero and the gallery feed. */
export const heroWash = "bg-[image:var(--theme-grad-hero-bg)]";