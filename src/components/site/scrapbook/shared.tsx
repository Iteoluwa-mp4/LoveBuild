import type { ScrapbookPaths } from "./paths";

/**
 * Pieces shared by the scrapbook template's pages.
 *
 * Scrabbook is the one template that could not have been a set of variants on
 * the classic components: taped polaroids at odd angles, a paper ground, a
 * handwriting face and stitched thread are not switches, they are different
 * objects. So it gets its own family, and `shared.tsx` holds the parts the two
 * of its pages agree on.
 *
 * The memory data is generated rather than photographic, so the template can be
 * judged as a design without shipping anyone else's pictures.
 */

export type ScrapbookMemory = {
  /** Printed on the polaroid's white border. */
  caption: string;
  /** The longer note, shown when a photo is opened. */
  note: string;
  /** A short date, stamped. */
  date: string;
  /**
   * Degrees of tilt.
   *
   * The rotation is data rather than CSS because it is the one thing that makes
   * a grid of identical cards read as scattered rather than aligned — and it has
   * to be stable across renders, or the layout jumps on every state change.
   */
  tilt: number;
  /** Which strip of tape holds this one down, and how it sits. */
  tape: "top-left" | "top-right" | "top-center" | "none";
  /** The generated photograph. */
  image: string;
};

/**
 * Builds a washed, slightly faded photograph.
 *
 * Deliberately low-contrast and warm. A crisp gradient looks like a screenshot;
 * these need to look like something printed years ago and stuck in a book.
 */
const makePhoto = (date: string, start: string, end: string): string => {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='720' height='720' viewBox='0 0 720 720'>` +
    `<defs>` +
    `<linearGradient id='sky' x1='0' y1='0' x2='0' y2='1'>` +
    `<stop offset='0' stop-color='%23${start}'/><stop offset='1' stop-color='%23${end}'/>` +
    `</linearGradient>` +
    `<filter id='soft'><feGaussianBlur stdDeviation='30'/></filter>` +
    `<filter id='fade'><feColorMatrix type='saturate' values='.55'/></filter>` +
    `<filter id='grain'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4'/>` +
    `<feColorMatrix type='matrix' values='0 0 0 0 .35 0 0 0 0 .3 0 0 0 0 .22 0 0 0 .18 0'/></filter>` +
    `</defs>` +
    `<rect width='720' height='720' fill='url(%23sky)'/>` +
    // Two blurred blooms, so the frame has depth rather than being a flat ramp.
    `<circle cx='220' cy='200' r='190' fill='%23ffffff' opacity='.3' filter='url(%23soft)'/>` +
    `<circle cx='520' cy='540' r='230' fill='%23${end}' opacity='.45' filter='url(%23soft)'/>` +
    // A horizon, which reads as "outdoors" without depicting anything.
    `<path d='M0 520 C200 470 320 560 720 500 L720 720 L0 720Z' fill='%23${start}' opacity='.38'/>` +
    `<rect width='720' height='720' fill='%23e8dcc8' opacity='.22' filter='url(%23fade)'/>` +
    `<rect width='720' height='720' filter='url(%23grain)'/>` +
    `<text x='36' y='684' font-family='Georgia,serif' font-size='26' fill='%23ffffff' opacity='.72'>` +
    `${date}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

export const MEMORIES: ScrapbookMemory[] = [
  {
    caption: "the first one",
    note: "I still have the ticket. You kept the flowers.",
    date: "OCT 2019",
    tilt: -3.2,
    tape: "top-center",
    image: makePhoto("OCT 2019", "d9a86c", "b47b52"),
  },
  {
    caption: "rain, and you",
    note: "We missed the last bus and neither of us mentioned it.",
    date: "MAR 2020",
    tilt: 2.6,
    tape: "top-left",
    image: makePhoto("MAR 2020", "8fa9b8", "5d7d92"),
  },
  {
    caption: "our song",
    note: "Three playlists deep and we still had only ever needed the one.",
    date: "JUN 2021",
    tilt: -1.8,
    tape: "top-right",
    image: makePhoto("JUN 2021", "a3b98a", "6f8a5c"),
  },
  {
    caption: "the ordinary one",
    note: "Nothing happened. That is the whole point of it.",
    date: "JAN 2023",
    tilt: 3.4,
    tape: "top-center",
    image: makePhoto("JAN 2023", "c9a3a3", "9c6f6f"),
  },
  {
    caption: "still my favourite",
    note: "Every other room I would have to be talked into.",
    date: "NOW",
    tilt: -2.4,
    tape: "top-left",
    image: makePhoto("NOW", "b9a3c9", "8a6f9c"),
  },
  {
    caption: "next one",
    note: "Same place, more years, better weather.",
    date: "SOON",
    tilt: 1.9,
    tape: "top-right",
    image: makePhoto("SOON", "dcc9a3", "b39a6f"),
  },
];

/** Whether this page is the home page or the gallery. */
export function ScrapbookTopBar({
  active,
  paths,
}: {
  active: "home" | "gallery";
  paths: ScrapbookPaths;
}) {
  return (
    <header className="sb-topbar">
      <a className="sb-mark" href={paths.home}>
        <span className="sb-mark-dot" />
        ours
      </a>

      <nav className="sb-nav" aria-label="Sections">
        <a href={paths.home} aria-current={active === "home" ? "page" : undefined}>
          cover
        </a>
        <a
          href={paths.gallery}
          aria-current={active === "gallery" ? "page" : undefined}
        >
          the album
        </a>
      </nav>
    </header>
  );
}

export function ScrapbookFooter({ paths }: { paths: ScrapbookPaths }) {
  return (
    <footer className="sb-footer">
      <span className="sb-hand">ours, always</span>
      <a className="sb-type" href={paths.home}>
        back to the cover
      </a>
      <span className="sb-type">♡</span>
    </footer>
  );
}

/**
 * A strip of tape holding a photograph down.
 *
 * The stripes are a repeating gradient rather than an image, so the tape
 * stretches to any width without a second asset, and the opacity is low enough
 * that whatever is behind it still reads through — real tape is not opaque.
 */
export function Tape({
  where,
}: {
  where: ScrapbookMemory["tape"];
}) {
  if (where === "none") return null;
  return <span className={`sb-tape sb-tape-${where}`} aria-hidden="true" />;
}

/**
 * The scrapbook's ground and chrome.
 *
 * Warm paper rather than the dark gradients the other two templates use, which
 * is most of why this one has to be its own family: the accent colours that
 * read as gold on midnight are illegible on cream.
 */
export const SCRAPBOOK_BASE_CSS = `
:root {
  --paper:#efe6d5;
  --paper-deep:#e3d7c2;
  --paper-shadow:#d8c9ae;
  --ink:#3b3229;
  --ink-soft:#6b5f52;
  --ink-faint:#9b8d7c;
  --red:#a8453a;
  --blue:#4a6b8a;
  --tape:#e8d9b8;
  --line:#cbbb9f;
}
* { box-sizing:border-box; }
html { scroll-behavior:smooth; }
body { margin:0; background:var(--paper); color:var(--ink); font-family:'Karla',sans-serif; }
button, a { font:inherit; color:inherit; }
a { text-decoration:none; }

/* Paper fibre. Two layers: a fine speckle and a few long fibres, because flat
   speckle alone reads as monitor noise rather than as a surface. */
.sb-shell {
  min-height:100vh;
  position:relative;
  overflow:hidden;
  background:
    radial-gradient(ellipse at 20% 8%, rgba(255,255,255,.5), transparent 45%),
    radial-gradient(ellipse at 85% 92%, rgba(196,178,146,.4), transparent 50%),
    var(--paper);
}
.sb-fibre {
  position:fixed; inset:0; z-index:0; pointer-events:none; opacity:.5;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='.1'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='.45'/%3E%3C/svg%3E");
  mix-blend-mode:multiply;
}
.sb-vignette {
  position:fixed; inset:0; z-index:1; pointer-events:none;
  box-shadow:inset 0 0 160px rgba(120,100,70,.22);
}

.sb-topbar, main, .sb-footer { position:relative; z-index:2; }
.sb-topbar {
  display:flex; align-items:center; justify-content:space-between;
  padding:30px 6vw 24px;
}
.sb-mark {
  display:inline-flex; align-items:center; gap:10px;
  font-family:'Caveat',cursive; font-size:30px; line-height:1; color:var(--ink);
}
.sb-mark-dot { width:9px; height:9px; border-radius:50%; background:var(--red); }
.sb-nav { display:flex; gap:24px; }
.sb-nav a {
  font-family:'Special Elite',monospace; font-size:13px; letter-spacing:.06em;
  color:var(--ink-soft); padding-bottom:2px;
  border-bottom:1px solid transparent; transition:.2s;
}
.sb-nav a:hover { color:var(--ink); }
.sb-nav a[aria-current='page'] { color:var(--red); border-bottom-color:var(--red); }

.sb-hand { font-family:'Caveat',cursive; }
.sb-type { font-family:'Special Elite',monospace; letter-spacing:.06em; }

.sb-hand-h1 {
  font-family:'Caveat',cursive; font-weight:700;
  font-size:clamp(56px,11vw,150px); line-height:.9;
  margin:0; letter-spacing:-.01em;
}
.sb-type-small { font-family:'Special Elite',monospace; font-size:12px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-faint); }

/* Stamped labels. Rotated because a stamp is never applied square. */
.sb-stamp {
  display:inline-block; font-family:'Special Elite',monospace;
  font-size:12px; letter-spacing:.14em; text-transform:uppercase;
  color:var(--red); border:2px solid var(--red);
  padding:5px 12px; border-radius:3px; opacity:.8;
  transform:rotate(-3deg);
}

/* Torn paper edge. A clip-path rather than an image, so any element can use it
   and it scales with the element. */
.sb-torn { clip-path:polygon(0 2%,4% 0,9% 3%,14% 1%,19% 4%,25% 1%,31% 3%,37% 0,43% 3%,49% 1%,55% 4%,61% 1%,67% 3%,73% 0,79% 3%,85% 1%,91% 4%,96% 1%,100% 3%,100% 100%,0 100%); }
.sb-torn-b { clip-path:polygon(0 0,100% 0,100% 97%,96% 100%,91% 96%,85% 100%,79% 97%,73% 100%,67% 96%,61% 100%,55% 97%,49% 100%,43% 96%,37% 100%,31% 97%,25% 100%,19% 96%,14% 100%,9% 97%,4% 100%,0 97%); }

.sb-tape {
  position:absolute; z-index:3; width:104px; height:26px;
  background:repeating-linear-gradient(115deg, rgba(232,217,184,.82) 0 7px, rgba(232,217,184,.55) 7px 14px);
  box-shadow:0 1px 3px rgba(90,74,48,.22);
  /* The torn ends that stop real tape looking like a rectangle. */
  clip-path:polygon(0 0,100% 4%,98% 100%,2% 96%);
}
.sb-tape-top-left { top:-11px; left:-16px; transform:rotate(-26deg); }
.sb-tape-top-right { top:-11px; right:-16px; transform:rotate(24deg); }
.sb-tape-top-center { top:-12px; left:50%; margin-left:-52px; transform:rotate(-3deg); }

/* A brass brad holding a page corner down. */
.sb-brad {
  position:absolute; z-index:4; width:13px; height:13px; border-radius:50%;
  background:radial-gradient(circle at 34% 30%, #f3dfae, #a8813f 62%, #6d5220);
  box-shadow:0 1px 2px rgba(70,54,24,.4);
}
.sb-brad-tl { top:-6px; left:-6px; }
.sb-brad-br { bottom:-6px; right:-6px; }

.sb-footer {
  display:flex; align-items:center; justify-content:space-between;
  padding:28px 6vw 40px; border-top:1px solid var(--line);
}
.sb-footer a:hover { color:var(--red); }

@media (max-width:700px) {
  .sb-topbar { padding:22px 6vw 18px; }
  .sb-mark { font-size:25px; }
  .sb-footer { flex-wrap:wrap; gap:12px 20px; }
}
`;

/** Webfonts. Caveat for handwriting, Special Elite for the typewriter. */
export const SCRAPBOOK_FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=Karla:wght@400;500;700&family=Special+Elite&display=swap');";