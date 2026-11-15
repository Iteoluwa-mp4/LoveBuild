import { useCallback } from "react";

/**
 * Scroll to a section — one shared "take me there" for every button that points
 * at part of a page.
 *
 * A caller passes what it actually has: an element, an id, a `#fragment`, or a
 * ref. The hook hands back a function shaped for `onClick`, and nothing moves
 * until it is called:
 *
 *     const go = useScrollToSection("#letter");
 *     <button onClick={go}>Read the letter</button>
 *
 * The target may also be given per call, for the case where what the button
 * points at is only known when it is clicked — the dashboard's `edit →` rows
 * hold a config path, and which section of the form owns that path depends on
 * the template that is selected:
 *
 *     const go = useScrollToSection();
 *     <button onClick={() => go(`#${sectionIdFor(path)}`)}>edit →</button>
 *
 * A handler with a bound target can be handed to `onClick` itself: the event it
 * receives is not a target, so the bound one is used.
 *
 * ## What it does besides scroll
 *
 * - **It opens what is in the way.** Every collapsed `<details>` holding the
 *   target is opened first. A closed section has no height, so scrolling to it
 *   would land on whatever happens to sit at that offset — and landing on a
 *   closed summary bar would ask the reader to open it themselves, which is
 *   most of the work the click was meant to save them.
 *
 * - **It respects the motion setting.** The glide is smooth, unless the reader
 *   has asked their system for reduced motion, in which case the jump is
 *   instant. An explicit `behavior` in the options wins over both, for the
 *   caller who means it.
 *
 * - **It treats a missing target as nothing to do, not as an error.** Sections
 *   come and go with the selected template — the standard form has a Chapters
 *   section, the modern form does not — so a button can legitimately point at
 *   something that is not on this page. That is a silent no-op rather than a
 *   thrown exception inside a click handler.
 *
 * ## Offsets
 *
 * There is deliberately no offset prop. `scrollIntoView` lands the target at
 * the top of its scroll container, and a page needing headroom under a fixed
 * header gets it with CSS `scroll-padding-top` on that container — the browser
 * honours it for exactly this call. One mechanism, living where the header's
 * real height is known.
 *
 * The imperative twin, `scrollToSection`, is exported for anything outside
 * React; the hook is that function with a target bound to it.
 */

/**
 * What a scroll can be aimed at.
 *
 * Strings are ids ("section-moments") or fragments ("#section-moments"). The
 * ref form is here so a target can be named before it exists — the element is
 * looked up when the click lands, not when the component renders.
 */
export type ScrollTarget =
  | string
  | HTMLElement
  | { readonly current: HTMLElement | null }
  | null
  | undefined;

export type ScrollToSectionOptions = {
  /** Where the target lands: "start" (the default), "center", or "nearest". */
  block?: ScrollLogicalPosition | undefined;
  /**
   * "smooth" by default — an instant jump for a reader who asked their system
   * for reduced motion. An explicit value is taken at face value.
   */
  behavior?: ScrollBehavior | undefined;
};

/**
 * What the hook returns: scrolls when called, and is shaped so it can be wired
 * to `onClick` directly.
 *
 * The optional argument is a target for this one call. Anything that is not a
 * target — the click event, when the handler *is* `onClick` — falls back to the
 * target the hook was bound to.
 */
export type ScrollToSectionHandler = (
  target?: ScrollTarget | { readonly type: string },
) => void;

/** True when the value is something a scroll can be aimed at. */
function isScrollTarget(value: ScrollTarget | { readonly type: string }): value is ScrollTarget {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value !== "object" || value === null) return false;
  /*
    An element carries `nodeType === 1`, a ref carries `current`, and a click
    event carries neither — which is what lets a handler bound to a target be
    handed to `onClick` without scrolling at the event object.
  */
  return ("nodeType" in value && value.nodeType === 1) || "current" in value;
}

/** True when the reader has asked the system for reduced motion. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Turns whatever the caller had — element, id, fragment or ref — into an element. */
function resolveTarget(target: ScrollTarget): HTMLElement | null {
  if (typeof target === "string") {
    const selector = target.trim();
    if (selector.length === 0) return null;

    /*
      A fragment names an id. `#photo.1` is a perfectly good id and a perfectly
      invalid selector — the dot would read as a class — so the hash is stripped
      and looked up directly. The selector is only a fallback, for a caller
      after something richer, and it is guarded because a malformed selector
      throws rather than returning null.
    */
    if (selector.startsWith("#")) {
      const byId = document.getElementById(selector.slice(1));
      if (byId) return byId;
      try {
        return document.querySelector<HTMLElement>(selector);
      } catch {
        return null;
      }
    }
    return document.getElementById(selector);
  }

  if (target === null || target === undefined) return null;
  if ("nodeType" in target) return target;
  return target.current;
}

/**
 * Opens every collapsed `<details>` holding the target.
 *
 * `open` is set directly, the way clicking the summary would. React only
 * rewrites the attribute when the prop itself changes, so the state survives
 * the next render — and this is how the form's jump has always opened a
 * section.
 */
function openHoldings(target: HTMLElement): void {
  let node: Element | null = target;
  while (node) {
    if (node instanceof HTMLDetailsElement && !node.open) node.open = true;
    node = node.parentElement;
  }
}

/**
 * Scrolls to a target: the imperative half of the hook, for anything that is
 * not a component. Same behaviour, no React.
 */
export function scrollToSection(target: ScrollTarget, options?: ScrollToSectionOptions): void {
  if (typeof document === "undefined") return;

  const el = resolveTarget(target);
  // A section that is not on this page is nothing to scroll to, not a failure.
  if (!el) return;

  openHoldings(el);

  const behavior = options?.behavior ?? (prefersReducedMotion() ? "auto" : "smooth");
  el.scrollIntoView({ behavior, block: options?.block ?? "start" });
}

/**
 * Binds a target and returns the click handler that scrolls to it.
 *
 * See the file header for the forms the target takes and what the scroll does
 * on the way there.
 */
export function useScrollToSection(
  target?: ScrollTarget,
  options?: ScrollToSectionOptions,
): ScrollToSectionHandler {
  const { behavior, block } = options ?? {};

  return useCallback<ScrollToSectionHandler>(
    (aim) => scrollToSection(isScrollTarget(aim) ? aim : target, { behavior, block }),
    [target, behavior, block],
  );
}
