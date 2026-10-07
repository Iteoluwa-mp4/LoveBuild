import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import GalleryPage from "../site/GalleryPage";
import HomePage from "../site/HomePage";
import SiteShell from "../site/SiteShell";
import { MESSAGES, MSG_PREVIEW_CONFIG, MSG_PREVIEW_READY } from "../../lib/site/brand";
import { isInternalPageLink } from "../../lib/site/paths";
import { emptySite } from "../../lib/site/default";
import { siteSchema, type Site } from "../../lib/site/schema";

/**
 * The page the preview iframe loads.
 *
 * It is the real template, mounted against the config the dashboard posts in.
 * Same components, same animations, same scroll behaviour — which is the entire
 * reason previewing through an iframe is worth the extra machinery. Nothing here
 * is a simplified copy.
 *
 * It lives under `/preview` rather than `/s/:slug` so it can never be a route
 * someone shares, and so a published site is only ever rendered from stored
 * config.
 */

type Outgoing = { type: typeof MSG_PREVIEW_CONFIG; config: Site };
type Incoming = { type: typeof MSG_PREVIEW_READY };

const HANDOFF_KEY = `${MESSAGES}handoff`;

/**
 * Restores the last posted draft so a manual frame reload comes back populated.
 * Read in the state initialiser because it only ever applies to the first paint;
 * doing it in an effect would setState synchronously on mount.
 */
function initialConfig(slug: string | undefined): Site {
  const blank = emptySite(slug ?? "preview");
  try {
    const raw = sessionStorage.getItem(HANDOFF_KEY);
    if (!raw) return blank;
    const parsed = siteSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : blank;
  } catch {
    return blank;
  }
}

export default function PreviewPage({ variant }: { variant: "home" | "gallery" }) {
  const { slug } = useParams();
  const [site, setSite] = useState<Site>(() => initialConfig(slug));

  // Tell the parent we are listening. Sent from both the initial paint and
  // whenever the frame is remounted, since a device switch replaces the iframe.
  const announce = () => {
    window.parent?.postMessage({ type: MSG_PREVIEW_READY } satisfies Incoming, window.location.origin);
  };

  useEffect(() => {
    announce();
  }, []);

  useWheelContainment();
  useInertNavigation();

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      const data = event.data as Partial<Outgoing>;
      if (data?.type !== MSG_PREVIEW_CONFIG) return;

      // Validate what arrives. The dashboard is the only sender, but this is the
      // boundary where an unvalidated object would reach the renderer.
      const parsed = siteSchema.safeParse(data.config);
      if (parsed.success) {
        setSite(parsed.data);
        // A handoff key lets a hard refresh of the frame come back populated
        // rather than blank, since postMessage alone is lost on reload.
        try {
          sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(parsed.data));
        } catch {
          /* preview only; losing this is survivable */
        }
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Restored once, so a manual frame reload keeps showing the draft.
  const basePath = `/s/${site.slug}`;

  return (
    <SiteShell site={site}>
      {variant === "home" ? (
        <HomePage site={site} basePath={basePath} />
      ) : (
        <GalleryPage site={site} basePath={basePath} />
      )}
    </SiteShell>
  );
}

/**
 * Stops the preview navigating itself away.
 *
 * The buttons inside the frame are real links, and clicking one moved the
 * iframe to that page — which, for the gallery button, meant throwing away the
 * draft being previewed and rendering a real site inside a 400px box.
 *
 * The preview is for looking at, not clicking through, so internal links are
 * swallowed. Off-site links, `mailto:`, and plain `#fragment` links are left
 * alone — a fragment does not leave the page and is useful to be able to try.
 *
 * Registered in the **capture** phase, and that is the whole trick. React Router
 * hands clicks to a listener on the app's root element, which sits *inside*
 * `document` — so a bubbling listener on `document` runs afterwards, by which
 * point the navigation has already been scheduled and `defaultPrevented` is
 * already true. Capturing on `document` is the only place that runs first.
 */
function useInertNavigation() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const href = anchor.getAttribute("href") ?? "";
      if (!isInternalPageLink(href)) return;

      event.preventDefault();
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
}
/**
 * Keeps the wheel inside the preview.
 *
 * An iframe is a separate scrolling document: wheel events over it scroll the
 * frame and are invisible to the parent. Once the frame reaches its own limit
 * the naive behaviour is to let the browser do whatever it likes — usually
 * rubber-banding, or on mobile triggering the swipe-back gesture.
 *
 * So at the limit the event is swallowed here. There is deliberately nothing to
 * hand off to: the dashboard's two panes are locked to the viewport and are
 * meant to stop dead, so "no further scroll" is the whole of the desired
 * behaviour.
 *
 * `passive: false` is required. A passive listener is forbidden from calling
 * `preventDefault`, and the browser would scroll the frame regardless of what
 * this function returns.
 */
function useWheelContainment() {
  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      const root = document.scrollingElement ?? document.documentElement;
      if (!root) return;

      const maxScroll = root.scrollHeight - root.clientHeight;
      // A page shorter than its frame has nothing to scroll, so swallow
      // everything rather than letting a rubber-band happen.
      if (maxScroll <= 1) {
        event.preventDefault();
        return;
      }

      const atTop = root.scrollTop <= 0;
      const atBottom = root.scrollTop >= maxScroll - 1;

      if ((event.deltaY > 0 && atBottom) || (event.deltaY < 0 && atTop)) {
        event.preventDefault();
      }
    };

    document.addEventListener("wheel", onWheel, { passive: false });
    return () => document.removeEventListener("wheel", onWheel);
  }, []);
}