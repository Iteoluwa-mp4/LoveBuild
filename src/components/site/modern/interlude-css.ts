/**
 * The interludes' styles.
 *
 * A string rather than a stylesheet import, for the same reason `strip-css.ts` is
 * one: this template emits its CSS as a value so a file can both inject the rules
 * and read the tokens they define.
 *
 * These are the two full-bleed breaks in the page. Neither takes author copy —
 * they are built to lengthen and pace the page and to give the eye somewhere to
 * rest between sections, so anything editable here would be a field the author
 * has to fill before the section earns its place.
 */
export const MODERN_INTERLUDE_CSS = `

/* ==================================================================
   DRIFT BAND
   A full-bleed band of the moment captions, moving sideways at
   reading speed. It is the page's texture between two blocks of
   argument, and the only thing that moves while nothing else does.
   ================================================================== */

.drift {
  position:relative;
  overflow:hidden;
  border-top:1px solid var(--line);
  border-bottom:1px solid var(--line);
  padding:clamp(2.5rem, 6vw, 4.5rem) 0;
}

/* The fade at each end, so a caption is never cut mid-word at the edge. */
.drift:before,
.drift:after {
  content:"";
  position:absolute;
  top:0; bottom:0;
  width:clamp(60px, 12vw, 180px);
  z-index:2;
  pointer-events:none;
}
.drift:before { left:0; background:linear-gradient(90deg, var(--bg), transparent); }
.drift:after { right:0; background:linear-gradient(270deg, var(--bg), transparent); }

.drift__row {
  display:flex;
  width:max-content;
  gap:clamp(2rem, 5vw, 4rem);
  white-space:nowrap;
}

.drift__row + .drift__row { margin-top:clamp(.6rem, 1.4vw, 1rem); }

/* Two rows, opposite directions, at different speeds. One row at one speed
   reads as a conveyor belt; the mismatch is what makes it feel like drift. */
.drift__row--a { animation:drift-left 64s linear infinite; }
.drift__row--b { animation:drift-right 88s linear infinite; }

@keyframes drift-left  { from { transform:translateX(0); }            to { transform:translateX(-50%); } }
@keyframes drift-right { from { transform:translateX(-50%); }          to { transform:translateX(0); } }

.drift__item {
  color:var(--muted);
  font-size:clamp(13px, 1.5vw, 17px);
  letter-spacing:0;
  display:inline-flex;
  align-items:center;
  gap:clamp(2rem, 5vw, 4rem);
}

/* The separator is the accent, so the band is made of the same material as the
   rest of the page rather than of a new one. */
.drift__item:after {
  content:"";
  width:5px; height:5px;
  border-radius:50%;
  background:var(--pink);
  opacity:.55;
}

.drift__row--b .drift__item { color:var(--faint); font-style:italic; }
.drift__row--b .drift__item:after { opacity:.3; }

/*
  Pausing on hover is not an accessibility feature and is not claimed as one.
  It is the ordinary contract for moving text: a reader who has caught a caption
  with the cursor should not have to watch it walk away.
*/
.drift:hover .drift__row { animation-play-state:paused; }

/* ==================================================================
   SIGNAL
   The second break: the site's own name at a scale that stops the
   page, with the orbit from the hero resolved large enough to be
   read as a shape rather than as a detail.
   ================================================================== */

.signal {
  position:relative;
  overflow:hidden;
  padding:clamp(6rem, 18vh, 13rem) 5vw;
  text-align:center;
  display:grid;
  place-items:center;
  min-height:clamp(320px, 56vh, 560px);
}

.signal__ring {
  position:absolute;
  left:50%; top:50%;
  width:min(78vw, 720px);
  aspect-ratio:1;
  transform:translate(-50%,-50%);
  border:1px solid var(--theme-accent-line, rgba(255,184,203,.24));
  border-radius:50%;
  pointer-events:none;
}
.signal__ring:before,
.signal__ring:after {
  content:"";
  position:absolute;
  border-radius:50%;
  border:1px solid var(--theme-ring-alt, rgba(170,139,255,.32));
  inset:16%;
  transform:rotate(28deg) skewX(-12deg);
}
.signal__ring:after {
  inset:33%;
  transform:rotate(-44deg) skewX(15deg);
  border-color:var(--theme-accent-edge, rgba(255,184,203,.4));
}

/* A slow breath, so the ring is present rather than still. */
.signal__ring { animation:signal-breathe 14s ease-in-out infinite; }
@keyframes signal-breathe {
  0%, 100% { transform:translate(-50%,-50%) scale(1); }
  50%      { transform:translate(-50%,-50%) scale(1.045); }
}

.signal__body { position:relative; z-index:1; max-width:900px; }

.signal__name {
  font-family:'Playfair Display',serif;
  font-weight:400;
  font-style:italic;
  /* Large, but not the 132px of the hero: this is a held note, not a
     statement, and it has to be readable as one line on a phone. */
  font-size:clamp(40px, 9vw, 116px);
  line-height:1.02;
  letter-spacing:-.02em;
  color:var(--ink);
  margin:0;
  text-wrap:balance;
}

.signal__count {
  margin:clamp(1.5rem, 3vw, 2.25rem) 0 0;
  color:var(--faint);
  font-family:'DM Mono',monospace;
  text-transform:uppercase;
  letter-spacing:.18em;
  font-size:10px;
}

/* ==================================================================
   REDUCED MOTION
   The band stops and its two copies sit still; the ring holds its
   shape. Neither is content, so stopping the movement changes nothing
   a reader gets.
   ================================================================== */

@media (prefers-reduced-motion:reduce) {
  .drift__row,
  .signal__ring { animation:none; }

  /*
    With the animation gone the row is a single set of items parked at the
    left edge, so the second copy is what keeps the band full. Both are hidden
    from assistive tech either way, so which one is on screen is purely a
    visual choice.
  */
  .drift__row--b { transform:translateX(0); }
}
`;