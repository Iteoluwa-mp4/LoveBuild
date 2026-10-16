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
    id: "classic",
    label: "Classic",
    note: "Gold on deep purple. The original — headline, photos, a letter.",
  },
  {
    id: "modern",
    label: "Modern",
    note: "Wide type and a drifting sphere. Photos become a filmstrip and an orbit.",
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

/** A collapsible group. Advanced groups start closed. */
export function Section({
  title,
  hint,
  defaultOpen = true,
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
        {collapsible ? (
          <button
            type="button"
            className="item-toggle"
            aria-expanded={open}
            onClick={() => onToggle(!open)}
          >
            <span className="item-caret" aria-hidden="true">
              {open ? "▾" : "▸"}
            </span>
            <span className="item-index">{index + 1}</span>
            <span className="item-title">{title}</span>
          </button>
        ) : (
          <>
            <span className="item-index">{index + 1}</span>
            <span className="item-title">{title}</span>
          </>
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