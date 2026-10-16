import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ScrapbookMemory } from "./shared";

/**
 * A flipbook.
 *
 * ## The mechanics, because they are not obvious
 *
 * A leaf is one sheet with two faces: `front` is an odd page, `back` is the even
 * page after it. With `k` leaves turned, the spread shows page `2k` on the left
 * and page `2k+1` on the right. Turning leaf `k` swings it leftward, so the face
 * that was facing you ends up on your left — and what you can now see on the
 * right is the *next* leaf's front, which is the whole illusion.
 *
 * Turning a leaf back is the same rotation about a different origin. The trick
 * that lets one element do both jobs is that the two faces are swapped for a
 * backward turn: a leaf lying on the left must show its `back`, and CSS only
 * ever reveals whichever face is called `front`. Swapping them is far less
 * fragile than maintaining a second set of face elements.
 *
 * ## One number drives everything
 *
 * A turn is a single progress value `p`: 0 with the leaf at rest, 1 once it has
 * landed on the other side, in both directions. A drag writes `p` from the
 * pointer; a scripted turn writes it from a requestAnimationFrame tween. Either
 * way the same `paint(p)` positions the leaf and works out the lighting, so a
 * drag released halfway carries on from exactly where the finger left it.
 *
 * `p` is written straight to the DOM rather than through React state. Sixty
 * re-renders a second of a whole album is how a page turn ends up stuttering.
 *
 * ## Why rigid rotation rather than a bending mesh
 *
 * A real sheet bends. This does not — the leaf is a flat element on a `rotateY`.
 * What sells it anyway is the light: a shade that deepens as the sheet turns
 * edge-on and fades as it lands, a shadow cast onto the pages beneath, and a
 * small lift toward the viewer at mid-turn so the sheet is clearly in the air.
 * All three are derived from `sin(p·π)`, so they peak together at 90°.
 *
 * ## Drag
 *
 * Progress is distance dragged over the width of one page, clamped. A turn
 * commits past half a page, or on a fast flick regardless of distance — a flick
 * is a statement of intent; a half-drag that stops and hovers is not. Nothing
 * starts until the pointer has moved a few pixels in the allowed direction, so
 * a plain click on a photograph is still a click.
 */

type Page =
  | { kind: "photo"; memory: ScrapbookMemory }
  | { kind: "note"; memory: ScrapbookMemory }
  | { kind: "end" };

/** How long a single scripted turn takes, ms. */
const TURN_MS = 1150;

/** Per-leaf time when jumping across several leaves, so a long jump still reads as flipping without taking half a minute. */
const WALK_MS = 560;

/** A flick faster than this commits however far it travelled. Pages per ms (≈2.5 pages a second). */
const FLICK_VELOCITY = 0.0025;

/** Pixels the pointer must travel before a drag becomes a page turn. */
const DRAG_SLOP = 8;

/** How far the sheet rises toward the viewer at mid-turn, px. */
const LIFT_PX = 26;

/** Gentle lift-off, quick middle, soft landing: a sine blended with a cubic. */
const easeInOut = (t: number) => {
  const sine = 0.5 - Math.cos(Math.PI * t) / 2;
  const cubic = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  return (sine + cubic) / 2;
};

/** For a release: the leaf is already moving, so start fast and settle. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function Flipbook({
  memories,
  onPick,
}: {
  memories: ScrapbookMemory[];
  /**
   * A photograph was chosen. Lets the host open it at full size — the book is a
   * navigation device and should not be the only way to do anything with a
   * memory.
   */
  onPick?: (memory: ScrapbookMemory) => void;
}) {
  /*
    Two pages per memory — the photograph, then the note belonging to it — and a
    closing card. A memory whose note is never reached is half a memory; pairing
    them means a turn always lands on the thing it was turning towards.
  */
  const pages = useMemo<Page[]>(() => {
    const out: Page[] = [];
    for (const memory of memories) {
      out.push({ kind: "photo", memory });
      out.push({ kind: "note", memory });
    }
    out.push({ kind: "end" });
    return out;
  }, [memories]);

  const leafCount = Math.ceil(pages.length / 2);

  /**
   * Leaves turned. The settled spread is derived from this one number, and it
   * only changes when a turn *finishes* — so what sits underneath a moving leaf
   * is always worked out from where the turn started.
   */
  const [leaf, setLeaf] = useState(0);
  /** The leaf mid-turn and which way. Null when nothing is moving. */
  const [turn, setTurn] = useState<{ index: number; dir: 1 | -1 } | null>(null);
  const [closed, setClosed] = useState(true);

  const stageRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const leafEl = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{
    startX: number;
    dir: 1 | -1;
    startedAt: number;
    active: boolean;
  } | null>(null);

  /** `leaf` mirrored into a ref so handlers and the walk can read it without waiting for a render. */
  const leafRef = useRef(0);
  /** Turn progress, 0–1. The only copy; never in React state. */
  const progress = useRef(0);
  const dirRef = useRef<1 | -1>(1);
  /** True from the moment a turn begins until it has landed or fallen back. */
  const busy = useRef(false);
  /** One turn requested mid-turn, run as soon as the current one lands. */
  const queued = useRef<0 | 1 | -1>(0);
  const animFrame = useRef(0);
  const walkTimer = useRef(0);
  const walkTarget = useRef<number | null>(null);
  const beginRef = useRef<(dir: 1 | -1) => void>(() => {});

  /** The only place `leafRef` and `leaf` are written. */
  const goToLeaf = useCallback((next: number) => {
    leafRef.current = next;
    setLeaf(next);
  }, []);

  /** Cancels a walk in progress, so a turn during a flip takes over cleanly. */
  const stopWalk = useCallback(() => {
    walkTarget.current = null;
    window.clearTimeout(walkTimer.current);
  }, []);

  /** Page `n`, one-indexed the way a book numbers them. */
  const page = (n: number): Page | null => pages[n - 1] ?? null;

  /* ---------------------------------------------------------------- *
   * Painting
   * ---------------------------------------------------------------- */

  /**
   * Put the leaf, and its light, at progress `p`.
   *
   * The sheet turns about the spine, rises a little toward the viewer, and
   * darkens as it goes edge-on. The pages beneath pick up a shadow: the one it
   * is leaving fades as it lifts, the one it is arriving on deepens as it
   * comes down. Every figure is a function of `sin(p·π)` so the lighting never
   * disagrees with the geometry.
   */
  const paint = useCallback((p: number) => {
    progress.current = p;
    const dir = dirRef.current;
    const s = Math.sin(p * Math.PI);

    const el = leafEl.current;
    if (el) {
      el.style.transform = `translateZ(${(s * LIFT_PX).toFixed(2)}px) rotateY(${(
        -dir *
        p *
        180
      ).toFixed(3)}deg)`;
    }

    const book = bookRef.current;
    if (book) {
      const leaving = s * (1 - p) * 0.6;
      const arriving = s * p * 0.6;
      book.style.setProperty("--shade", (s * 0.5).toFixed(3));
      book.style.setProperty(
        "--cast-r",
        (dir === 1 ? leaving : arriving).toFixed(3),
      );
      book.style.setProperty(
        "--cast-l",
        (dir === 1 ? arriving : leaving).toFixed(3),
      );
    }
  }, []);

  /** The leaf element mounts a render after the turn is requested; give it its angle the moment it exists. */
  const attachLeaf = useCallback(
    (el: HTMLDivElement | null) => {
      leafEl.current = el;
      if (el) paint(progress.current);
    },
    [paint],
  );

  /** Tween progress from `from` to `to`. A new tween replaces any running one. */
  const animate = useCallback(
    (
      from: number,
      to: number,
      ms: number,
      ease: (t: number) => number,
      done: () => void,
    ) => {
      cancelAnimationFrame(animFrame.current);
      const t0 = performance.now();
      const tick = (now: number) => {
        const t = clamp01((now - t0) / ms);
        paint(from + (to - from) * ease(t));
        if (t < 1) {
          animFrame.current = requestAnimationFrame(tick);
        } else {
          animFrame.current = 0;
          done();
        }
      };
      animFrame.current = requestAnimationFrame(tick);
    },
    [paint],
  );

  /* ---------------------------------------------------------------- *
   * Turning
   * ---------------------------------------------------------------- */

  /**
   * Tween a turn that is already mounted and then settle it.
   *
   * Landing (`to === 1`) commits the new leaf count and removes the moving
   * leaf in the same update, so the book swaps from "sheet in the air" to
   * "sheet lying flat" without a frame where both or neither exist. Falling
   * back (`to === 0`) just removes the leaf.
   */
  const run = useCallback(
    (
      dir: 1 | -1,
      from: number,
      to: 0 | 1,
      ms: number,
      ease: (t: number) => number,
      onDone?: () => void,
    ) => {
      animate(from, to, prefersReducedMotion() ? 1 : ms, ease, () => {
        progress.current = 0;
        busy.current = false;
        if (to === 1) {
          goToLeaf(Math.max(0, Math.min(leafCount, leafRef.current + dir)));
        }
        setTurn(null);
        onDone?.();

        const next = queued.current;
        queued.current = 0;
        if (next) beginRef.current(next);
      });
    },
    [animate, goToLeaf, leafCount],
  );

  /** Start a scripted turn from rest. */
  const begin = useCallback(
    (dir: 1 | -1, onDone?: () => void, ms = TURN_MS) => {
      const j = leafRef.current;
      if (dir === 1 ? j >= leafCount : j <= 0) return;

      busy.current = true;
      dirRef.current = dir;
      progress.current = 0;
      setTurn({ index: dir === 1 ? j : j - 1, dir });
      run(dir, 0, 1, ms, easeInOut, onDone);
    },
    [leafCount, run],
  );

  useEffect(() => {
    beginRef.current = (dir) => begin(dir);
  }, [begin]);

  /**
   * Turn one leaf. Every user-driven path — arrows, keyboard — goes through
   * here. A press during a turn is held and run the moment the leaf lands,
   * rather than being dropped or, worse, fighting the leaf in the air.
   */
  const swing = useCallback(
    (dir: 1 | -1) => {
      stopWalk();
      if (busy.current) {
        queued.current = dir;
        return;
      }
      begin(dir);
    },
    [begin, stopWalk],
  );

  /**
   * Walk to a leaf one turn at a time, so a jump reads as flipping through
   * rather than teleporting. Each step starts when the last one has landed, so
   * the pace follows the animation instead of a parallel timer guessing at it.
   */
  const flipTo = useCallback(
    (target: number) => {
      const clamped = Math.max(0, Math.min(leafCount, target));
      if (leafRef.current === clamped) return;
      setClosed(false);

      stopWalk();
      queued.current = 0;
      walkTarget.current = clamped;

      const step = () => {
        const goal = walkTarget.current;
        if (goal === null) return;
        if (busy.current) {
          walkTimer.current = window.setTimeout(step, 50);
          return;
        }
        const here = leafRef.current;
        if (here === goal) {
          walkTarget.current = null;
          return;
        }
        begin(
          here < goal ? 1 : -1,
          () => {
            walkTimer.current = window.setTimeout(step, 30);
          },
          Math.abs(goal - here) > 1 ? WALK_MS : TURN_MS,
        );
      };
      step();
    },
    [begin, leafCount, stopWalk],
  );

  /* ---------------------------------------------------------------- *
   * Drag
   * ---------------------------------------------------------------- */

  const onPointerDown = (event: React.PointerEvent) => {
    if (closed || busy.current) return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Which leaf you grab decides which way it can go: the right leaf pulls
    // left, the left leaf pushes right.
    const dir: 1 | -1 = event.clientX < rect.left + rect.width / 2 ? -1 : 1;
    if (dir === -1 && leafRef.current === 0) return;
    if (dir === 1 && leafRef.current >= leafCount) return;

    // Only noted, not started. The turn begins once the pointer has actually
    // moved, so a click on a photograph still reaches the photograph.
    dragState.current = {
      startX: event.clientX,
      dir,
      startedAt: 0,
      active: false,
    };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const state = dragState.current;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!state || !rect) return;

    // Dragging left is progress for a forward turn and the reverse for a
    // backward one, so the leaf always follows the pointer whichever way it
    // is allowed to move.
    const dx = state.startX - event.clientX;
    const travelled = state.dir === 1 ? dx : -dx;

    if (!state.active) {
      if (travelled < DRAG_SLOP) return;
      const j = leafRef.current;
      state.active = true;
      state.startedAt = performance.now();
      busy.current = true;
      dirRef.current = state.dir;
      progress.current = 0;
      stopWalk();
      setTurn({ index: state.dir === 1 ? j : j - 1, dir: state.dir });
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    }

    paint(clamp01((travelled - DRAG_SLOP) / (rect.width / 2)));
  };

  const endDrag = (event: React.PointerEvent) => {
    const state = dragState.current;
    dragState.current = null;
    // Never became a drag: it was a click, and it is not ours.
    if (!state || !state.active) return;

    const host = event.currentTarget as HTMLElement;
    if (host.hasPointerCapture?.(event.pointerId)) {
      host.releasePointerCapture(event.pointerId);
    }

    const p = progress.current;
    const elapsed = performance.now() - state.startedAt;
    const velocity = p / Math.max(1, elapsed);
    // A flick is a statement of intent; a half-drag that stops and hovers is
    // not. So a fast flick commits however short it was — within reason.
    const flick = velocity > FLICK_VELOCITY && p > 0.06;

    if (p > 0.5 || flick) {
      // The leaf is wherever the finger left it. Carry on from there, over a
      // time proportional to what is left, rather than snapping or restarting.
      run(state.dir, p, 1, Math.max(380, TURN_MS * (1 - p)), easeOut);
    } else {
      // Not far enough. Let it settle back where it came from.
      run(state.dir, p, 0, Math.max(300, 600 * p), easeOut);
    }
  };

  /* ---------------------------------------------------------------- *
   * Keyboard
   * ---------------------------------------------------------------- */

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (closed) setClosed(false);
        else swing(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        swing(-1);
      } else if ((event.key === "Enter" || event.key === " ") && closed) {
        event.preventDefault();
        setClosed(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closed, swing]);

  /* Nothing scheduled survives the component. */
  useEffect(
    () => () => {
      window.clearTimeout(walkTimer.current);
      cancelAnimationFrame(animFrame.current);
    },
    [],
  );

  /* ---------------------------------------------------------------- *
   * What the spread shows
   * ---------------------------------------------------------------- */

  /*
    `leaf` only changes when a turn lands, so under a moving leaf the spread is
    worked out from where the turn began:

      forward   the old left page stays put, and the right reveals the *next*
                leaf's front;
      backward  the left reveals the page two back, and the old right page
                stays put until the leaf comes down on it.

    Out-of-range pages come back null and render as endpaper.
  */
  const staticLeft = !turn
    ? page(leaf * 2)
    : turn.dir === 1
      ? page(leaf * 2)
      : page(leaf * 2 - 2);
  const staticRight = !turn
    ? page(leaf * 2 + 1)
    : turn.dir === 1
      ? page(leaf * 2 + 3)
      : page(leaf * 2 + 1);

  const faces = turn
    ? (() => {
        const front = page(turn.index * 2 + 1);
        const back = page(turn.index * 2 + 2);
        // Backward turn: the leaf is on the left, so it must show its back
        // before it moves and its front after it lands.
        return turn.dir === -1 ? { front: back, back: front } : { front, back };
      })()
    : null;

  const currentMemory =
    staticRight?.kind === "photo" || staticRight?.kind === "note"
      ? staticRight.memory
      : staticLeft?.kind === "photo" || staticLeft?.kind === "note"
        ? staticLeft.memory
        : null;

  return (
    <div className="fb">
      <div
        ref={stageRef}
        className="fb-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        role="group"
        aria-label="Photo album"
        aria-describedby="fb-hint"
      >
        <div className="fb-book" ref={bookRef}>
          {/* Left page */}
          <div className="fb-page fb-page-left">
            {staticLeft ? (
              <PageFace page={staticLeft} side="left" />
            ) : (
              <div className="fb-endpaper">
                <span className="fb-endpaper-mark sb-hand">ours</span>
              </div>
            )}
          </div>

          {/* Right page */}
          <div className="fb-page fb-page-right">
            {staticRight ? (
              <PageFace
                page={staticRight}
                side="right"
                onPick={onPick}
                pickable={!turn && staticRight.kind === "photo"}
              />
            ) : (
              <div className="fb-endpaper" />
            )}
          </div>

          {/* The leaf's shadow on the pages beneath it. */}
          {turn && (
            <>
              <div className="fb-cast fb-cast-left" aria-hidden="true" />
              <div className="fb-cast fb-cast-right" aria-hidden="true" />
            </>
          )}

          {/* The fold. Over the pages, under the leaf. */}
          <div className="fb-spine" aria-hidden="true" />

          {/* The leaf in mid-air */}
          {turn && faces && (
            <div
              ref={attachLeaf}
              className="fb-leaf"
              data-dir={turn.dir === 1 ? "fwd" : "back"}
            >
              <div className="fb-face fb-face-front">
                {faces.front ? (
                  <PageFace page={faces.front} side="left" />
                ) : (
                  <div className="fb-endpaper" />
                )}
                <span className="fb-shade" aria-hidden="true" />
              </div>
              <div className="fb-face fb-face-back">
                {faces.back ? (
                  <PageFace page={faces.back} side="right" />
                ) : (
                  <div className="fb-endpaper" />
                )}
                <span className="fb-shade" aria-hidden="true" />
              </div>
            </div>
          )}

          {/* The hard cover, in front of everything until it is opened. */}
          <div className="fb-cover" data-open={!closed}>
            <button
              type="button"
              className="fb-cover-btn"
              onClick={() => {
                stopWalk();
                setClosed(false);
              }}
              tabIndex={closed ? 0 : -1}
              aria-hidden={!closed}
            >
              <span className="fb-cover-title sb-hand-h1">ours</span>
              <span className="fb-cover-sub sb-type-small">
                a book of {memories.length}
              </span>
              <span className="fb-cover-open sb-hand">open me →</span>
            </button>
          </div>
        </div>
      </div>

      {/* Announced, not seen. A page flip is otherwise silent to a screen reader. */}
      <p className="fb-sr" id="fb-hint" role="status" aria-live="polite">
        {closed
          ? "Album closed. Open the book to begin."
          : `Page ${leaf * 2 + 1} of ${pages.length}.` +
            (currentMemory ? ` ${currentMemory.caption}: ${currentMemory.note}` : "")}
      </p>

      <div className="fb-controls">
        <button
          type="button"
          className="fb-arrow"
          onClick={() => swing(-1)}
          disabled={closed || leaf === 0}
          aria-label="Previous page"
        >
          ←
        </button>

        <ol className="fb-progress" aria-label="Pages">
          {pages.map((_, i) => {
            const reached = !closed && i + 1 <= leaf * 2 + 1;
            return (
              <li key={i}>
                <button
                  type="button"
                  className="fb-tick"
                  data-on={reached}
                  onClick={() => flipTo(Math.ceil((i + 1) / 2))}
                  aria-label={`Go to page ${i + 1}`}
                  aria-current={reached ? "true" : undefined}
                />
              </li>
            );
          })}
        </ol>

        <button
          type="button"
          className="fb-arrow"
          onClick={() => swing(1)}
          disabled={closed || leaf >= leafCount}
          aria-label="Next page"
        >
          →
        </button>
      </div>

      <p className="fb-meta sb-type-small">
        {closed ? "closed" : `page ${leaf * 2 + 1} / ${pages.length}`} ·
        drag or use ← →
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * A single page
 * ------------------------------------------------------------------ */

function PageFace({
  page,
  side,
  onPick,
  pickable = false,
}: {
  page: Page;
  side: "left" | "right";
  onPick?: ((memory: ScrapbookMemory) => void) | undefined;
  pickable?: boolean | undefined;
}) {
  if (page.kind === "end") {
    return (
      <div className="fb-page-inner fb-page-end">
        <span className="fb-end-mark sb-hand">the end</span>
        <span className="fb-end-note sb-hand">
          thank you for reading all of it
        </span>
      </div>
    );
  }

  if (page.kind === "note") {
    return (
      <div className="fb-page-inner fb-page-note">
        <p className="fb-note-date sb-type-small">{page.memory.date}</p>
        <p className="fb-note-body sb-hand">{page.memory.note}</p>
        <p className="fb-note-sign sb-hand">— us</p>
      </div>
    );
  }

  const photo = (
    <figure className="fb-polaroid">
      <img src={page.memory.image} alt={page.memory.caption} />
      <figcaption className="sb-hand">{page.memory.caption}</figcaption>
    </figure>
  );

  return (
    <div className="fb-page-inner fb-page-photo">
      {/* Only the settled right-hand page is pickable. The same photograph is
          rendered on the leaf mid-turn, and two live copies of the same button
          in the accessibility tree is worse than none. */}
      {pickable && onPick ? (
        <button
          type="button"
          className="fb-pick"
          onClick={() => onPick(page.memory)}
        >
          {photo}
          <span className="fb-pick-hint sb-hand">see it bigger</span>
        </button>
      ) : (
        photo
      )}
      {side === "left" && <span className="fb-page-no sb-type-small" />}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Styles
 * ------------------------------------------------------------------ */

export const FLIPBOOK_CSS = `
.fb { display:flex; flex-direction:column; align-items:center; gap:20px; }

/* A fixed-aspect stage. The book scales with the viewport rather than the page
   reflowing, because a flipbook whose pages change size mid-turn looks broken. */
.fb-stage {
  width:min(94vw, 880px);
  aspect-ratio:3 / 2;
  perspective:2200px;
  perspective-origin:50% 44%;
  touch-action:pan-y;
  cursor:grab;
  user-select:none;
  -webkit-user-select:none;
}
.fb-stage:active { cursor:grabbing; }

.fb-book {
  position:relative;
  width:100%; height:100%;
  transform-style:preserve-3d;
  /* Lying slightly open on a table, rather than facing you square on. */
  transform:rotateX(7deg);
}

.fb-page, .fb-leaf {
  position:absolute; top:0; width:50%; height:100%;
  backface-visibility:hidden;
}
.fb-page-left, .fb-leaf[data-dir='back'] { left:0; transform-origin:right center; }
.fb-page-right, .fb-leaf[data-dir='fwd'] { left:50%; transform-origin:left center; }

/* Rotates about the spine. Origin is set per direction above. The transform is
   written every frame by Flipbook's paint(), so there is deliberately no CSS
   transition here — one would fight it. preserve-3d lets the two faces hide
   their own backs; the leaf itself must stay visible past 90deg. */
.fb-leaf {
  z-index:6;
  transform-style:preserve-3d;
  backface-visibility:visible;
  will-change:transform;
}

.fb-face { position:absolute; inset:0; backface-visibility:hidden; overflow:hidden; }
.fb-face-back { transform:rotateY(180deg); }

/* Light. --shade, --cast-l and --cast-r are set on .fb-book each frame. The
   gradient runs from transparent at the spine to dark at the free edge, since
   that is the edge turning away from the light. */
.fb-shade {
  position:absolute; inset:0; pointer-events:none;
  opacity:var(--shade,0);
  background:linear-gradient(90deg, rgba(58,42,20,0) 8%, rgba(58,42,20,.6) 100%);
}
.fb-leaf[data-dir='back'] .fb-shade {
  background:linear-gradient(270deg, rgba(58,42,20,0) 8%, rgba(58,42,20,.6) 100%);
}

/* The shadow the lifted sheet throws on the pages beneath. */
.fb-cast { position:absolute; top:0; width:50%; height:100%; pointer-events:none; }
.fb-cast-left {
  left:0; opacity:var(--cast-l,0);
  background:linear-gradient(270deg, rgba(58,42,20,.7), rgba(58,42,20,0) 80%);
}
.fb-cast-right {
  left:50%; opacity:var(--cast-r,0);
  background:linear-gradient(90deg, rgba(58,42,20,.7), rgba(58,42,20,0) 80%);
}

/* Paper. An inner shadow at the gutter and a highlight opposite it — without
   those, two adjacent rectangles read as one flat block. */
.fb-page, .fb-face {
  background:
    linear-gradient(90deg, rgba(120,96,58,.22), rgba(120,96,58,0) 13%),
    linear-gradient(270deg, rgba(120,96,58,.15), rgba(120,96,58,0) 11%),
    var(--paper);
  box-shadow:inset 0 0 60px rgba(140,116,74,.15);
}

/* The fold. */
.fb-spine {
  position:absolute; left:50%; top:0; width:70px; height:100%;
  transform:translateX(-50%);
  z-index:5; pointer-events:none;
  background:linear-gradient(90deg,
    rgba(120,96,58,0) 0%, rgba(120,96,58,.24) 44%,
    rgba(120,96,58,.34) 50%, rgba(120,96,58,.24) 56%, rgba(120,96,58,0) 100%);
}

/* Hard cover. */
.fb-cover {
  position:absolute; inset:0; z-index:20;
  transform-origin:left center;
  transform:rotateY(0deg);
  transition:transform 1.15s cubic-bezier(.45,.05,.2,1), opacity .5s ease .7s;
  backface-visibility:hidden;
}
.fb-cover[data-open='true'] { transform:rotateY(-116deg); opacity:0; pointer-events:none; }

.fb-cover-btn {
  width:100%; height:100%; cursor:pointer; font:inherit; color:inherit;
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px;
  border:0; padding:6%;
  background:
    linear-gradient(115deg, rgba(255,255,255,.24), rgba(120,96,58,.16)),
    var(--paper-deep);
  box-shadow:inset 0 0 90px rgba(120,96,58,.3), 0 24px 50px -20px rgba(74,58,34,.55);
}
.fb-cover-title { font-size:clamp(60px,12vw,140px); }
.fb-cover-sub { color:var(--ink-faint); }
.fb-cover-open { font-size:clamp(20px,2.4vw,28px); color:var(--red); }

/* Page contents */
.fb-page-inner {
  width:100%; height:100%;
  padding:clamp(14px,3.2%,36px);
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:14px;
}

.fb-polaroid {
  margin:0; width:min(74%,280px); padding:10px 10px 0;
  background:#fdfaf3; border:1px solid rgba(180,164,136,.5);
  box-shadow:0 12px 26px -14px rgba(74,58,34,.55), 0 2px 5px rgba(74,58,34,.12);
}
.fb-polaroid img { display:block; width:100%; aspect-ratio:1; object-fit:cover; filter:grayscale(.14); }
.fb-polaroid figcaption { padding:7px 2px 10px; text-align:center; font-size:clamp(16px,2.2vw,22px); }

.fb-pick {
  display:flex; flex-direction:column; align-items:center; gap:10px;
  background:none; border:0; padding:0; cursor:pointer; font:inherit; color:inherit;
}
.fb-pick .fb-polaroid { transition:transform .22s ease, box-shadow .22s ease; }
.fb-pick:hover .fb-polaroid, .fb-pick:focus-visible .fb-polaroid {
  transform:translateY(-5px) rotate(-.6deg);
  box-shadow:0 22px 36px -16px rgba(74,58,34,.6), 0 2px 5px rgba(74,58,34,.12);
}
.fb-pick-hint { font-size:15px; color:var(--red); opacity:.75; }

.fb-note-date { margin:0; color:var(--ink-faint); }
.fb-note-body { margin:0; max-width:22ch; text-align:center; font-size:clamp(20px,2.9vw,29px); line-height:1.4; }
.fb-note-sign { margin:2px 0 0; color:var(--ink-faint); font-size:clamp(16px,2vw,20px); }

.fb-page-end { gap:10px; }
.fb-end-mark { font-size:clamp(32px,5.5vw,54px); }
.fb-end-note { color:var(--ink-soft); font-size:clamp(17px,2.2vw,23px); }

/* Backing paper under the first and last leaves. */
.fb-endpaper {
  width:100%; height:100%; display:grid; place-items:center;
  background:
    radial-gradient(ellipse at 50% 42%, rgba(255,255,255,.4), transparent 60%),
    var(--paper-deep);
  box-shadow:inset 0 0 70px rgba(140,116,74,.2);
}
.fb-endpaper-mark { font-size:clamp(28px,4.5vw,44px); color:var(--ink-faint); }

/* Controls */
.fb-controls { display:flex; align-items:center; gap:18px; }
.fb-arrow {
  width:42px; height:42px; border-radius:50%; cursor:pointer;
  border:1px solid var(--ink-faint); background:var(--paper-deep); color:var(--ink);
  font-size:17px; transition:.2s;
}
.fb-arrow:hover:not(:disabled) { background:var(--ink); color:var(--paper); }
.fb-arrow:disabled { opacity:.32; cursor:not-allowed; }

.fb-progress { display:flex; gap:5px; list-style:none; margin:0; padding:0; }
.fb-tick {
  width:15px; height:5px; padding:0; cursor:pointer;
  border:0; border-radius:3px; background:var(--paper-shadow); transition:.2s;
}
.fb-tick:hover { background:var(--ink-faint); }
.fb-tick[data-on='true'] { background:var(--red); }

.fb-meta { margin:0; color:var(--ink-faint); }

/* Visually hidden, still announced. */
.fb-sr {
  position:absolute; width:1px; height:1px; padding:0; margin:-1px;
  overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0;
}

@media (max-width:640px) {
  .fb-stage { width:96vw; aspect-ratio:4 / 3; }
}

@media (prefers-reduced-motion:reduce) {
  /* No travel, no fade — the spread simply changes. (The leaf is JS-driven and
     checks the same media query itself.) */
  .fb-cover { transition-duration:.01ms !important; }
}
`;