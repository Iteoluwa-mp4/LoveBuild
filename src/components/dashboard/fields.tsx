import { useId, type ReactNode } from "react";

import { themeIds, themes } from "../../lib/site/themes";

/**
 * Form controls.
 *
 * Every one is bound to a config path and reports its value up. None of them
 * knows where it lives in the config, which is what lets the same control serve
 * the hero, a moment and a chapter without any of them repeating itself.
 *
 * Optional props are declared as `?: T | undefined` rather than plain `?: T`
 * because this project runs `exactOptionalPropertyTypes`. Without it, passing
 * `onUp={maybeUndefined}` to an optional prop is a type error — and callers
 * legitimately compute those values conditionally.
 */

/* ------------------------------------------------------------------ *
 * TEXT
 * ------------------------------------------------------------------ */

export function TextField({
  label,
  value,
  onChange,
  hint,
  maxLength,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  hint?: string | undefined;
  maxLength?: number | undefined;
  placeholder?: string | undefined;
}) {
  const id = useId();
  const atLimit = maxLength !== undefined && value.length >= maxLength;

  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
        {maxLength !== undefined && (
          <span className="field-count">
            {value.length}/{maxLength}
          </span>
        )}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <p className="field-hint">{hint}</p>}
      {atLimit && <p className="field-warn">At the limit — anything longer gets cut off.</p>}
    </div>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  hint,
  rows = 4,
  maxLength,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  hint?: string | undefined;
  rows?: number;
  maxLength?: number | undefined;
  placeholder?: string | undefined;
}) {
  const id = useId();

  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
        {maxLength !== undefined && (
          <span className="field-count">
            {value.length}/{maxLength}
          </span>
        )}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * TOGGLE
 * ------------------------------------------------------------------ */

export function ToggleField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  hint?: string | undefined;
}) {
  const id = useId();

  return (
    <label className="toggle" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="toggle-text">
        {label}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------ *
 * TEMPLATE
 * ------------------------------------------------------------------ */

/**
 * The template list, defined next to the picker rather than in the schema.
 *
 * A template is a layout plus a sentence about what it is like, and only the
 * dashboard needs either. The schema carries the ids alone — a `description`
 * field there would be stored on every config forever and shown nowhere.
 */
const TEMPLATES: ReadonlyArray<{ id: string; label: string; note: string }> = [
  {
    id: "editorial",
    label: "Editorial",
    note: "A printed magazine issue. Photos as field notes, your words as the editor's letter.",
  },
  {
    id: "modern",
    label: "Modern",
    note: "Wide type and a drifting sphere. Photos become a filmstrip and an orbit.",
  },
  {
    id: "scrapbook",
    label: "Scrapbook",
    note: "Taped polaroids at odd angles, paper ground, handwriting face.",
  },
];

/**
 * Which layout the site uses.
 *
 * Deliberately a separate control from the theme picker above it, and the two
 * are orthogonal: any template works with any theme. Combining them into one
 * "style" list would mean eight presets to choose between and no way to keep a
 * layout you like while changing the colour.
 *
 * Switching is non-destructive and nothing is seeded on the way through. The
 * photographs live in `home.moments` and both templates read them, so the
 * modern template can be tried, judged, and abandoned with the uploads intact —
 * which is the only way anyone can decide whether they prefer it.
 */
export function TemplatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="field">
      <span className="field-label">Template</span>
      <div className="theme-grid">
        {TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            className="theme-card"
            aria-pressed={value === template.id}
            onClick={() => onChange(template.id)}
          >
            <span className="theme-name">{template.label}</span>
            <span className="field-hint">{template.note}</span>
          </button>
        ))}
      </div>
      <p className="field-hint">
        Colours are set separately below — any theme works with either template.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * THEME
 * ------------------------------------------------------------------ */

/**
 * Presets rather than a colour picker.
 *
 * A free colour picker lets someone pick gold text on a gold background and not
 * find out until they share the link. A preset is always readable, and there are
 * five of them instead of sixteen thousand combinations.
 */
export function ThemePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="field">
      <span className="field-label">Theme</span>
      <div className="theme-grid">
        {themeIds.map((id) => {
          const theme = themes[id];
          return (
            <button
              key={id}
              type="button"
              className="theme-card"
              aria-pressed={value === id}
              data-theme={id}
              style={theme.tokens}
              onClick={() => onChange(id)}
            >
              <span className="theme-preview" aria-hidden="true">
                <i />
              </span>
              <span className="theme-name">{theme.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * LAYOUT
 * ------------------------------------------------------------------ */

/**
 * A collapsible group.
 *
 * Closed by default. Every section was open at once, and a form where all of
 * the sections are open is a form where the author cannot see the shape of it —
 * they get one long column of fields with no indication of what belongs to
 * what, and the only way to find a heading is to scroll past every field under
 * it.
 *
 * The summary line still shows what is inside, so a closed form is navigable
 * rather than a list of mysterious bars. `defaultOpen` remains for the one or
 * two groups that genuinely want to be open on arrival.
 */
export function Section({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string | undefined;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="dash-section" open={defaultOpen}>
      <summary>
        <span className="dash-section-title">{title}</span>
        {hint && <span className="dash-section-hint">{hint}</span>}
      </summary>
      <div className="dash-section-body">{children}</div>
    </details>
  );
}

/**
 * A repeatable item: one moment, one film, one chapter.
 *
 * Collapsible, because four moments and four chapters rendered open is a wall of
 * identical cards — the single biggest source of crowding in the form. The
 * header carries the whole summary, so a collapsed list still tells you what is
 * in it and what is missing, and reorder and delete stay reachable without
 * opening anything.
 */
export function Item({
  index,
  title,
  editableTitle,
  badges,
  onUp,
  onDown,
  onRemove,
  removeLabel,
  open = false,
  onToggle,
  children,
}: {
  index: number;
  title: string;
  /**
   * When set, the heading is the field itself rather than a read-only summary.
   *
   * The collapsed row is where an author actually reads what is in the list, so
   * renaming it there saves opening a card just to fix one line. `value` is the
   * raw field, not `title` — `title` may be a fallback such as "Untitled photo",
   * which must never be written back into the site.
   */
  editableTitle?: {
    value: string;
    onChange: (value: string) => void;
    maxLength?: number;
    placeholder?: string;
    ariaLabel?: string;
  };
  badges?: ReactNode | undefined;
  onUp?: (() => void) | undefined;
  onDown?: (() => void) | undefined;
  onRemove: () => void;
  removeLabel: string;
  open?: boolean;
  onToggle?: (next: boolean) => void;
  children: ReactNode;
}) {
  // Without a toggle handler the item is always open — the plain variant is
  // still used for footer cards and anything else small enough not to need it.
  const collapsible = onToggle !== undefined;

  return (
    <div className="item" data-open={String(collapsible ? open : true)}>
      <div className="item-head">
        {collapsible && (
          <button
            type="button"
            className={`item-toggle${editableTitle ? " item-toggle-caret" : ""}`}
            aria-expanded={open}
            onClick={() => onToggle(!open)}
            title={open ? "Collapse" : "Expand"}
          >
            <span className="item-caret" aria-hidden="true">
              {open ? "▾" : "▸"}
            </span>
            {!editableTitle && (
              <>
                <span className="item-index">{index + 1}</span>
                <span className="item-title">{title}</span>
              </>
            )}
          </button>
        )}

        {editableTitle ? (
          <>
            <span className="item-index">{index + 1}</span>
            <input
              className="item-title item-title-edit"
              value={editableTitle.value}
              onChange={(event) => editableTitle.onChange(event.target.value)}
              maxLength={editableTitle.maxLength}
              placeholder={editableTitle.placeholder}
              aria-label={editableTitle.ariaLabel ?? `Rename item ${index + 1}`}
              onKeyDown={(event) => {
                // Enter commits and Escape abandons the caret, not the edit —
                // the value is already in the draft either way.
                if (event.key === "Enter" || event.key === "Escape") {
                  event.currentTarget.blur();
                }
              }}
            />
          </>
        ) : (
          !collapsible && (
            <>
              <span className="item-index">{index + 1}</span>
              <span className="item-title">{title}</span>
            </>
          )
        )}

        {badges}
        <span className="btn-row">
          {onUp && (
            <button
              type="button"
              className="btn btn-icon"
              onClick={onUp}
              aria-label={`Move up: ${title}`}
            >
              ↑
            </button>
          )}
          {onDown && (
            <button
              type="button"
              className="btn btn-icon"
              onClick={onDown}
              aria-label={`Move down: ${title}`}
            >
              ↓
            </button>
          )}
          <button
            type="button"
            className="btn btn-icon btn-danger"
            onClick={onRemove}
            aria-label={removeLabel}
          >
            Remove
          </button>
        </span>
      </div>

      {(!collapsible || open) && <div className="item-body">{children}</div>}
    </div>
  );
}

/** Shown instead of an empty list, so a blank section never looks broken. */
export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="item-empty">{children}</p>;
}