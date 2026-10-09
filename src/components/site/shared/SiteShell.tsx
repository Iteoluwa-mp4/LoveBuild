import { type ReactNode, useEffect, useMemo } from "react";

import type { Site } from "../../../lib/site/schema";
import { resolveTheme } from "../../../lib/site/themes";

/**
 * Roots a site: resolves the theme and publishes its tokens.
 *
 * Tokens go on the document element as well as on this div. The reason is
 * `body { background: var(--color-void) }` in `index.css`: if the variables
 * only exist on a nested div, `body` never resolves them and falls back to a
 * hardcoded midnight colour. On any other theme that leaves a midnight strip
 * behind during overscroll, and the scrollbar gutter the wrong shade. Putting
 * them on `<html>` makes the whole document — including the parts no component
 * owns — follow the preset.
 *
 * The inline copy on the div stays, so a themed fragment still works on its own.
 *
 * `data-theme` carries the requested id even when it is unknown, so a config
 * pointing at a deleted preset is visible in devtools instead of silently
 * rendering as the default.
 */
export default function SiteShell({
  site,
  children,
  className = "",
}: {
  site: Site;
  children: ReactNode;
  className?: string;
}) {
  const theme = useMemo(() => resolveTheme(site.theme), [site.theme]);

  useEffect(() => {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(theme.tokens)) {
      root.style.setProperty(key, value);
    }
    root.setAttribute("data-theme", site.theme);

    return () => {
      for (const key of Object.keys(theme.tokens)) {
        root.style.removeProperty(key);
      }
      if (root.getAttribute("data-theme") === site.theme) {
        root.removeAttribute("data-theme");
      }
    };
  }, [theme, site.theme]);

  return (
    <div
      data-theme={site.theme}
      style={theme.tokens}
      className={`min-h-svh bg-void text-content ${className}`}
    >
      {children}
    </div>
  );
}