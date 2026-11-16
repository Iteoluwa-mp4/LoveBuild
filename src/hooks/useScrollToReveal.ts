import { useEffect } from "react";

import {
  scrollToSection,
  type ScrollTarget,
  type ScrollToSectionOptions,
} from "./useScrollToSection";

/**
 * Scroll to whatever a click just revealed — the site-side twin of the
 * dashboard's jump-to-section.
 *
 * A button that opens a note, a panel or a photograph only does half its job by
 * flipping a boolean: the thing the reader asked for is frequently below the
 * fold, which is precisely why they cannot see it yet. So every reveal in every
 * template arms this hook, and the page takes the reader to the thing they just
 * opened instead of leaving them to hunt for it:
 *
 *     const readRef = useRef<HTMLDivElement>(null);
 *     useScrollToReveal(openNote, readRef);
 *     …
 *     {openNote !== null && <div ref={readRef} …>…</div>}
 *
 * ## What counts as "open"
 *
 * `open` is whatever the reveal is keyed on — a boolean, an index, a counter —
 * and the scroll runs whenever it *changes to a value that is open*. `null`,
 * `undefined` and `false` are closed; **`0` is open**, because an index of zero
 * is the first item rather than the absence of one. Changing while already
 * open scrolls again: the second row the reader picks is a second destination,
 * and the detail it opens sits below the whole list.
 *
 * The value is also the dependency, so the first render — before anything has
 * been clicked — does not scroll. This is a reaction to a click, never a
 * page-load animation.
 *
 * ## Timing
 *
 * The effect runs after React has committed the reveal, and the scroll is
 * scheduled for the next frame. Inside the click handler itself the
 * conditional render has not happened yet, so aiming there would aim at a
 * target that does not exist — the missing target is a silent no-op, and the
 * reader would get no scroll at all with nothing to say why.
 *
 * ## What it inherits
 *
 * Everything `scrollToSection` does carries over: smooth unless the reader
 * asked their system for reduced motion, any collapsed `<details>` in the way
 * opened first, and a target not on this page treated as nothing to do rather
 * than as an error. `block` defaults to `"start"`, so a reveal lands at the top
 * of the viewport with any fixed header cleared through `scroll-padding-top`.
 *
 * Pass `block: "nearest"` for a reveal that sits where the reader is already
 * looking — a caption under a photo strip. Nearest moves only as far as it must
 * to show the thing, which makes it the right choice when the common case is
 * "already visible, do nothing".
 *
 * ## The exception
 *
 * An overlay — a dialog or lightbox covering the viewport, which is how the
 * editorial template's figures open — has no section to scroll to: the reveal
 * *is* the viewport. Nothing is wired there, and wiring it would scroll the
 * page underneath a modal for no visible effect. The same applies to content
 * that moves inside a fixed widget the reader is already looking at, such as a
 * page turning in the flipbook: the hook is armed with `"nearest"` so it
 * guarantees the widget is in view and otherwise does nothing.
 */
export function useScrollToReveal<T>(
  open: T | null | undefined | false,
  target: ScrollTarget,
  options?: ScrollToSectionOptions,
): void {
  const { behavior, block } = options ?? {};
  const revealed = open !== null && open !== undefined && open !== false;

  useEffect(() => {
    if (!revealed) return;

    const frame = window.requestAnimationFrame(() => {
      scrollToSection(target, { behavior, block });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [revealed, open, target, behavior, block]);
}
