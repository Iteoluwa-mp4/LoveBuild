/**
 * Immutable get/set by dotted path.
 *
 * The dashboard binds every input to a config path — `home.moments.0.caption` —
 * so a field component never needs to know where it lives, and the outline panel
 * can link straight to the field that is empty. One generic setter instead of
 * bespoke handlers per field.
 *
 * Arrays and objects are both supported, and the shape is inferred from the next
 * segment so `set(site, 'home.moments.0', x)` knows it is indexing a list.
 */

const DIGITS = /^\d+$/;

function isIndex(segment: string): boolean {
  return DIGITS.test(segment);
}

/** Reads the value at a path, or undefined if any step is missing. */
export function getAtPath<T = unknown>(source: unknown, path: string): T | undefined {
  if (!path) return source as T;

  let cursor: unknown = source;
  for (const segment of path.split(".")) {
    if (cursor === null || cursor === undefined) return undefined;
    if (typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor as T | undefined;
}

/**
 * Returns a copy of `source` with `path` set to `value`.
 *
 * Every level along the path is shallow-copied, so React sees a new object
 * identity only where something changed. Cloning the whole config on every
 * keystroke would work too, and would also be wasteful and harder to reason
 * about once the preview starts diffing.
 */
export function setAtPath<T>(source: T, path: string, value: unknown): T {
  if (!path) return value as T;

  const [head, ...rest] = path.split(".");
  const container: unknown = Array.isArray(source) ? [...source] : { ...(source as object) };

  if (rest.length === 0) {
    (container as Record<string, unknown>)[head] = value;
    return container as T;
  }

  // A missing intermediate step has to become something: a list if the next
  // segment is numeric, otherwise an object.
  const existing = (container as Record<string, unknown>)[head];
  const seed = existing ?? (isIndex(rest[0]) ? [] : {});

  (container as Record<string, unknown>)[head] = setAtPath(seed, rest.join("."), value);
  return container as T;
}

/**
 * Removes the value at `path`.
 *
 * Used by the list editors, where removing an item has to splice the array
 * rather than leave a hole — a hole would render as an empty card with no way
 * to delete it.
 */
export function removeAtPath<T>(source: T, path: string): T {
  const segments = path.split(".");
  const last = segments.pop();
  if (last === undefined) return source;

  const parent = getAtPath(source, segments.join("."));
  if (parent === undefined || parent === null) return source;

  const container: unknown = Array.isArray(parent) ? [...parent] : { ...(parent as object) };

  if (Array.isArray(container)) {
    const index = Number(last);
    if (Number.isInteger(index) && index >= 0 && index < container.length) {
      container.splice(index, 1);
    }
  } else {
    delete (container as Record<string, unknown>)[last];
  }

  return segments.length === 0
    ? (container as T)
    : setAtPath(source, segments.join("."), container);
}

/** Appends to the list at `path`, or creates the list if it is missing. */
export function appendAtPath<T>(source: T, path: string, item: unknown): T {
  const existing = getAtPath<unknown[]>(source, path);
  return setAtPath(source, path, Array.isArray(existing) ? [...existing, item] : [item]);
}

/** Moves an item within the list at `path`. Used by the reorder controls. */
export function moveAtPath<T>(source: T, path: string, from: number, to: number): T {
  const list = getAtPath<unknown[]>(source, path);
  if (!Array.isArray(list)) return source;

  const next = [...list];
  if (from < 0 || from >= next.length) return source;

  // Clamp rather than reject, so dragging past the end does something sane.
  const target = Math.max(0, Math.min(next.length - 1, to));
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved);

  return setAtPath(source, path, next);
}