import { useEffect, useState, type ReactNode } from "react";

import type { EditorialMoment } from "../../../lib/site/derive";
import { EDITORIAL_BASE_CSS, EDITORIAL_FONT_IMPORT } from "./css";

/* ================================================================== *
 * CHROME — everything that is fixed because it is the publication's
 * ================================================================== */

/**
 * The accent colour.
 *
 * A constant rather than a config field on purpose: the accent is the
 * publication's spot-colour, the way a printed magazine has one ink it prints
 * everything else against. Letting a site change it would let site names land
 * on the paper ground with whatever contrast they liked, and that failure is
 * the reason themes and templates are orthogonal everywhere else — but this
 * design only works with its own palette, so there is nothing to choose.
 */
export const EDITORIAL_ACCENT = "#9c5362";

/**
 * The two fallback frames, for a moment with no photograph yet.
 *
 * A generated SVG rather than a blank box, so an unfilled slot still reads as
 * part of the spread — the same reasoning as the modern template's generated
 * frame in `derive.ts`, but in the editorial paper palette because that is
 * what sits next to it.
 */
export const EDITORIAL_FALLBACK_IMAGES = [
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='1500'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop stop-color='%23c6a99d'/%3E%3Cstop offset='.48' stop-color='%23ead7c8'/%3E%3Cstop offset='1' stop-color='%23746a72'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='1200' height='1500' fill='url(%23g)'/%3E%3Ccircle cx='260' cy='320' r='270' fill='%23fff4e6' opacity='.24'/%3E%3Cpath d='M0 1080Q390 840 1200 1000V1500H0Z' fill='%235a4b58' opacity='.36'/%3E%3C/svg%3E",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='1500'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='1' x2='1' y2='0'%3E%3Cstop stop-color='%23d6b0a5'/%3E%3Cstop offset='.5' stop-color='%23f2e1cf'/%3E%3Cstop offset='1' stop-color='%23a8afb1'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='1200' height='1500' fill='url(%23g)'/%3E%3Cpath d='M0 960Q310 790 620 980T1200 840V1500H0Z' fill='%237e5b60' opacity='.35'/%3E%3Ccircle cx='910' cy='260' r='220' fill='%23fff9ed' opacity='.33'/%3E%3C/svg%3E",
];

/** The image to use for a figure whose upload has not arrived yet. */
export function editorialImage(item: EditorialMoment, index: number): string {
  return item.image || EDITORIAL_FALLBACK_IMAGES[index % EDITORIAL_FALLBACK_IMAGES.length];
}

/**
 * A figure's line of credit.
 *
 * The magazine always credits something — an archive, a guess, an index. There
 * is no field for it on purpose: it is the publication's voice, and a real
 * credit line ("archive / 03") reads as more of one than a config field ever
 * could.
 */
export function figureCredit(index: number): string {
  return `archive / ${String(index + 1).padStart(2, "0")}`;
}

/**
 * A decorative barcode, hashed from the slug.
 *
 * Purely ornamental, and harmless for it: it needs to be deterministic across
 * renders rather than random, or the masthead would redraw itself on every
 * keystroke in the preview.
 */
export function slugBarcode(slug: string): number[] {
  const values = Array.from(slug).map((character) => character.charCodeAt(0));
  return Array.from({ length: 25 }, (_, index) => {
    const value = values[index % Math.max(values.length, 1)] ?? 7;
    return ((value + index * 11) % 4) + 1;
  });
}

/* ================================================================== *
 * SHARED PIECES — used by both pages
 * ================================================================== */

/** The rules the app shell needs, on top of the extracted base sheet. */
const EDITORIAL_EXTRA_CSS = `
.editorial-nav a { color:inherit; text-decoration:none; transition:color .3s ease; }
.editorial-nav a:hover { color:var(--editorial-accent); }
.editorial-letter-body { white-space:pre-line; }
.editorial-back { display:inline-block; margin-top:60px; color:var(--editorial-accent); font:10px 'DM Mono',monospace; letter-spacing:.12em; text-transform:uppercase; text-decoration:none; transition:color .3s ease; }
.editorial-back:hover { color:var(--editorial-ink); }
/* The figures page borrows the masthead's carrying but not a full cover. */
.editorial-cover-figures { min-height:0; padding-top:64px; padding-bottom:24px; border-bottom:1px solid var(--editorial-line); }
/*
 * Scroll reveals.
 *
 * The hidden state comes from the useScrollReveal classes, never from CSS. If the
 * observer never fires, the hook's failsafe still shows everything. The
 * transition lives on the element rather than on the pending class, so removing
 * the pending class animates instead of snapping.
 *
 * Photographs keep the magazine's horizontal wipe. Everything else uses the
 * shared fade-up that the rest of the site uses.
 */
.editorial-template .editorial-reveal,
.editorial-template .editorial-cover-kicker,
.editorial-template .editorial-cover-title .editorial-line,
.editorial-template .editorial-cover-line,
.editorial-template .editorial-cover-meta,
.editorial-template .editorial-photo-reveal {
  transition: opacity .8s cubic-bezier(.16,1,.3,1), transform .8s cubic-bezier(.16,1,.3,1), clip-path 1.05s cubic-bezier(.65,0,.35,1);
  transition-delay: var(--reveal-delay, 0ms);
}
.editorial-template .editorial-photo-reveal.js-reveal-pending {
  opacity: 0;
  transform: none;
  clip-path: inset(0 100% 0 0);
}
.editorial-template .editorial-photo-reveal.js-reveal-shown {
  opacity: 1;
  clip-path: inset(0 0 0 0);
}
/* The masthead slides up from behind its own mask, not the shared 26px lift. */
.editorial-template .editorial-cover-title .editorial-line.js-reveal-pending {
  transform: translateY(105%);
}
`;

/**
 * The template's own stylesheet.
 *
 * Rendered inline rather than imported as globals, so the sheet follows the
 * template — a dashboard that happens to have this module loaded does not
 * inherit an editorial `body`. The font import comes first because a separate
 * `@import` after any rule is ignored.
 */
export function EditorialStyles() {
  return <style>{`${EDITORIAL_FONT_IMPORT}\n${EDITORIAL_BASE_CSS}\n${EDITORIAL_EXTRA_CSS}`}</style>;
}

/** A heading that slides up from behind its own baseline mask. */
export function LineReveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`editorial-line-mask ${className}`}>
      <span className="editorial-line">{children}</span>
    </span>
  );
}

/**
 * The page counter across the top of the page.
 *
 * A magazine folio — "07 / 12" — counted from scroll position. Console-only
 * chrome (the folio prints on phones, where a masthead fades), so it is hidden
 * by the base sheet on desktop and the count costs nothing there.
 */
export function useEditorialFolio(): string {
  const [folio, setFolio] = useState("01 / 12");

  useEffect(() => {
    const onScroll = () => {
      const percentage = Math.min(
        99,
        Math.max(
          1,
          Math.round(
            (window.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight)) * 100,
          ),
        ),
      );
      setFolio(`${String(Math.max(1, Math.ceil(percentage / 9))).padStart(2, "0")} / 12`);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return folio;
}

/* ================================================================== *
 * FIGURES
 * ================================================================== */

/**
 * One figure in the grid: the photograph, its number, its credit.
 *
 * A button rather than a figure so the whole card is one tappable target that
 * opens the spread — the lightbox is worth more than a right-click-save.
 */
export function EditorialFigure({
  item,
  index,
  onOpen,
  className = "",
}: {
  item: EditorialMoment;
  index: number;
  onOpen: (index: number) => void;
  /** Extra classes, e.g. a reveal animation on the gallery page. */
  className?: string | undefined;
}) {
  return (
    <button
      className={`editorial-figure figure-${index % 3} ${className}`}
      onClick={() => onOpen(index)}
    >
      <span className="figure-image-wrap">
        <img src={editorialImage(item, index)} alt={item.caption} />
      </span>
      <span className="figure-caption">
        Fig. {String(index + 1).padStart(2, "0")} — {figureCredit(index)}
      </span>
    </button>
  );
}

/**
 * The grid of figures, in the spread arrangement.
 *
 * Shared by the home page's gallery section and the figures page, because the
 * photographs are the same list read twice — two grids would make two places
 * where a caption and an upload could drift apart.
 */
export function EditorialFigureGrid({
  items,
  onOpen,
  className = "",
}: {
  items: EditorialMoment[];
  onOpen: (index: number) => void;
  className?: string | undefined;
}) {
  return (
    <div className={`editorial-gallery-grid ${className}`}>
      {items.map((item, index) => (
        <EditorialFigure key={`${item.caption}-${index}`} item={item} index={index} onOpen={onOpen} />
      ))}
    </div>
  );
}

/**
 * The lightbox — "the spread".
 *
 * Mounted open or not at all: the reason a `null` figure falls out at the top
 * rather than inside the JSX, so an out-of-range index can never half-render a
 * dialog missing its caption.
 */
export function EditorialLightbox({
  items,
  selected,
  onClose,
}: {
  items: EditorialMoment[];
  /** Index of the open figure, or null when the spread is closed. */
  selected: number | null;
  onClose: () => void;
}) {
  if (selected === null) return null;

  const item = items[selected];
  if (!item) return null;

  return (
    <div className="editorial-lightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <button className="editorial-close" onClick={onClose} aria-label="Close gallery">
        ×
      </button>
      <div className="editorial-spread" onClick={(event) => event.stopPropagation()}>
        <div className="editorial-spread-caption">
          <span className="editorial-spread-kicker">
            figure {String(selected + 1).padStart(2, "0")}
          </span>
          <h2>{item.caption}</h2>
          <p>{item.note}</p>
          <small>{figureCredit(selected)}</small>
        </div>
        <div className="editorial-spread-image">
          <img src={editorialImage(item, selected)} alt={item.caption} />
        </div>
      </div>
    </div>
  );
}
