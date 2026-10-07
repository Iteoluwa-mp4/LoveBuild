import type { ReactNode } from "react";

import useReveal from "../../hooks/useReveal";

/**
 * Small shared pieces for the site template.
 *
 * These hold chrome only — ornaments, labels and motion. No content comes from
 * config here, because chrome is the same on every site by definition.
 */

/** A hairline rule either side of a letter-spaced label. */
export function Eyebrow({
  children,
  align = "center",
}: {
  children: ReactNode;
  align?: "center" | "left";
}) {
  const label = (
    <span className="text-[10px] uppercase tracking-[0.32em] text-gold/85 sm:text-[11px]">
      {children}
    </span>
  );

  if (align === "left") {
    return (
      <div className="flex items-center gap-4">
        <span aria-hidden="true" className="h-px w-8 shrink-0 bg-gold/35 sm:w-12" />
        {label}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-4 sm:gap-6">
      <span aria-hidden="true" className="h-px w-8 bg-gold/35 sm:w-14" />
      {label}
      <span aria-hidden="true" className="h-px w-8 bg-gold/35 sm:w-14" />
    </div>
  );
}

/** Fade and rise, once. No spin, no scrub, no parallax. */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      style={shown ? { transitionDelay: `${delay}ms` } : undefined}
      className={`transition-all duration-1000 ease-out motion-reduce:transition-none ${
        shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}