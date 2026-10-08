import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { ArrowUp } from "lucide-react";

import { blockySm, glossyGold } from "../../lib/shape";

gsap.registerPlugin(ScrollToPlugin);

/**
 * Floating "back to top" control. Fades in once the page has been scrolled
 * past `threshold`, and returns to the top with an eased GSAP scroll instead
 * of a jump so ScrollTrigger animations stay in sync on the way up.
 */
export default function ScrollToTop({
  threshold = 600,
  className = "",
}: {
  threshold?: number;
  className?: string;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  // Magnetic pull toward the cursor, matching the hero buttons on the home page
  useEffect(() => {
    const el = btnRef.current;
    if (!el) return;

    const xTo = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3" });

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * 0.35);
      yTo((e.clientY - r.top - r.height / 2) * 0.35);
    };
    const onLeave = () => {
      xTo(0);
      yTo(0);
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  const scrollUp = () => {
    gsap.to(window, {
      scrollTo: { y: 0, autoKill: true },
      duration: 1.1,
      ease: "power3.inOut",
    });
  };

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={scrollUp}
      aria-label="Scroll back to top"
      // Kept out of the tab order while hidden so it can't be focused offscreen
      tabIndex={visible ? 0 : -1}
      className={`fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-40 h-12 w-12 sm:h-14 sm:w-14 flex items-center justify-center transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      } ${glossyGold} ${blockySm} ${className}`}
    >
      <span className="relative z-10 flex flex-col items-center gap-0 leading-none">
        <ArrowUp className="w-5 h-5 text-on-gold" strokeWidth={2.5} />
      </span>
    </button>
  );
}