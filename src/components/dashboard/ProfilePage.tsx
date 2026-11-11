import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Globe, PenLine, Plus } from "lucide-react";

import "../../dashboard.css";
import { useSession } from "../../hooks/useSession";
import { signOut } from "../../lib/site/auth";
import { STORAGE_PREFIX } from "../../lib/site/brand";
import { getRepository } from "../../lib/site/getRepository";
import { LocalSiteRepository } from "../../lib/site/localRepository";
import type { SiteSummary } from "../../lib/site/repository";
import type { SiteStatus } from "../../lib/site/schema";
import { publicUrl } from "../../lib/site/slug";

/**
 * The author's own page: who they are, and every site they have made.
 *
 * The editor is `/dashboard/:slug` and is deliberately about one site at a
 * time. This is the other half of the tool — the shelf. It answers "what have I
 * made?" and "make another", which the editor header has no room for.
 *
 * The list comes from `SiteRepository.list()`. On Firestore that is per-account;
 * on a fresh clone it is per-browser. Nothing in the rendering knows the
 * difference — but the page does offer to import browser-local sites once, so
 * switching to an account does not strand work that was made before it.
 */

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; sites: SiteSummary[] };

/** One formatter for the whole page, rather than one per row. */
const DATE = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "recently" : DATE.format(date);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) ?? "?";
  const second = parts[1]?.charAt(0) ?? "";
  return `${first}${second}`.toUpperCase();
}

const STATUS_LABEL: Record<SiteStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  published: "Live",
};

export default function ProfilePage() {
  const session = useSession();
  const user = session.status === "signed-in" ? session.user : null;
  /** No Firebase project: sites live in this browser, so there is no account to show. */
  const localMode = session.status === "signed-in" && session.method === "local";

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [localSites, setLocalSites] = useState<SiteSummary[]>([]);
  const [importing, setImporting] = useState(false);
  const [importNote, setImportNote] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const uid = user?.uid;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const repository = getRepository();

      try {
        const sites = await repository.list();
        if (cancelled) return;
        setState({ status: "ready", sites });

        // Browser-local sites are only interesting when the account's list
        // comes from somewhere else. In local mode they *are* the list.
        if (repository.kind !== "remote" || !uid) return;

        try {
          const local = new LocalSiteRepository();
          const found = await local.list();
          if (cancelled) return;

          const imported = readImported(uid);
          setLocalSites(found.filter((site) => !imported.includes(site.slug)));
        } catch {
          // Reading localStorage is best-effort. The shelf above already
          // loaded; failing to look for importable drafts must not replace it
          // with an error.
        }
      } catch (cause) {
        if (!cancelled) {
          setState({
            status: "error",
            message: cause instanceof Error ? cause.message : "Could not load your sites.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uid]);

  /**
   * Copies every browser-local site into the signed-in account.
   *
   * Deliberately manual. An automatic import would write to someone's account
   * just because they opened the page, and would run again on every device that
   * happened to share a browser profile. The button makes the move a decision.
   */
  const importLocal = async () => {
    if (!uid || importing || localSites.length === 0) return;

    setImporting(true);
    setImportError(null);
    setImportNote(null);

    const repository = getRepository();
    const local = new LocalSiteRepository();
    const imported: string[] = [];
    let renamed = 0;

    try {
      for (const summary of localSites) {
        const site = await local.get(summary.slug);
        if (!site) continue;

        const created = await repository.create(site);
        imported.push(summary.slug);
        if (created.slug !== site.slug) renamed += 1;

        // Keep the status, so a site that was already live does not silently
        // become a draft and break the link someone may already have.
        if (summary.status !== "draft") {
          await repository.setStatus(created.slug, summary.status);
        }
      }
    } catch (cause) {
      // Record partial progress. Retrying should import what is left, not
      // duplicate everything that already made it.
      if (imported.length > 0) {
        writeImported(uid, imported);
        setLocalSites((sites) => sites.filter((site) => !imported.includes(site.slug)));
      }
      setImportError(
        cause instanceof Error ? cause.message : "Could not import your local sites.",
      );
      setImporting(false);
      return;
    }

    writeImported(uid, imported);
    setLocalSites([]);
    setImporting(false);

    const renamedNote =
      renamed > 0
        ? ` ${renamed} ${renamed === 1 ? "kept a new address" : "kept new addresses"} because the old one was taken.`
        : "";
    setImportNote(
      `Imported ${imported.length} ${imported.length === 1 ? "site" : "sites"}.${renamedNote}`,
    );

    try {
      setState({ status: "ready", sites: await repository.list() });
    } catch {
      // The import itself worked; only the refresh failed. A reload will show
      // the list, so this does not deserve an error over the success note.
    }
  };

  const count = state.status === "ready" ? state.sites.length : null;

  return (
    <div className="dash profile">
      <header className="dash-bar">
        <div className="dash-brand">
          <h1 style={{ margin: 0 }}>
            <Link to="/dashboard" title="Back to the editor">
              LoveBuilds
            </Link>
          </h1>
          <span className="dash-brand-slug">/ your sites</span>
        </div>

        <span className="dash-spacer" />

        <Link className="btn" to="/dashboard">
          <ArrowLeft size={14} />
          Editor
        </Link>

        {session.status === "signed-in" && session.method === "firebase" && (
          <button type="button" className="btn" onClick={() => void signOut()}>
            Sign out
          </button>
        )}
      </header>

      <main className="profile-scroll">
        <section className="profile-card" aria-label="Your account">
          <div className="profile-avatar" aria-hidden="true">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
            ) : (
              initials(localMode ? "Local workspace" : (user?.name ?? "You"))
            )}
          </div>

          <div className="profile-identity">
            <h2>{localMode ? "Local workspace" : (user?.name ?? "You")}</h2>
            {localMode ? (
              <p>Sites are saved in this browser. Add a Firebase project to sign in.</p>
            ) : (
              user?.email && <p>{user.email}</p>
            )}

            <div className="profile-badges">
              {user?.provider === "google" && (
                <span className="profile-badge">Google account</span>
              )}
              {user?.provider === "password" && (
                <span className="profile-badge">Email and password</span>
              )}
              {user && !user.emailVerified && user.provider === "password" && (
                <span className="profile-badge profile-badge-warn">Email not verified</span>
              )}
            </div>
          </div>
        </section>

        {localSites.length > 0 && (
          <section className="notice notice-warn profile-import" aria-label="Sites in this browser">
            <p>
              <strong>
                {localSites.length} {localSites.length === 1 ? "site is" : "sites are"} saved in
                this browser.
              </strong>{" "}
              Bring {localSites.length === 1 ? "it" : "them"} into your account so{" "}
              {localSites.length === 1 ? "it follows" : "they follow"} you to other devices.
            </p>

            <div className="btn-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void importLocal()}
                disabled={importing}
              >
                {importing ? "Importing…" : `Import ${localSites.length === 1 ? "it" : "them"}`}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setLocalSites([])}
                disabled={importing}
              >
                Not now
              </button>
            </div>

            {importError && <p role="alert">{importError}</p>}
          </section>
        )}

        {importNote && (
          <p className="notice notice-live" role="status">
            {importNote}
          </p>
        )}

        <section className="profile-sites" aria-labelledby="profile-sites-heading">
          <div className="profile-heading">
            <div>
              <h2 id="profile-sites-heading">Your sites</h2>
              <p className="field-hint">
                {count === null
                  ? "Loading…"
                  : count === 0
                    ? "Nothing made yet."
                    : `${count} ${count === 1 ? "site" : "sites"}, newest first.`}
              </p>
            </div>

            <Link className="btn btn-primary" to="/new">
              <Plus size={15} />
              New site
            </Link>
          </div>

          {state.status === "loading" && <p className="spinner">Opening your shelf…</p>}

          {state.status === "error" && (
            <p className="notice notice-bad" role="alert">
              {state.message}
            </p>
          )}

          {state.status === "ready" && state.sites.length === 0 && (
            <div className="profile-empty">
              <p>
                {localSites.length > 0
                  ? "Nothing in your account yet. Import the site above to bring it with you."
                  : "You haven’t made a site yet."}
              </p>
              <Link className="btn btn-primary" to="/new">
                Make the first one
              </Link>
            </div>
          )}

          {state.status === "ready" && state.sites.length > 0 && (
            <ul className="profile-list">
              {state.sites.map((site) => (
                <li key={site.slug} className="profile-item">
                  <div className="profile-item-main">
                    <div className="profile-item-title">
                      <span>{site.name}</span>
                      <span className={`profile-status profile-status-${site.status}`}>
                        {STATUS_LABEL[site.status]}
                      </span>
                    </div>

                    <div className="profile-item-meta">
                      <code>{publicUrl(site.slug)}</code>
                      <span>Updated {formatDate(site.updatedAt)}</span>
                    </div>
                  </div>

                  <div className="profile-item-actions">
                    <Link className="btn" to={`/dashboard/${site.slug}`}>
                      <PenLine size={14} />
                      Edit
                    </Link>

                    {site.status === "published" && (
                      <a
                        className="btn"
                        href={publicUrl(site.slug)}
                        target="_blank"
                        rel="noreferrer"
                        title="Open the live site in a new tab"
                      >
                        <Globe size={14} />
                        View
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * IMPORT BOOKKEEPING
 * ------------------------------------------------------------------ */

/**
 * Which browser-local sites this account has already copied.
 *
 * Stored per uid rather than per browser so signing into a second account does
 * not inherit the first account's import history. The value is the local slug,
 * not the new one: a suffix on collision would otherwise make a failed retry
 * look like an unimported site.
 */
function importedKey(uid: string): string {
  return `${STORAGE_PREFIX}imported:${uid}`;
}

function readImported(uid: string): string[] {
  try {
    const raw = localStorage.getItem(importedKey(uid));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((slug): slug is string => typeof slug === "string")
      : [];
  } catch {
    return [];
  }
}

function writeImported(uid: string, slugs: string[]): void {
  const next = [...new Set([...readImported(uid), ...slugs])];
  try {
    localStorage.setItem(importedKey(uid), JSON.stringify(next));
  } catch {
    // Storage is full or unavailable. The import itself succeeded; the worst
    // case is that the card offers the same sites again next time.
  }
}
