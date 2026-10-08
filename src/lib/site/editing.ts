import { createContext, useContext } from "react";

/**
 * The editing seam.
 *
 * Kept apart from `EditableText.tsx` so that file exports components and nothing
 * else, which is what makes React Fast Refresh work while you edit: a module that
 * exports a hook alongside components gets fully reloaded on every save, losing
 * the state you were looking at.
 *
 * The context is what lets the template stay unaware of editing. `EditableText`
 * asks; `EditingProvider` answers. Nothing else in the template imports either.
 */

export type EditingContextValue = {
  /** True inside the dashboard preview, false on a published site. */
  enabled: boolean;
  /** Called with a dotted config path and the new text. */
  report: (path: string, value: string) => void;
};

/**
 * Inert by default.
 *
 * The fallback matters: it means a component rendered outside a provider — a dev
 * screen, a test, anything added later by mistake — renders read-only rather than
 * throwing or silently swallowing typing.
 */
export const EditingContext = createContext<EditingContextValue>({
  enabled: false,
  report: () => {},
});

export function useEditing(): EditingContextValue {
  return useContext(EditingContext);
}