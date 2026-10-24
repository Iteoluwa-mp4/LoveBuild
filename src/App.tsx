import { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";

import LoginPage from "./components/auth/LoginPage";
import RequireAuth from "./components/auth/RequireAuth";
import CreateSite from "./components/dashboard/CreateSite";
import Dashboard from "./components/dashboard/Dashboard";
import PreviewPage from "./components/dashboard/PreviewPage";
import DevScreen from "./components/dev/DevScreen";
import ClassicGalleryPage from "./components/site/classic/GalleryPage";
import ClassicHomePage from "./components/site/classic/HomePage";
import SiteShell from "./components/site/shared/SiteShell";
import { loadSite, type LoadState } from "./lib/site/load";
import { sample } from "./lib/site/default";
import type { SiteSummary } from "./lib/site/repository";
import ModernTemplate from "./components/site/modern/HomePage";
import ModernGallery from "./components/site/modern/GalleryPage";
import { MODERN_BASE } from "./components/site/modern/paths";
import ScrapbookHomePage from "./components/site/scrapbook/HomePage";
import ScrapbookGalleryPage from "./components/site/scrapbook/GalleryPage";
import { SCRAPBOOK_BASE } from "./components/site/scrapbook/paths";
import "./App.css";

/**
 * Routes.
 *
 * `/` is the dashboard, not a published site. LoveBuilds is a tool someone sits
 * down at; the site is the thing it produces, reached at `/s/:slug` or from the
 * dashboard's "View saved site" button.
 *
 * `/preview` is deliberately not under `/s/`, so it can never be a link someone
 * shares — a published page only ever renders from stored config.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* The editor, and the only thing behind a login. */}
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardGate />
            </RequireAuth>
          }
        />
        <Route
          path="/dashboard/:slug"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route path="/login" element={<LoginPage />} />

        {/* The public site. Reachable by link, not by accident. */}
        <Route path="/s/:slug" element={<SiteRoute variant="home" />} />
        <Route path="/s/:slug/gallery" element={<SiteRoute variant="gallery" />} />

        <Route path="/preview" element={<PreviewPage variant="home" />} />
        <Route path="/preview/" element={<PreviewPage variant="home" />} />
        <Route path="/preview/gallery" element={<PreviewPage variant="gallery" />} />
        <Route path="/preview/gallery/" element={<PreviewPage variant="gallery" />} />

        <Route path="/dev/themes" element={<DevScreen kind="themes" />} />
        <Route path="/dev/blocks" element={<DevScreen kind="blocks" />} />
        <Route path="/dev/outline" element={<DevScreen kind="outline" />} />
        {/*
          Template previews. Not under /s/:slug, because these templates are not
          yet config-driven — each carries its own copy so it can be judged as a
          design. Every one of them exports a base path, so the route table and
          the links inside the template cannot drift apart.

          When `template` lands in the schema this becomes the development
          surface, and /s/:slug serves whichever template is selected.
        */}
        {/*
          These two are now development surfaces rather than a second copy of
          the site. `template` is in the schema, so `/s/:slug` serves whichever
          template a config selects and these preview the modern one in isolation
          — against the seed config, with no dashboard involved.
        */}
        <Route path={MODERN_BASE} element={<ModernPreviewPage variant="home" />} />
        <Route path={`${MODERN_BASE}/gallery`} element={<ModernPreviewPage variant="gallery" />} />
        <Route path={SCRAPBOOK_BASE} element={<ScrapbookPreviewPage variant="home" />} />
        <Route path={`${SCRAPBOOK_BASE}/gallery`} element={<ScrapbookPreviewPage variant="gallery" />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

/**
 * `/dashboard` with no slug: create the first site, or open the most recent one.
 *
 * Rather than bouncing through `/dashboard/:slug` it resolves here, because
 * deciding between "nothing yet" and "one of several" needs the list, and a
 * redirect cannot carry that decision.
 */
function DashboardGate() {
  const [state, setState] = useState<"loading" | SiteSummary[]>("loading");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const { getRepository } = await import("./lib/site/getRepository");
        const list = await getRepository().list();
        if (!cancelled) setState(list);
      } catch {
        if (!cancelled) setState([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") return <div className="dash" />;

  const newest = state[0];

  if (!newest) {
    return (
      <CreateSite
        onDone={(slug) => {
          window.location.assign(`/dashboard/${slug}`);
        }}
      />
    );
  }

  return <Navigate to={`/dashboard/${newest.slug}`} replace />;
}

/**
 * The modern template on its own, against the seed config.
 *
 * Wrapped in `SiteShell` because the template's colours now come from the theme
 * tokens it publishes — which is also the check that those tokens reach a page
 * that does not use Tailwind. `basePath` is `MODERN_BASE` so every internal
 * link resolves inside this preview rather than pointing at `/s/`.
 */
function ModernPreviewPage({ variant }: { variant: "home" | "gallery" }) {
  const site = useMemo(() => sample(), []);
  return (
    <SiteShell site={site}>
      <SitePages site={site} basePath={MODERN_BASE} variant={variant} />
    </SiteShell>
  );
}

function ScrapbookPreviewPage({ variant }: { variant: "home" | "gallery" }) {
  const site = useMemo(() => sample(), []);
  return (
    <SiteShell site={site}>
      <SitePages site={site} basePath={SCRAPBOOK_BASE} variant={variant} />
    </SiteShell>
  );
}

/** Loads a site by slug and hands it to the right page. */
function SiteRoute({ variant }: { variant: "home" | "gallery" }) {
  const { slug } = useParams();

  /**
   * Tagged with the slug it belongs to, so "loading" is derived during render
   * rather than pushed by an effect. Navigating to a different slug therefore
   * shows the skeleton without a synchronous setState on every change.
   */
  const [result, setResult] = useState<{ slug: string; value: LoadState } | null>(null);

  useEffect(() => {
    let cancelled = false;

    void loadSite(slug).then((value) => {
      if (!cancelled) setResult({ slug: slug ?? "", value });
    });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!result || result.slug !== (slug ?? "")) return <LoadingScreen />;

  const state = result.value;
  if (state.status === "loading") return <LoadingScreen />;
  if (state.status === "missing") return <NotFound />;
  if (state.status === "error") return <ErrorScreen message={state.message} />;

  const basePath = `/s/${state.site.slug}`;
  return (
    <SiteShell site={state.site}>
      <SitePages site={state.site} basePath={basePath} variant={variant} />
    </SiteShell>
  );
}

/**
 * Picks the template, then the page.
 *
 * One switch in one place, because `template` decides layout and `variant`
 * decides which of that layout's two pages is showing — and the four
 * combinations are not interchangeable. `HomePage` and `GalleryPage` are
 * imported with explicit names rather than aliased at the call site, so this
 * reads as a routing table instead of a naming trick.
 *
 * This is also what makes a template switch non-destructive: the config is
 * identical either way, and the modern template reads the same
 * `home.moments` for its photographs. See `modernMemories` in `derive.ts`.
 */
function SitePages({
  site,
  basePath,
  variant,
}: {
  site: import("./lib/site/schema").Site;
  basePath: string;
  variant: "home" | "gallery";
}) {
  if (site.template === "modern") {
    return variant === "home" ? (
      <ModernTemplate site={site} basePath={basePath} />
    ) : (
      <ModernGallery site={site} basePath={basePath} />
    );
  }

  if (site.template === "scrapbook") {
    return variant === "home" ? (
      <ScrapbookHomePage site={site} basePath={basePath} />
    ) : (
      <ScrapbookGalleryPage site={site} basePath={basePath} />
    );
  }

  return variant === "home" ? (
    <ClassicHomePage site={site} basePath={basePath} />
  ) : (
    <ClassicGalleryPage site={site} basePath={basePath} />
  );
}

/**
 * Skeleton for the config fetch.
 *
 * Not optional: with no server there is no server-rendered HTML, so the fetch
 * happens after the bundle runs and an unstyled flash is the default otherwise.
 * The background is themed, so it reads as the site rather than as a spinner.
 */
function LoadingScreen() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading"
      className="h-svh w-full animate-pulse"
      style={{
        background: "var(--theme-grad-hero-bg, linear-gradient(#3a1b5c, #0e0518))",
      }}
    />
  );
}

function NotFound() {
  return (
    <Screen>
      <h1 className="font-display text-3xl">Nothing here</h1>
      <p className="max-w-sm text-sm opacity-70">
        That link doesn&rsquo;t point at a page. It may not have been published yet.
      </p>
      <a href="/dashboard" className="mt-2 underline underline-offset-4 opacity-90">
        Go to the dashboard
      </a>
    </Screen>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <Screen>
      <h1 className="font-display text-3xl">Something went wrong</h1>
      <p className="max-w-sm text-sm opacity-70">{message}</p>
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-svh flex-col items-center justify-center gap-3 px-6 text-center font-sans"
      style={{ background: "var(--theme-void, #150a22)", color: "var(--theme-text, #efe3fa)" }}
    >
      {children}
    </div>
  );
}