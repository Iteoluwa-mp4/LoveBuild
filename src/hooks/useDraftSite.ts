import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createDraft } from "../lib/site/default";
import { LocalSiteRepository } from "../lib/site/localRepository";
import { getAtPath, moveAtPath, removeAtPath, setAtPath } from "../lib/site/path";
import { SaveError, type SiteRepository } from "../lib/site/repository";
import type { Site } from "../lib/site/schema";

/**
 * The dashboard's single source of truth.
 *
 * One draft object in state, edited by path. No per-field `useState` — that is
 * what makes autosave, the live preview and the outline possible without three
 * separate mechanisms kept in step.
 */

export type SaveState =
  | { phase: "idle" }
  | { phase: "dirty" }
  | { phase: "saving" }
  | { phase: "saved"; at: number }
  | { phase: "error"; message: string; path?: string | undefined };

export type DraftSite = {
  site: Site | null;
  saveState: SaveState;
  /** True until the first load settles. */
  loading: boolean;
  /** Present when the stored config could not be read at all. */
  loadError: string | null;
  /** False when the slug had nothing stored and a fresh draft was created. */
  existed: boolean;

  /** Writes a single value, by dotted path. */
  set: (path: string, value: unknown) => void;
  /** Replaces the whole config. */
  replace: (next: Site) => void;
  /** Removes the item at `path`, splicing lists. */
  remove: (path: string) => void;
  /** Appends to the list at `path`. */
  append: (path: string, item: unknown) => void;
  /** Reorders within the list at `path`. */
  move: (path: string, from: number, to: number) => void;
  /** Re-reads the path for a field's current value. */
  read: <T = unknown>(path: string) => T | undefined;

  /**
   * Forces a save now, skipping the debounce. Resolves false if it failed.
   *
   * The boolean is the point, and it exists for publishing. `void` would force
   * callers to assume success, and "assume the save worked" is exactly the wrong
   * assumption immediately before making a site public.
   */
  flush: () => Promise<boolean>;
};

const AUTOSAVE_MS = 1500;

export function useDraftSite(slug: string, repo?: SiteRepository): DraftSite {
  const repository = useMemo(() => repo ?? new LocalSiteRepository(), [repo]);

  /**
   * Load state, written only from the async callback.
   *
   * Deriving `loading` from the slug this belongs to avoids a synchronous
   * `setState` at the top of the effect, which would trigger a second render on
   * every slug change for no benefit.
   */
  const [loaded, setLoaded] = useState<{
    slug: string;
    site: Site;
    error: string | null;
    existed: boolean;
  } | null>(null);

  const [saveState, setSaveState] = useState<SaveState>({ phase: "idle" });

  // Mirrors of state that async work needs to read. Deliberately refs: reading
  // a ref is stable, whereas depending on the state itself would re-subscribe
  // every effect that touches it on every keystroke.
  const latest = useRef<Site | null>(null);
  const dirty = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const inFlight = useRef<Promise<unknown> | null>(null);

  /* ---------------- load ---------------- */

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const stored = await repository.get(slug);
        if (cancelled) return;

        // A missing site is not an error at this stage — the dashboard is where
        // new ones get made, so start from `createDraft` rather than nothing.
        const site = stored ?? createDraft(slug);
        latest.current = site;
        dirty.current = false;
        setLoaded({ slug, site, error: null, existed: stored !== null });
        setSaveState(stored ? { phase: "saved", at: Date.now() } : { phase: "idle" });
      } catch (cause) {
        if (cancelled) return;
        // Still hand the form something editable rather than a dead page.
        const fallback = createDraft(slug);
        latest.current = fallback;
        setLoaded({
          slug,
          site: fallback,
          error: cause instanceof Error ? cause.message : "Could not load this site.",
          existed: true,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [repository, slug]);

  const loading = loaded?.slug !== slug;
  const site = loaded?.slug === slug ? loaded.site : null;
  const loadError = loaded?.slug === slug ? loaded.error : null;
  const existed = loaded?.slug === slug ? loaded.existed : false;

  /* ---------------- save ---------------- */

  /** One round trip. Never runs while another is in flight. */
  const runSave = useCallback(
    async (current: Site): Promise<boolean> => {
      setSaveState({ phase: "saving" });

      try {
        await repository.save(current);
        dirty.current = false;
        setSaveState({ phase: "saved", at: Date.now() });
        return true;
      } catch (cause) {
        const message =
          cause instanceof SaveError ? cause.message : "Could not save your changes.";
        const path = cause instanceof SaveError ? cause.path : undefined;
        // `dirty` stays true: the work is still unsaved, so an unload must retry.
        setSaveState({ phase: "error", message, path });
        return false;
      }
    },
    [repository],
  );

  /**
   * Saves everything currently on screen, reporting whether it worked.
   *
   * The loop is the point, not an optimisation. The obvious implementation — one
   * `save`, then done — is wrong in two ways that both matter here:
   *
   *   - If a debounced autosave is already in flight, returning early reports the
   *     *older* config as saved. Publishing calls this, and would go live one save
   *     behind what is on screen.
   *   - An edit made while that save was running leaves `dirty` true, so a single
   *     pass would again claim success while work is unsaved.
   *
   * Bounded at three passes: a loop that can spin on someone typing faster than
   * the network is worse than the problem it solves, and by then the save
   * indicator has already said "saving" repeatedly, which is honest.
   */
  const persist = useCallback(async (): Promise<boolean> => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (inFlight.current) {
        await inFlight.current;
        continue;
      }

      if (!dirty.current) return true;

      const current = latest.current;
      if (!current) return false;

      const run = runSave(current);
      inFlight.current = run;
      let ok: boolean;
      try {
        ok = await run;
      } finally {
        inFlight.current = null;
      }

      if (!ok) return false;
    }

    return !dirty.current;
  }, [runSave]);

  const scheduleSave = useCallback(() => {
    dirty.current = true;
    setSaveState({ phase: "dirty" });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = undefined;
      void persist();
    }, AUTOSAVE_MS);
  }, [persist]);

  /**
   * A pending save must not be lost to a closed tab.
   *
   * An earlier version of this listed `saveState.phase` in the dependency array
   * and cleared the debounce timer in the cleanup. That meant the instant the
   * phase became "dirty" the effect re-ran, its cleanup cancelled the timer
   * that had just been scheduled — and autosave never fired at all, while the
   * indicator cheerfully said "unsaved changes". Reading `dirty` from a ref
   * keeps this effect from re-subscribing, so it cannot cancel that timer.
   */
  useEffect(() => {
    const onLeave = () => {
      if (dirty.current) void persist();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [persist]);

  useEffect(() => {
    return () => {
      // Unmounting: cancel a pending debounce, but flush real unsaved work.
      if (timer.current !== undefined) {
        window.clearTimeout(timer.current);
        timer.current = undefined;
        if (dirty.current) void persist();
      }
    };
  }, [persist]);

  /* ---------------- mutations ---------------- */

  const mutate = useCallback(
    (fn: (current: Site) => Site) => {
      setLoaded((current) => {
        if (!current || current.slug !== slug) return current;
        const next = fn(current.site);
        latest.current = next;
        return { ...current, site: next };
      });
      scheduleSave();
    },
    [scheduleSave, slug],
  );

  const set = useCallback(
    (path: string, value: unknown) => mutate((current) => setAtPath(current, path, value)),
    [mutate],
  );

  const replace = useCallback((next: Site) => mutate(() => next), [mutate]);

  const remove = useCallback(
    (path: string) => mutate((current) => removeAtPath(current, path)),
    [mutate],
  );

  const append = useCallback(
    (path: string, item: unknown) =>
      mutate((current) => {
        const list = getAtPath<unknown[]>(current, path);
        return setAtPath(current, path, Array.isArray(list) ? [...list, item] : [item]);
      }),
    [mutate],
  );

  const move = useCallback(
    (path: string, from: number, to: number) =>
      mutate((current) => moveAtPath(current, path, from, to)),
    [mutate],
  );

  const read = useCallback(<T,>(path: string): T | undefined => getAtPath<T>(latest.current, path), []);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    return persist();
  }, [persist]);

  return {
    site,
    saveState,
    loading,
    loadError,
    existed,
    set,
    replace,
    remove,
    append,
    move,
    read,
    flush,
  };
}