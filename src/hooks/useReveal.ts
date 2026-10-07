import { useEffect, useRef, useState } from "react";

/** True when the reader has asked the system for reduced motion. */
function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Reveals content once it enters the viewport, then stops observing.
 *
 * Deliberately IntersectionObserver rather than ScrollTrigger: the gallery is a
 * calm, one-shot reveal page, and this way nothing is left running on GSAP's
 * ticker between sections.
 *
 * Resolved up front rather than inside the effect: without observer support, or
 * with reduced motion requested, the content starts visible instead of being
 * revealed by a scroll.
 */
export default function useReveal<T extends HTMLElement = HTMLDivElement>(
  threshold = 0.2,
) {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(
    () => typeof IntersectionObserver === "undefined" || prefersReducedMotion(),
  );

  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [threshold, shown]);

  return { ref, shown };
}