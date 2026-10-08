import { useEffect } from "react";

/** True when the reader has asked the system for reduced motion. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Reveals everything marked inside a root, once, as it scrolls into view.
 *
 * ## Why this exists instead of GSAP ScrollTrigger
 *
 * The home page used ScrollTrigger for its scroll reveals. It looked reasonable,
 * built valid triggers with sensible `start` and `end` values, and never fired —
 * progress stayed at zero at every scroll position. Because `fromTo` still
 * applies its "from" state, every revealed block was set to `autoAlpha: 0` and
 * left there: the moments, the closing section and its clip cards were all
 * present in the DOM and invisible, with nothing in the console. Two rounds of
 * fixes (consistent imports, a Vite dedupe, removing `gsap.context`) did not
 * change it, and a bare `ScrollTrigger.create` in the same page tracked the scroll
 * perfectly, which is what finally localised the fault.
 *
 * IntersectionObserver is what the gallery already uses via `useReveal`, and the
 * quote panel on this very page kept working throughout — the one section that
 * never touched ScrollTrigger. So this is that same mechanism, widened to a whole
 * subtree.
 *
 * ## The failure mode is the point
 *
 * Nothing hides these elements until this hook runs. The hidden state is applied
 * by adding a class from JavaScript, not by CSS that is present regardless. So if
 * this file fails to load, IntersectionObserver is missing, or the effect throws,
 * the content is *visible* — the only thing lost is the animation.
 *
 * That is the opposite arrangement from GSAP's, where a broken trigger meant
 * content stuck at zero opacity. For a page whose entire purpose is to show
 * someone a letter, an animation is worth far less than the words.
 *
 * ## Class-based, not a wrapper
 *
 * The elements being revealed are grid items and cards inside existing layouts.
 * Wrapping them would change the layout, so this marks them instead.
 */

/** Marks an element as "hidden until scrolled into view". */
export const REVEAL_HIDDEN = "js-reveal-pending";
/** Marks it as arrived. */
export const REVEAL_SHOWN = "js-reveal-shown";

/**
 * How long an element may stay hidden waiting for the observer, in milliseconds.
 *
 * Exported because it is the single number standing between a working animation
 * and a blank page, and it is worth being able to assert on.
 */
export const REVEAL_FAILSAFE_MS = 1200;

export default function useScrollReveal(
  root: { current: HTMLElement | null },
  selector = "[data-reveal], [data-tilt-card], [data-cta-card]",
) {
  useEffect(() => {
    const container = root.current;
    if (!container) return;

    const elements = Array.from(container.querySelectorAll<HTMLElement>(selector));
    if (elements.length === 0) return;

    // Reduced motion, or no observer support: leave everything alone. No class is
    // added, so nothing is ever hidden in the first place.
    if (
      typeof IntersectionObserver === "undefined" ||
      prefersReducedMotion()
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          el.classList.remove(REVEAL_HIDDEN);
          el.classList.add(REVEAL_SHOWN);
          // One-shot. Nothing here needs to animate back out of view, and an
          // observer left running over a long page is work for no benefit.
          observer.unobserve(el);
        }
      },
      // A fifth of the element, matching the single-element `useReveal`.
      { threshold: 0.2, rootMargin: "0px 0px -8% 0px" },
    );

    for (const [index, el] of elements.entries()) {
      el.classList.add(REVEAL_HIDDEN);

      /*
        Two stencils, both positional rather than semantic.
        - A stagger, so a row of cards arrives in sequence instead of all at once.
        - A tilt, so the moment cards keep the slight rotation they had as a GSAP
          tween. They alternate, and the closing fan does too.

        Capped, because past a dozen elements a stagger starts to feel like lag
        rather than like a sequence.
      */
      const step = Math.min(index, 6);
      el.style.setProperty("--reveal-delay", `${step * 70}ms`);
      if (el.hasAttribute("data-tilt-card") || el.hasAttribute("data-cta-card")) {
        el.style.setProperty("--reveal-tilt", `${index % 2 === 0 ? -4 : 4}deg`);
      }

      observer.observe(el);
    }

    /*
     * The guarantee.
     *
     * Everything above is an optimisation. This is the part that matters: after a
     * short, fixed delay, anything still marked pending becomes visible whether or
     * not the observer ever spoke.
     *
     * It exists because of what was measured while building this. In a headless
     * browser, IntersectionObserver callbacks did not fire at all — a control
     * observer created in the page stayed silent too — and CSS transitions sat
     * frozen at `currentTime: 0`. With the previous arrangement, where an
     * animation was the only thing that could ever un-hide an element, that is a
     * page where the content of someone's gift is invisible. Which is the failure
     * this hook was written to make impossible.
     *
     * So the worst case is now bounded and small: an element may sit at zero
     * opacity for this long, and no longer. Long enough that a reveal that does
     * work still looks like one, short enough that a broken observer costs an
     * animation rather than a page.
     */
    const failsafe = window.setTimeout(() => {
      for (const el of elements) {
        if (!el.classList.contains(REVEAL_HIDDEN)) continue;
        el.classList.remove(REVEAL_HIDDEN);
        el.classList.add(REVEAL_SHOWN);
      }
    }, REVEAL_FAILSAFE_MS);

    return () => {
      window.clearTimeout(failsafe);
      observer.disconnect();
      // Take the classes and the inline properties back off, so a re-mount cannot
      // leave elements stuck hidden by a hook that is no longer watching them.
      for (const el of elements) {
        el.classList.remove(REVEAL_HIDDEN, REVEAL_SHOWN);
        el.style.removeProperty("--reveal-delay");
        el.style.removeProperty("--reveal-tilt");
      }
    };
  }, [root, selector]);
}