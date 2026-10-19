import type { ModernMemory } from "../../../lib/site/derive";

import { MODERN_INTERLUDE_CSS } from "./interlude-css";

export { MODERN_INTERLUDE_CSS };

/**
 * The two full-bleed breaks in the page.
 *
 * ## Why these take no author copy
 *
 * Every other section on this page is a thing the author fills in, and an empty
 * one hides itself. These are the exception, deliberately: they exist to lengthen
 * and pace the page and to give the eye somewhere to rest between the argument
 * sections, so adding a field to each would create two more things to fill before
 * the page earns its length. Everything they show is either already on the site
 * or is chrome, which `PRODUCT.md` names as the standing exception to config
 * purity.
 *
 * ## Why the band's text is hidden from screen readers
 *
 * Each row is rendered twice so the scroll can loop seamlessly, and a caption is
 * also already in the contact strip and the memory index further down. Announcing
 * it three times would make a screen reader read the same sentence until the
 * reader asked it to stop. So the whole band is `aria-hidden`, and nothing here
 * is the only place a caption appears.
 */

/**
 * A band of the moment captions, drifting sideways.
 *
 * Two rows moving opposite ways at different speeds, which is what stops a
 * marquee reading as a conveyor belt.
 */
export function DriftBand({ memories }: { memories: ModernMemory[] }) {
  const items = memories
    .map((m) => m.caption || m.label)
    .filter((text): text is string => Boolean(text && text.trim()));

  /*
    Nothing to drift. A band with one caption in it would scroll a gap across the
    page, so below three the band is skipped entirely rather than padded out with
    repeated text — the page simply goes straight from one section to the next.
  */
  if (items.length < 3) return null;

  /*
    Each row is rendered twice and animated from 0 to -50%, so the moment the
    first copy leaves, the second is exactly where the first started. The loop is
    invisible for that reason alone: `translateX(-50%)` on a track holding two
    copies lands on the seam.

    Two copies is the minimum. Three would make the seam land a third of the way
    through rather than half way, and the repetition would become countable.
  */
  const row = (className: string) =>
    items.map((text, i) => (
      <span className="drift__item" key={`${className}-${i}`}>
        {text}
      </span>
    ));

  return (
    <section className="drift" aria-hidden="true">
      <div className="drift__row drift__row--a">
        {row("a")}
        {row("a2")}
      </div>
      <div className="drift__row drift__row--b">
        {row("b")}
        {row("b2")}
      </div>
    </section>
  );
}

/**
 * The second break: the site's name, held large, with the hero's orbit resolved
 * into a shape big enough to be a composition rather than a detail.
 *
 * The count beneath it is the real number of moments on the site — a fact about
 * the site rather than a claim about anything, which is the line `PRODUCT.md`
 * draws about inventing metrics.
 */
export function SignalInterlude({
  name,
  count,
}: {
  name: string;
  count: number;
}) {
  return (
    <section className="signal" aria-hidden="true">
      <span className="signal__ring" />
      <div className="signal__body">
        <p className="signal__name">{name}</p>
        {count > 0 && (
          <p className="signal__count">
            {count} {count === 1 ? "signal" : "signals"} on this frequency
          </p>
        )}
      </div>
    </section>
  );
}