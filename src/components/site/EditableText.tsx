import {
  type ClipboardEvent,
  type ElementType,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
} from "react";

import { EditingContext, useEditing } from "../../lib/site/editing";
import type { EditingContextValue } from "../../lib/site/editing";

/**
 * Editing on the page.
 *
 * The alternative was a form beside the preview, which is what the dashboard
 * already is. This is the other half of that idea: click the words on the page and
 * type. It is the single change that would most make this feel like yourlovepage
 * rather than like a back office.
 *
 * ## The design
 *
 * One component, and every editable run of text declares a dotted config path.
 * Nothing else in the template knows editing exists.
 *
 * A deliberately important limitation: only text is editable this way. Structure
 * (adding a moment, reordering chapters, swapping a photo) stays in the form.
 * Editing on the page cannot invent a list item that does not exist, and a
 * mechanism that tried would be far more machinery than the idea is worth. So the
 * two remain, and the form is no longer the only way in.
 *
 * ## Why commit on blur
 *
 * A controlled contentEditable fights React for ownership of the DOM node. Bind
 * textContent to state and the cursor jumps to the end on every keystroke, which
 * makes writing a sentence impossible. The fix is to let the browser own the node
 * while it is focused, and read the result afterwards.
 *
 * "Owns it while focused" is the whole difficulty, because a node nobody writes to
 * is a node that can drift. An early version reported edits but never synced the DOM
 * back, so a re-render with an unchanged config left whatever the browser had typed
 * sitting in the element, and a later commit sent that stale text into the config,
 * silently overwriting a field nobody had touched. Hence the ref and effect below:
 * whenever the value changes and the element is not focused, the DOM is brought
 * back into line with the config.
 *
 * ## Escape, Enter, and paste
 *
 * Enter commits and blurs, so the keyboard path does not need a mouse. Escape
 * reverts to the stored value, because someone who selects a word and then deletes
 * it should be able to back out with one keystroke rather than retyping.
 *
 * Paste is forced to plain text. Pasted markup into a contentEditable is a stored
 * XSS vector, because it executes on every visitor's page, so the tags are stripped
 * at the boundary rather than trusted.
 *
 * ## What is deliberately not editable here
 *
 * Buttons and links. Their labels live in the form. Clicking a button to place a
 * caret inside it is ambiguous with clicking it to use it, and "Open the gallery" is
 * a small field with an obvious home.
 *
 * Text the design splits across elements is in the form for the same reason: the
 * quote panel highlights its last sentence, so the stored string spans three nodes
 * and a caret cannot cross the tag boundary.
 */

export function EditingProvider({
  enabled,
  report,
  children,
}: EditingContextValue & { children: ReactNode }) {
  return <EditingContext.Provider value={{ enabled, report }}>{children}</EditingContext.Provider>;
}

/** Strips markup, so pasted HTML cannot become executable in someone's page. */
function plainText(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  return (template.content.textContent ?? "").replace(/\s+/g, " ").trim();
}

export default function EditableText({
  path,
  value,
  as: Tag = "span",
  multiline = false,
  className,
  placeholder,
  maxLength,
  attributes,
  children,
}: {
  /** Dotted config path, e.g. `home.hero.subline`. */
  path: string;
  value: string;
  /** The element to render. Defaults to a span. */
  as?: ElementType;
  /** Allow Shift+Enter to insert a newline. Plain Enter always commits. */
  multiline?: boolean;
  className?: string | undefined;
  /** Shown when empty, while editing. Never stored, never rendered to visitors. */
  placeholder?: string | undefined;
  /** Enforced on commit, matching the schema's own limit for this field. */
  maxLength?: number | undefined;
  /**
   * Extra attributes for the rendered element.
   *
   * Needed because `id` is load-bearing here rather than incidental: the chapter
   * and film headings are the targets of aria-labelledby, and the footer sitemap
   * anchors at them. Spelling those out as named props would mean a prop per
   * attribute the template happens to use.
   */
  attributes?: Record<string, unknown> | undefined;
  /** For when the value is not plain text, a highlighted quote say. */
  children?: ReactNode;
}) {
  const { enabled, report } = useEditing();
  const ref = useRef<HTMLElement>(null);

  /**
   * Keeps the DOM honest.
   *
   * Runs on every change of `value`, but writes only when the element is not
   * focused. That is the one moment writing is forbidden: the browser is mid-edit
   * and resetting textContent would move the caret.
   *
   * Also runs on mount, which matters because a remounted element starts empty.
   */
  useEffect(() => {
    if (!enabled) return;
    const element = ref.current;
    if (!element) return;
    if (element === document.activeElement) return;

    const current = (element.textContent ?? "").replace(/\s+/g, " ").trim();
    if (current !== value.trim()) element.textContent = value;
  }, [enabled, value]);

  if (!enabled) {
    return (
      <Tag className={className} {...attributes}>
        {children ?? value}
      </Tag>
    );
  }

  return (
    <Tag
      ref={ref}
      className={className}
      {...attributes}
      data-editable={path}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      role="textbox"
      aria-multiline={multiline || undefined}
      onPaste={(event: ClipboardEvent) => {
        // Strip at the boundary. A contentEditable paste inserts markup verbatim,
        // and this text is rendered to every visitor of a published site.
        event.preventDefault();
        const text = plainText(event.clipboardData.getData("text/html"));
        const fallback = event.clipboardData
          .getData("text/plain")
          .replace(/\s+/g, " ")
          .trim();
        document.execCommand("insertText", false, text || fallback);
      }}
      onKeyDown={(event: KeyboardEvent) => {
        // Tag is a caller-chosen element type, so React infers Element here, which
        // has neither textContent nor blur. Everything this renders is an
        // HTMLElement, so narrow once rather than casting at each use.
        const element = event.currentTarget as HTMLElement;

        if (event.key === "Escape") {
          // Revert rather than save. Someone who deletes a word and regrets it
          // should not have to remember what it said.
          element.textContent = value;
          element.blur();
          return;
        }

        // Enter commits even when multiline, because an accidental newline inside
        // a headline would be stored and then never seen. Shift+Enter is the
        // escape hatch.
        if (event.key === "Enter" && !(multiline && event.shiftKey)) {
          event.preventDefault();
          element.blur();
        }
      }}
      onBlur={(event: FocusEvent) => {
        const element = event.currentTarget as HTMLElement;
        const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();

        // Restore the DOM even when nothing changed, so a revert that ended up
        // matching the stored value still leaves the element correct.
        element.textContent = value;

        const next = maxLength === undefined ? text : text.slice(0, maxLength);
        if (next === value) return;

        report(path, next);
      }}
      style={value ? undefined : { opacity: 0.45 }}
      data-placeholder={value ? undefined : (placeholder ?? "Click to write")}
    />
  );
}