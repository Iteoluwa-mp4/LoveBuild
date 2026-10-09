import { useCallback, useEffect, useRef, useState } from "react";

import type { Memory } from "./shared";
import { MODERN_STRIP_CSS } from "./strip-css";

/**
 * The photo strip: a row of narrow vertical slices, one in focus.
 *
 * Each frame is cropped to a tall sliver rather than shown whole, so a face is
 * read as a band of colour and light rather than a portrait. That is the whole
 * effect — the strip is a texture you scroll along, not a gallery you read.
 *
 * ## It advances itself
 *
 * Every `ADVANCE_MS` the focus moves on. That is the default because a strip of
 * photographs that sits still reads as a row of thumbnails rather than as
 * something alive.
 *
 * But it stops the instant anyone touches it — on hover, on keyboard focus, and
 * while the tab is in the background. A timer that keeps advancing while you are
 * reading one particular photograph is the failure mode, and it is why the
 * interval is built to lose to interaction rather than to fight it. Touching the
 * strip also restarts the count, so a deliberate click is never overridden a
 * moment later by the timer moving on without being asked.
 *
 * Reduced motion is honoured by not advancing at all. Auto-advancing content is
 * precisely what that setting is about, so a reader who has asked for stillness
 * gets a strip they move themselves.
 *
 * ## Keyboard and screen readers
 *
 * The strip is a radio group: one choice from a set, where the choice matters and
 * cannot be unset. Arrow keys move between slices, Home and End jump to the ends,
 * and only the focused slice is in the tab order so Tab does not walk the whole
 * row. The caption for the focused slice is announced through a polite live
 * region, because a selection that is only communicated visually would be
 * invisible to a screen reader.
 *
 * ## Centring
 *
 * The row is centred rather than left-aligned, which does two things at once.
 *
 * A short row — four slices in a wide window — sits in the middle instead of
 * hugging the left edge with a third of the screen empty beside it. And because
 * the track centres, the active slice's growth is taken equally from both sides,
 * so it opens out of the middle of the strip rather than shoving everything to
 * its right.
 *
 * Centring a scrollable flex row has a classic trap: `justify-content: center`
 * overflows in *both* directions, and the overflow on the left cannot be scrolled
 * to, so the first slice becomes unreachable. The auto margins on the first and
 * last children are the fix — they resolve to the centring when there is spare
 * room and to zero when there is not.
 */

export type PhotoStripProps = {
  memories: Memory[];
  /** Optional badge in the corner, as in the reference. */
  badge?: React.ReactNode;
  /** Accessible name for the group. */
  label?: string;
  /** How long each slice holds the focus. */
  advanceMs?: number;
};

/** How long a slice stays in focus before the strip moves on. */
export const ADVANCE_MS = 3000;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function PhotoStrip({
  memories,
  badge,
  label = "Photographs",
  advanceMs = ADVANCE_MS,
}: PhotoStripProps) {
  const [chosen, setChosen] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);

  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  const count = memories.length;

  /**
   * Clamped at read time rather than corrected in an effect.
   *
   * Memories can be removed while the strip is mounted, which would leave the
   * selection pointing past the end. Fixing that with an effect means a second
   * render that briefly has an out-of-range index; deriving the safe value on the
   * way to the DOM means there is never an invalid one.
   */
  const active = count === 0 ? 0 : Math.min(chosen, count - 1);

  /**
   * Holds the active slice in the middle of the visible row.
   *
   * Driven by `active` rather than by the handler that changed it, so the row
   * follows the timer, the keyboard and a click equally — three routes into the
   * same state should not need three copies of the scrolling.
   *
   * Measured from `offsetLeft`, which is a layout position and therefore does not
   * move when the container scrolls, so the delta is genuinely "how far is this
   * from centre" rather than a value that chases itself.
   */
  const centreActive = useCallback(() => {
    const list = listRef.current;
    const item = itemRefs.current[active];
    if (!list || !item) return;

    const delta =
      item.offsetLeft + item.offsetWidth / 2 - (list.scrollLeft + list.clientWidth / 2);

    // Under a pixel is not worth a scroll event.
    if (Math.abs(delta) < 2) return;
    list.scrollBy({ left: delta, behavior: "smooth" });
  }, [active]);

  useEffect(() => {
    centreActive();
  }, [centreActive]);

  /**
   * The advance.
   *
   * Keyed on `tick` as well, so a deliberate selection restarts the count rather
   * than being cut short by a timer that was already running. That is the
   * difference between the strip feeling responsive and feeling like it is
   * fighting you.
   */
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (paused || hidden || count <= 1) return;
    if (prefersReducedMotion()) return;

    const id = window.setInterval(() => {
      setChosen((current) => (current + 1) % count);
    }, advanceMs);

    return () => window.clearInterval(id);
  }, [paused, hidden, count, advanceMs, tick]);

  // A backgrounded tab should not come back to a strip that has moved on.
  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  /** Everything that changes the selection restarts the timer. */
  const select = useCallback((index: number, focus = false) => {
    if (index < 0 || index >= count) return;
    setChosen(index);
    setTick((n) => n + 1);
    if (focus) itemRefs.current[index]?.focus();
  }, [count]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const targets: Record<string, number> = {
      ArrowRight: active + 1,
      ArrowLeft: active - 1,
      Home: 0,
      End: count - 1,
    };

    const next = targets[event.key];
    if (next === undefined) return;

    event.preventDefault();
    // Wraps, because a row that stops dead at the end feels broken.
    select((next + count) % count, true);
  };

  if (count === 0) return null;

  const current = memories[active];

  return (
    <div
      className="strip"
      // Hover and focus both hold the strip still. Without this the photographs
      // move while someone is looking at one, which is the thing that makes an
      // auto-advancing carousel feel cheap.
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        // Only un-pause once focus has left the strip entirely, or tabbing
        // between two slices would restart the timer under the reader.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
    >
      <style>{MODERN_STRIP_CSS}</style>

      <div className="strip-frame">
        <div
          ref={listRef}
          className="strip-track"
          role="radiogroup"
          aria-label={label}
        >
          {memories.map((memory, index) => {
            const isActive = index === active;
            return (
              <button
                key={memory.label}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                type="button"
                role="radio"
                aria-checked={isActive}
                aria-label={`${memory.label}. ${memory.caption}`}
                className={`strip-slice ${isActive ? "is-active" : ""}`}
                // Roving tabindex: one stop for the whole group, then arrows.
                tabIndex={isActive ? 0 : -1}
                onClick={() => select(index)}
                onKeyDown={onKeyDown}
              >
                <img src={memory.image} alt="" aria-hidden="true" />
                <span className="strip-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </button>
            );
          })}
        </div>

        {badge && <div className="strip-badge">{badge}</div>}
      </div>

      {/*
        The caption for the focused slice. Visually it sits under the strip;
        for a screen reader it is the only thing that says which photograph is
        selected, since the slices themselves are images with no alt text.
      */}
      <div className="strip-caption" aria-live="polite">
        <strong>{current.label}</strong>
        <span>{current.caption}</span>
      </div>
    </div>
  );
}