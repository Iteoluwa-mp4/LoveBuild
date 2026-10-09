import { useCallback, useRef, useState } from "react";

import type { Memory } from "./shared";
import { MODERN_STRIP_CSS } from "./strip-css";

/**
 * The photo strip: a row of narrow vertical slices, one in focus.
 *
 * Each frame is cropped to a tall sliver rather than shown whole, so a face is
 * read as a band of colour and light rather than a portrait. That is the whole
 * effect — the strip is a texture you scroll along, not a gallery you read.
 *
 * ## Why it does not advance itself
 *
 * The reference it came from moved on a timer. This one does not, and that is a
 * deliberate reversal.
 *
 * A site like this is something a person keeps open on their phone, sometimes for
 * a long time, and they are looking at photographs of their partner. Motion that
 * nobody asked for is the difference between a page that feels considered and one
 * that makes you want to close the tab. It is also the kind of thing a client
 * notices immediately and cannot un-notice.
 *
 * So: click, tap, or use the arrow keys. If auto-play is wanted later it is one
 * prop and a timer — the state model here already assumes focus moves one at a
 * time.
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
 * ## Scrolling
 *
 * Selecting scrolls the slice into view, but only horizontally, and only when it
 * is genuinely off-screen. Calling `scrollIntoView` unconditionally on a focused
 * slice drags the page vertically too, which on a full-height strip means the
 * section jumps every time you click a photo — the kind of small wrongness that
 * makes a page feel cheap.
 */

export type PhotoStripProps = {
  memories: Memory[];
  /** Optional gold badge in the corner, as in the reference. */
  badge?: React.ReactNode;
  /** Accessible name for the group. */
  label?: string;
};

export default function PhotoStrip({
  memories,
  badge,
  label = "Photographs",
}: PhotoStripProps) {
  const [chosen, setChosen] = useState(0);
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
   * Brings a slice into view horizontally only, and only if it is off-screen.
   *
   * `scrollIntoView` with `block: "nearest"` still moves the page vertically when
   * the element is taller than the viewport, which this one nearly is. Measuring
   * the list and scrolling it by hand is the version that cannot.
   */
  const revealHorizontally = useCallback((index: number) => {
    const list = listRef.current;
    const item = itemRefs.current[index];
    if (!list || !item) return;

    const listBox = list.getBoundingClientRect();
    const itemBox = item.getBoundingClientRect();

    if (itemBox.left < listBox.left) {
      list.scrollBy({ left: itemBox.left - listBox.left - 24, behavior: "smooth" });
    } else if (itemBox.right > listBox.right) {
      list.scrollBy({ left: itemBox.right - listBox.right + 24, behavior: "smooth" });
    }
  }, []);

  const select = useCallback(
    (index: number, focus = false) => {
      if (index < 0 || index >= count) return;
      setChosen(index);
      revealHorizontally(index);
      if (focus) itemRefs.current[index]?.focus();
    },
    [count, revealHorizontally],
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const keys: Record<string, number> = {
      ArrowRight: active + 1,
      ArrowLeft: active - 1,
      Home: 0,
      End: count - 1,
    };

    const next = keys[event.key];
    if (next === undefined) return;

    event.preventDefault();
    // Wraps, because a row that stops dead at the end feels broken.
    select((next + count) % count, true);
  };

  /**
   * A narrow viewport shows fewer slices, so scrolling can change which one is on
   * screen without changing which is selected. Nothing is reported as an error —
   * the selection is deliberately independent of what happens to be visible.
   */
  if (count === 0) return null;

  const current = memories[active];

  return (
    <div className="strip">
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