/**
 * The photo strip's styles.
 *
 * A string rather than a stylesheet import, to match `MODERN_BASE_CSS` in
 * `shared.tsx`: these templates emit their CSS as a value so that the same file
 * can both inject the rules and read the tokens they define.
 *
 * The shape of the thing is: a fixed-height band, slices laid out in a row, and
 * exactly one of them wide. Everything else is the narrow ones being pushed out
 * of the way, which is why the transition is on width rather than on transform —
 * width is what pushes its neighbours, so animating anything else would leave
 * the row reflowing under a moving highlight.
 */
export const MODERN_STRIP_CSS = `
.strip { width:100%; }

.strip-frame {
  position:relative;
  background:var(--bg);
  border-top:1px solid var(--line);
  border-bottom:1px solid var(--line);
  overflow:hidden;
}

.strip-track {
  display:flex;
  align-items:stretch;
  height:clamp(260px, 42vw, 460px);
  overflow-x:auto;
  overflow-y:hidden;
  scrollbar-width:none;
}

/*
  Centring, without justify-content.

  justify-content:center would do this in one line and break the scroll: a
  centred flex row that overflows spills equally on both sides, and the spill on
  the left cannot be scrolled to, so the first slice becomes permanently
  unreachable. Measured with four slices in a 420px track, it sat 60px off the left
  edge at scrollLeft 0.

  Auto margins on the two ends do the same job safely. They absorb all the free
  space when there is any, which centres a short row, and collapse to zero when
  there is not, which restores ordinary left-to-right scrolling. The second rule
  only matters when there is exactly one slice, where it is both first and last.
*/
.strip-track > :first-child { margin-left:auto; }
.strip-track > :last-child { margin-right:auto; }

.strip-slice {
  position:relative;
  flex:0 0 auto;
  width:clamp(56px, 8vw, 104px);
  padding:0;
  border:0;
  border-right:1px solid var(--line);
  margin:0;
  background:var(--tint);
  cursor:pointer;
  overflow:hidden;
  scroll-snap-align:center;
  transition:
    width .55s cubic-bezier(.16,1,.3,1),
    filter .45s ease,
    opacity .45s ease;
  opacity:.42;
  filter:saturate(.55) brightness(.72);
}

.strip-slice img {
  width:100%;
  height:100%;
  object-fit:cover;
  object-position:50% 50%;
  display:block;
  /* The slice is the crop; letting it breathe keeps the edge from smearing. */
  filter:saturate(1.05) contrast(1.02);
  transition:transform .8s cubic-bezier(.16,1,.3,1), filter .45s ease;
}

.strip-slice:hover { opacity:.72; }
.strip-slice:hover img { transform:scale(1.04); }

.strip-slice.is-active {
  width:clamp(180px, 30vw, 340px);
  opacity:1;
  filter:none;
  cursor:default;
}

/*
  The white box from the reference. An inset outline rather than a border, so it
  does not change the slice's width when it appears and shove the row sideways.
*/
.strip-slice.is-active::after {
  content:'';
  position:absolute;
  inset:10px;
  border:1px solid rgba(255,255,255,.9);
  pointer-events:none;
}

/* Keyboard focus needs to be visible without adding a second box. */
.strip-slice:focus-visible { outline:2px solid var(--pink); outline-offset:-2px; }

.strip-index {
  position:absolute;
  left:10px;
  bottom:16px;
  font-family:'DM Mono',monospace;
  font-size:10px;
  letter-spacing:.14em;
  color:rgba(255,255,255,.72);
  opacity:0;
  transition:opacity .4s ease;
  text-shadow:0 1px 8px rgba(0,0,0,.7);
}
.strip-slice.is-active .strip-index,
.strip-slice:hover .strip-index { opacity:1; }

.strip-badge {
  position:absolute;
  top:16px;
  right:16px;
  width:46px;
  height:46px;
  display:grid;
  place-items:center;
  border-radius:14px;
  /* Themed, with the template's original values as fallbacks. */
  background:var(--theme-accent-wash, rgba(255,184,203,.14));
  border:1px solid var(--theme-accent-edge, rgba(255,184,203,.42));
  color:var(--pink);
  backdrop-filter:blur(8px);
}

.strip-caption {
  display:flex;
  flex-wrap:wrap;
  align-items:baseline;
  gap:6px 14px;
  padding:18px 5vw 0;
  max-width:1220px;
  margin:0 auto;
}
.strip-caption strong {
  font-family:'DM Mono',monospace;
  text-transform:uppercase;
  letter-spacing:.14em;
  font-size:10px;
  font-weight:500;
  color:var(--pink);
}
.strip-caption span { font-size:13px; color:var(--muted); }

@media (prefers-reduced-motion: reduce) {
  .strip-slice,
  .strip-slice img { transition:none; }
  .strip-slice.is-active { width:clamp(180px, 30vw, 340px); }
}

@media (max-width:760px) {
  .strip-track { height:clamp(220px, 62vw, 320px); }
  .strip-slice { width:64px; }
  .strip-slice.is-active { width:min(66vw, 260px); }
  .strip-caption { padding:14px 6vw 0; }
}
`;