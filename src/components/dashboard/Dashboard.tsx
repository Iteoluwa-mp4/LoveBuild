import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import "../../dashboard.css";
import { AppearanceEditor, GalleryEditor, HomeEditor } from "./editors";
import { Section, ThemePicker } from "./fields";
import OutlinePanel from "./OutlinePanel";
import PreviewPane from "./PreviewPane";
import StatusBanner from "./StatusBanner";
import { useDraftSite } from "../../hooks/useDraftSite";
import { SEED_SLUG } from "../../lib/site/default";
import { getRepository, repositoryKind } from "../../lib/site/getRepository";
import { publicUrl } from "../../lib/site/slug";
import { type SiteStatus } from "../../lib/site/schema";
import { findIssues, findSampleIssues } from "../../lib/site/derive";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";

/**
 * The dashboard.
 *
 * Form on the left, live preview and a plain-English outline on the right. The
 * outline is the load-bearing part: it answers "what will she actually see?"
 * without the author having to imagine it.
 *
 * Step 4a. Storage is localStorage behind the repository interface and there is
 * no login — both arrive in Step 4b, which is why nothing here talks to a
 * repository directly.
 */

const SAVE_LABEL: Record<string, string> = {
  idle: "Nothing to save",
  dirty: "Unsaved changes",
  saving: "Saving…",
  saved: "Saved",
  error: "Not saved",
};

export default function Dashboard() {
  const { slug = SEED_SLUG } = useParams();
  // Supabase when configured, localStorage otherwise. See getRepository.
  const draft = useDraftSite(slug, getRepository());
  const [siteStatus, setSiteStatus] = useState<SiteStatus | null>(null);
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [previewPage, setPreviewPage] = useState<"home" | "gallery">("home");

  const site = draft.site;

  // findIssues, not findSubmissionIssues: a site with every field filled and every
  // file uploaded can still be carrying the template's placeholder wording, and
  // that is the mistake that is hardest to spot before it goes out of the door.
  const issues = useMemo(() => (site ? findIssues(site) : []), [site]);
  const sampleIssues = useMemo(() => (site ? findSampleIssues(site) : []), [site]);
  const problem = issues.length > 0;

  // Re-read the publication state whenever the site finishes saving, so the
  // banner flips to Live without a reload.
  useEffect(() => {
    if (draft.saveState.phase !== "saved" && draft.saveState.phase !== "idle") return;
    void getRepository().list().then((list) => {
      setSiteStatus(list.find((s) => s.slug === slug)?.status ?? null);
    }).catch(() => setSiteStatus(null));
  }, [draft.saveState.phase, slug]);

  /** Opens the section owning a config path, so the outline can point at it. */
  const jumpTo = (path: string) => {
    const head = path.split(".")[0];
    const sectionTitle =
      head === "gallery"
        ? "Chapters"
        : path.startsWith("home.moments")
          ? "Moments"
          : path.startsWith("home.quote")
            ? "Quote and letter"
            : path.startsWith("home.footer")
              ? "Closing section"
              : path.startsWith("home.hero")
                ? "First impression"
                : null;

    const target = Array.from(
      document.querySelectorAll<HTMLDetailsElement>(".dash-section"),
    ).find((el) => el.querySelector(".dash-section-title")?.textContent === sectionTitle);

    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (target && !target.open) target.open = true;
  };

  if (draft.loading) {
    return (
      <div className="dash">
        <p className="spinner">Opening {slug}…</p>
      </div>
    );
  }

  if (!site) {
    return (
      <div className="dash">
        <div style={{ padding: "2rem" }}>
          <p className="notice notice-bad">{draft.loadError ?? "Could not open this site."}</p>
        </div>
      </div>
    );
  }

  const sessionOnlyFiles = countSessionOnly(site);

  return (
    <div className="dash">
      <header className="dash-bar">
        <div>
          {/*
            Links to /dashboard, which lists sites. Not to this page — that
            would be a self-link, and it is where you go when there is more
            than one site.
          */}
          <h1>
            <Link to="/dashboard" title="All sites">
              {site.identity.name || slug}
            </Link>
          </h1>
          <span className="dash-bar-sub">/s/{slug}</span>
        </div>

        <span className="dash-spacer" />

        <span className="save-state" title={saveTitle(draft.saveState)}>
          <span className="save-dot" data-phase={draft.saveState.phase} />
          {SAVE_LABEL[draft.saveState.phase] ?? draft.saveState.phase}
        </span>

        {/*
          New tab on purpose: opening the same tab would throw away whatever
          half-finished edit is in the form. The preview pane next to this shows
          the same site live — this is the saved one.
        */}
        <Link className="btn" to={publicUrl(slug)} target="_blank" rel="noreferrer">
          View site
        </Link>
        <Link className="btn" to={`${publicUrl(slug)}/gallery`} target="_blank" rel="noreferrer">
          Gallery
        </Link>

        {isSupabaseConfigured && (
          <button
            type="button"
            className="btn"
            onClick={() => void supabase().auth.signOut()}
          >
            Sign out
          </button>
        )}
        <button
          type="button"
          className="btn"
          onClick={() => void draft.flush()}
          disabled={draft.saveState.phase !== "dirty"}
        >
          Save now
        </button>
      </header>

      <div className="dash-body">
        <div className="dash-form">
          <StatusBanner
            status={siteStatus}
            slug={slug}
            local={repositoryKind() === "local"}
          />
          {draft.loadError && (
            <p className="notice notice-bad">
              <strong>The stored version could not be read.</strong> {draft.loadError}
            </p>
          )}

          {draft.saveState.phase === "error" && (
            <p className="notice notice-bad">
              <strong>Not saved.</strong> {draft.saveState.message}
            </p>
          )}

          {sessionOnlyFiles > 0 && (
            <p className="notice notice-warn">
              <strong>
                {sessionOnlyFiles} {sessionOnlyFiles === 1 ? "file is" : "files are"} only
                previews.
              </strong>{" "}
              They show on screen now but disappear on reload — uploading them properly comes
              with the backend step.
            </p>
          )}

          <Section title="Theme" hint="Five ready-made looks">
            <ThemePicker value={site.theme} onChange={(id) => draft.set("theme", id)} />
          </Section>

          <HomeEditor draft={draft} />
          <GalleryEditor draft={draft} />
          <AppearanceEditor draft={draft} />

          <Section title="Ready to share?" defaultOpen>
            {/*
              Placeholder text gets its own notice rather than joining the
              missing-fields list. "Still missing" is reassuring - nobody worries
              about a blank field. "Still has the placeholder" is not: the field
              is filled, so it looks done, and that is exactly how template copy
              reaches a real visitor.
            */}
            {sampleIssues.length > 0 && (
              <div className="notice notice-warn">
                <strong>
                  {sampleIssues.length}{" "}
                  {sampleIssues.length === 1
                    ? "field still has"
                    : "fields still have"}{" "}
                  the placeholder text.
                </strong>{" "}
                These read as filled in, so they are easy to miss. Replace them with your
                own words.
                <ul style={{ margin: "0.25rem 0 0", paddingLeft: "1.1rem" }}>
                  {sampleIssues.slice(0, 6).map((issue) => (
                    <li key={issue.path}>
                      {issue.message}
                      <button
                        type="button"
                        className="btn btn-icon"
                        onClick={() => jumpTo(issue.path)}
                      >
                        go
                      </button>
                    </li>
                  ))}
                  {sampleIssues.length > 6 && (
                    <li>...and {sampleIssues.length - 6} more</li>
                  )}
                </ul>
              </div>
            )}

            {problem ? (
              <div className="notice notice-warn">
                <strong>
                  {issues.length} {issues.length === 1 ? "thing is" : "things are"} still missing.
                </strong>
                <ul style={{ margin: "0.25rem 0 0", paddingLeft: "1.1rem" }}>
                  {issues.slice(0, 6).map((issue) => (
                    <li key={issue.path}>
                      {issue.message}
                      {issue.path && (
                        <>
                          {" "}
                          <button
                            type="button"
                            className="btn btn-icon"
                            onClick={() => jumpTo(issue.path)}
                          >
                            go
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                  {issues.length > 6 && <li>…and {issues.length - 6} more</li>}
                </ul>
              </div>
            ) : (
              <p className="notice" style={{ borderColor: "var(--dash-good)" }}>
                <strong>Everything that matters is filled in.</strong> Sending it for review comes
                with the login step.
              </p>
            )}
          </Section>
        </div>

        <aside className="dash-side">
          <PreviewPane
            site={site}
            basePath={previewBasePath(previewPage)}
            device={device}
            onDeviceChange={setDevice}
          />

          <div className="btn-row">
            <button
              type="button"
              className="btn btn-icon"
              aria-pressed={previewPage === "home"}
              onClick={() => setPreviewPage("home")}
            >
              Front page
            </button>
            <button
              type="button"
              className="btn btn-icon"
              aria-pressed={previewPage === "gallery"}
              onClick={() => setPreviewPage("gallery")}
            >
              Gallery
            </button>
          </div>

          {/*
            Outline below the preview. The preview is the first thing seen on the
            right — it answers "what does it look like?" before the outline answers
            "what will she actually see?"
          */}
          <OutlinePanel site={site} onJump={jumpTo} />
        </aside>
      </div>
    </div>
  );
}

/**
 * Where the preview frame loads from.
 *
 * Both routes accept a trailing slash and both are registered, because the
 * browser may normalise either way and a 404 inside an iframe is invisible — the
 * frame is simply blank.
 */
function previewBasePath(page: "home" | "gallery"): string {
  return page === "gallery" ? "/preview/gallery" : "/preview/";
}

function saveTitle(state: { phase: string; message?: string }): string {
  if (state.phase === "error") return state.message ?? "";
  if (state.phase === "saved") return "Saved to this browser only, for now";
  if (state.phase === "dirty") return "Saving shortly";
  return "";
}

/**
 * Counts media that exist only as blob URLs.
 *
 * A blob URL is tied to the page that created it, so these are exactly the files
 * that will be gone after a reload — worth saying out loud rather than letting
 * someone discover it later.
 */
function countSessionOnly(site: ReturnType<typeof useDraftSite>["site"]): number {
  if (!site) return 0;

  let count = 0;
  const check = (media: { url: string; publicId: string | null }) => {
    if (media.url.startsWith("blob:")) count += 1;
  };

  site.home.moments.forEach((m) => check(m.image));
  site.gallery.chapters.forEach((c) => {
    c.films.forEach((f) => check(f.src));
    c.stills.forEach((s) => check(s.src));
  });

  return count;
}
