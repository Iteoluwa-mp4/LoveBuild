import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Globe, PenLine, Plus } from "lucide-react";
import { FiFolder, FiLayout } from "react-icons/fi";

import "../../dashboard.css";
import { useSession } from "../../hooks/useSession";
import { deleteAccount } from "../../lib/site/account";
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
 * The list comes from `SiteRepository.list()`. In the hosted build that is per-account;
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

  /** Account deletion: idle → confirming → busy, with a message on failure. */
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const passwordFieldId = useId();

  const uid = user?.uid;

  useEffect(() => {
    let cancelled = false;
    const repository = getRepository();
    let firstLoad = true;

    const refresh = async () => {
      // A hidden tab does not need to poll. The next visible tick catches up.
      if (document.visibilityState !== "visible") return;

      try {
        const sites = await repository.list();
        if (cancelled) return;
        setState({ status: "ready", sites });
        firstLoad = false;
      } catch (cause) {
        // A failed background refresh must not replace a shelf that is already
        // on screen. Only the first load gets to show the error state.
        if (cancelled || !firstLoad) return;
        setState({
          status: "error",
          message: cause instanceof Error ? cause.message : "Could not load your sites.",
        });
      }
    };

    void (async () => {
      await refresh();
      if (cancelled || repository.kind !== "remote" || !uid) return;

      // Browser-local sites are only interesting when the account's list
      // comes from somewhere else. In local mode they *are* the list.
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
    })();

    /*
      A gentle shelf sync, not live collaboration. Twenty seconds is enough for
      "the other device sees it" at this scale, and the visibility check means a
      background tab costs nothing. The editor is still last-write-wins.
    */
    const timer =
      repository.kind === "remote"
        ? window.setInterval(() => void refresh(), 20_000)
        : undefined;

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearInterval(timer);
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

  /**
   * Account deletion, as a two-step confirm in place.
   *
   * The password (for email accounts) is the confirmation rather than a
   * separate ceremony: it is the same proof `deleteAccount` needs from
   * Firebase before it will allow the deletion, so asking once covers both.
   * Google accounts get the popup for the same reason — the provider is the
   * proof.
   *
   * On success there is almost nothing to clean up: the session listener
   * reports nobody and `RequireAuth` replaces this page with the login
   * screen. The button stays "Deleting…" until that happens, because a
   * second click during the redirect would be a second attempt at a flow
   * that is already halfway through.
   */
  const startAccountDelete = () => {
    setDeletePassword("");
    setDeleteError(null);
    setConfirmingDelete(true);
  };

  const cancelAccountDelete = () => {
    setConfirmingDelete(false);
    setDeletePassword("");
    setDeleteError(null);
  };

  const confirmAccountDelete = async () => {
    if (deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError(null);

    const result = await deleteAccount(
      user?.provider === "password" ? { password: deletePassword } : undefined,
    );

    if (result.ok) {
      // The account is gone; its import history in this browser would be a
      // key pointing at a uid that no longer exists.
      if (uid) {
        try {
          localStorage.removeItem(importedKey(uid));
        } catch {
          // Storage may be unavailable. The worst case is one stale key.
        }
      }
      return;
    }

    setDeleteBusy(false);

    // A closed Google window means "not now" — fold back to the idle state
    // rather than flashing an error at someone who merely changed their mind.
    if (result.cancelled) {
      cancelAccountDelete();
      return;
    }

    setDeleteError(result.message);
  };

  const count = state.status === "ready" ? state.sites.length : null;
  const hasSites = state.status === "ready" && state.sites.length > 0;

  return (
    <div className="dash profile">
      <header className="dash-bar">
        <div className="dash-brand">
          <h1 style={{ margin: 0 }}>
            <Link
              className="dash-wordmark"
              to={hasSites ? "/dashboard" : "/profile"}
              title={hasSites ? "Back to the editor" : "Your sites"}
            >
              LoveBuilds<span>.</span>
            </Link>
          </h1>
          <span className="dash-brand-slug">/ your sites</span>
        </div>

        <span className="dash-spacer" />

        {hasSites && (
          <Link className="btn" to="/dashboard">
            <ArrowLeft size={14} />
            Editor
          </Link>
        )}

        <Link className="btn" to="/contact" title="Questions, bugs or requests">
          Contact
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
              <h2 id="profile-sites-heading" className="profile-heading-title">
                <FiFolder aria-hidden="true" />
                Your sites
              </h2>
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
                      <FiLayout className="profile-item-icon" aria-hidden="true" />
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

        {/*
          Account deletion, at the bottom of the shelf where destructive
          things belong. Firebase accounts only: a local build has no account
          to delete, and saying so would invite a question the page cannot
          answer.
        */}
        {session.status === "signed-in" && session.method === "firebase" && (
          <section className="profile-danger" aria-labelledby="profile-danger-heading">
            <div className="profile-danger-copy">
              <h2 id="profile-danger-heading">Delete account</h2>
              <p>
                This permanently deletes your account
                {count ? ` and the ${count} ${count === 1 ? "site" : "sites"} in it` : ""}.
                Anything published stops working for anyone who has the link, and there is no
                undo.
              </p>
              {confirmingDelete && (
                <p className="profile-danger-confirm">
                  {user?.provider === "password"
                    ? "Type your password to confirm — nothing is deleted until it matches."
                    : "A Google window will open to confirm it's you — nothing is deleted until you allow it."}
                </p>
              )}
            </div>

            {confirmingDelete ? (
              <form
                className="profile-danger-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void confirmAccountDelete();
                }}
              >
                {user?.provider === "password" && (
                  <div className="field profile-danger-field">
                    <label className="field-label" htmlFor={passwordFieldId}>
                      Confirm your password
                    </label>
                    <input
                      id={passwordFieldId}
                      type="password"
                      value={deletePassword}
                      autoComplete="current-password"
                      autoFocus
                      onChange={(event) => setDeletePassword(event.target.value)}
                    />
                  </div>
                )}

                <div className="btn-row">
                  <button
                    type="submit"
                    className="btn btn-danger"
                    disabled={
                      deleteBusy ||
                      (user?.provider === "password" && deletePassword.trim() === "")
                    }
                  >
                    {deleteBusy ? "Deleting…" : "Yes, delete everything"}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={cancelAccountDelete}
                    disabled={deleteBusy}
                  >
                    Keep my account
                  </button>
                </div>

                {deleteError && (
                  <p className="profile-danger-error" role="alert">
                    {deleteError}
                  </p>
                )}
              </form>
            ) : (
              <div className="btn-row">
                <button type="button" className="btn btn-danger" onClick={startAccountDelete}>
                  Delete account
                </button>
              </div>
            )}
          </section>
        )}
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
