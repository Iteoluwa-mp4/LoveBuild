import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { CircleUserRound, Globe, Mail } from "lucide-react";
import { FiDroplet, FiHome, FiImage, FiLayout, FiList } from "react-icons/fi";

import "../../dashboard.css";
import { AppearanceEditor } from "./editors";
import { Section, SectionGroup, TemplatePicker, ThemePicker } from "./fields";
import { SECTION_ID, sectionIdFor } from "./jumpTarget";
import OutlinePanel from "./OutlinePanel";
import PreviewPane from "./PreviewPane";
import ProgressRing from "./ProgressRing";
import PublishDock from "./PublishDock";
import { useDraftSite } from "../../hooks/useDraftSite";
import { useScrollToSection } from "../../hooks/useScrollToSection";
import { useSession } from "../../hooks/useSession";
import { SEED_SLUG } from "../../lib/site/default";
import { getRepository, repositoryKind } from "../../lib/site/getRepository";
import { publicUrl } from "../../lib/site/slug";
import { type SiteStatus } from "../../lib/site/schema";
import { isTemplateAvailable } from "../../lib/site/templateAccess";
import { templateUsesThemes } from "../../lib/site/themes";
import { uploadItems, uploadProgress } from "../../lib/site/derive";
import { resendVerification, signOut } from "../../lib/site/auth";

/**
 * The dashboard.
 *
 * Form on the left, live preview and a plain-English outline on the right. The
 * outline is the load-bearing part: it answers "what will she actually see?"
 * without the author having to imagine it.
 *
 * Storage is localStorage behind the repository interface, and sign-in is
 * Firebase. The repository is still the seam a hosted backend slots into, which
 * is why nothing here talks to it directly.
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

  const session = useSession();
  const user = session.status === "signed-in" ? session.user : null;

  /**
   * Which templates this account may pick.
   *
   * Local mode has no email to compare, so development keeps the whole list;
   * production never reaches local mode because `useSession` fails closed
   * without a Firebase project. Everyone else gets the public templates plus
   * any private one their email owns.
   */
  const localMode = session.status === "signed-in" && session.method === "local";
  const canUseTemplate = (id: string) =>
    localMode || isTemplateAvailable(id, user?.email, user?.uid);

  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Neon through the API when configured, localStorage on a fresh clone. See getRepository.
  const draft = useDraftSite(slug, getRepository());
  const [siteStatus, setSiteStatus] = useState<SiteStatus | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "tablet" | "phone">("desktop");
  const [previewPage, setPreviewPage] = useState<"home" | "gallery">("home");
  const [editing, setEditing] = useState(false);

  /*
    The publish dock's height, measured rather than guessed.

    The dock is sticky at the bottom of the form column and changes height with
    its state — the confirm step adds a line, the published state adds a link.
    The upload ring sits directly above it, so a fixed offset would put the ring
    on top of the dock in one state and leave a gap in another. Measuring it
    means the ring clears the dock whatever the dock is doing.
  */
  const dockRef = useRef<HTMLDivElement>(null);
  const [dockOffset, setDockOffset] = useState(0);

  useEffect(() => {
    const el = dockRef.current;
    if (!el) return;

    /*
      What the ring needs is the distance from the viewport bottom to the dock's
      top, not the dock's height: the form's bottom padding leaves the dock a
      little above the viewport edge, so height alone would put the ring too low
      and let it graze the dock's border.
    */
    const measure = () => {
      const { top } = el.getBoundingClientRect();
      setDockOffset(Math.max(0, window.innerHeight - top));
    };
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
    /*
      The dock only mounts once the draft has loaded, and this component stays
      mounted through its spinner. Re-running when `loading` clears is what lets
      the first render with a dock find it instead of remembering `null`.
    */
  }, [draft.loading]);

  const site = draft.site;

  /*
    What is still outstanding — and deliberately *not* `findIssues`.

    `findIssues` lists every field on the site that is empty or still holding
    the sample wording: 97 things on the seed site, 84 of which are headings,
    button labels, eyebrow text and other layout copy. None of that is owed. The
    site ships with wording that works, and replacing it is a preference rather
    than a task — so a list that counts it is a list demanding work nobody
    agreed to do.

    This counts exactly what the ring counts: media uploads, and the captions
    and titles that belong to them. `uploadItems` owns that decision, so the
    number in the header and the rows underneath it are the same array and
    cannot disagree.
  */
  const todo = useMemo(
    () => (site ? uploadItems(site).filter((item) => !item.ok) : []),
    [site],
  );

  // Split so the two can be worded differently — an empty field and a field
  // full of the sample wording are different kinds of mistake. A caption still
  // holding the sample text is listed as such rather than as "empty", because
  // it reads as finished and that is exactly why it gets missed.
  const sampleIssues = useMemo(
    () => todo.filter((item) => item.kind === "sample"),
    [todo],
  );
  const missingIssues = useMemo(
    () => todo.filter((item) => item.kind === "missing"),
    [todo],
  );

  /*
    One number, from one function, for the ring.

    This counts uploads and their captions, not every field on the site — so it
    moves when a photograph arrives rather than when a heading is typed. The
    publish dock keeps the full completeness check, because "is this worth
    sharing" is a different question from "how much of it is here".
  */
  const progress = useMemo(() => (site ? uploadProgress(site) : null), [site]);

  // Re-read the publication state whenever the site finishes saving, so the
  // banner flips to Live without a reload.
  useEffect(() => {
    if (draft.saveState.phase !== "saved" && draft.saveState.phase !== "idle") return;
    void getRepository()
      .list()
      .then((list) => {
        setSiteStatus(list.find((s) => s.slug === slug)?.status ?? null);
      })
      .catch(() => setSiteStatus(null));
  }, [draft.saveState.phase, slug]);

  /**
   * Publishes, or takes the site back down.
   *
   * Flushes first, and that ordering is the whole point. `flush` resolves false if
   * anything is still unsaved, and `persist` keeps re-saving until the config on
   * screen is the config on disk — so publishing cannot put an older version live
   * while newer edits sit in a debounce timer. Every save after this one is live
   * too, which is what the banner says out loud.
   */
  const setPublished = async (next: SiteStatus) => {
    if (!(await draft.flush())) return;

    try {
      await getRepository().setStatus(slug, next);
      setSiteStatus(next);
    } catch (cause) {
      setPublishError(
        cause instanceof Error ? cause.message : "Could not change who can see this site.",
      );
    }
  };

  /*
    The shared scroller, bound to no target: which section a click means is
    worked out per click, in `jumpTo`.
  */
  const scrollToSection = useScrollToSection();

  /**
   * Opens the section owning a config path, and glides the form to it.
   *
   * Every pointing button goes through here — each `edit →` in What's Left?,
   * and every row of the outline.
   *
   * Which section owns the path is `sectionIdFor`'s answer rather than a
   * heading's: headings carry counts ("Photographs (4)") and drift the moment
   * the list changes, and matching them is exactly how these buttons came to
   * point at every outstanding thing and quietly take you nowhere.
   *
   * The scroll is the shared hook, which opens the section on the way — so the
   * author lands among the fields rather than on a collapsed summary bar.
   * A path with no section under the selected template (the gallery's chapters
   * while the modern form is up — it has no chapters editor) resolves to
   * nothing and the button does nothing, which is honest: there is nowhere to
   * go.
   */
  const jumpTo = (path: string) => {
    const id = sectionIdFor(path);
    if (!id) return;
    scrollToSection(`#${id}`);
  };

  /**
   * Re-sends the verification email.
   *
   * A soft notice, not a gate: the author can keep working while unverified. The
   * button reports its own failure inline, because a verification email that was
   * never sent is exactly the kind of quiet failure this codebase refuses.
   */
  const resendEmail = async () => {
    setVerificationError(null);
    const result = await resendVerification();
    if (result.ok) setVerificationSent(true);
    else setVerificationError(result.message);
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
        <div className="dash-brand">
          <h1 style={{ margin: 0 }}>
            <Link className="dash-wordmark" to="/profile" title="All sites">
              LoveBuilds<span>.</span>
            </Link>
          </h1>
          <span className="dash-brand-slug">/</span>
          <h1 style={{ margin: 0 }}>
            <Link to="/profile" title="All sites">
              {site.identity.name || slug}
            </Link>
          </h1>
          <span className="dash-brand-slug">/s/{slug}</span>
        </div>

        <span className="dash-spacer" />

        <span className="save-state" title={saveTitle(draft.saveState)}>
          <span className="save-dot" data-phase={draft.saveState.phase} />
          {SAVE_LABEL[draft.saveState.phase] ?? draft.saveState.phase}
        </span>

        {user && !user.emailVerified && user.provider === "password" && (
          <button
            type="button"
            className="btn"
            onClick={() => void resendEmail()}
            disabled={verificationSent}
            title={verificationError ?? "Send a verification link to your email"}
          >
            <Mail size={14} />
            {verificationSent ? "Verification sent" : "Verify email"}
          </button>
        )}

        {verificationError && (
          <span className="field-warn" role="alert">
            {verificationError}
          </span>
        )}

        <Link
          className="btn"
          to={publicUrl(slug)}
          target="_blank"
          rel="noreferrer"
          title="Open the published site in a new tab"
        >
          <Globe size={14} />
          View site
        </Link>

        {/*
          The way back to the shelf. An icon rather than a word, because the
          header is already crowded and this is a place you visit, not an
          action you take on the site you are editing.
        */}
        <Link
          className="btn btn-icon dash-profile-link"
          to="/profile"
          title="Your sites and profile"
          aria-label="Your sites and profile"
        >
          {user?.photoURL ? (
            <img className="dash-avatar" src={user.photoURL} alt="" referrerPolicy="no-referrer" />
          ) : (
            <CircleUserRound size={16} />
          )}
        </Link>

        {user && (
          <span className="dash-user" title={user.email ?? undefined}>
            {user.name}
          </span>
        )}

        {session.status === "signed-in" && session.method === "firebase" && (
          <button type="button" className="btn" onClick={() => void signOut()}>
            Sign out
          </button>
        )}
      </header>

      {/*
        The upload ring, in the bottom-left corner.

        Fixed rather than in the form column, so it is in the same place on
        every screen and never scrolls away. Its height above the viewport
        bottom comes from the measured publish dock, so it always sits just
        above the dock and never on top of it — the dock is sticky at the
        bottom of the form column, which is on the left, so the two share a
        corner.
      */}
      {progress && (
        <div
          className="dash-ring-dock"
          style={{ "--dock-offset": `${dockOffset}px` } as CSSProperties}
        >
          <ProgressRing
            percent={progress.percent}
            done={progress.done}
            total={progress.total}
            complete={progress.complete}
          />
        </div>
      )}

      <div className="dash-body">
        <div className="dash-form">
          {publishError && (
            <p className="notice notice-bad" role="alert">
              {publishError}
            </p>
          )}
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

          {/*
            The upload ring.

            A different number from the one in the publish dock, and it has to
            be: the dock asks "is this complete?" and the ring asks "how much of
            the site's photographs have arrived?". The second is the one worth
            watching while you work, because it moves when you add a picture
            rather than when you type a heading.

            It lives in the corner rather than in the column, because a summary
            in the flow of the form is a thing the author scrolls past. See
            `uploadProgress` in `derive.ts` for exactly what it counts.
          */}

          {/*
            What is outstanding, and a way to jump to each thing.

            The list exists because a count alone never says which field to fix.
            Example text is listed separately from blank fields because they are
            different mistakes: a blank field is obviously blank, and a field
            still holding our sample wording looks finished.

            Scoped to media work on purpose — see `todo` above. Headings and
            button labels are not tasks, so they are not listed as tasks.
          */}
          {todo.length > 0 && (
            <Section
              title="What's Left?"
              hint={`${todo.length} ${todo.length === 1 ? "thing" : "things"}`}
              icon={<FiList />}
            >
              {sampleIssues.length > 0 && (
                <>
                  <p className="field-hint">
                    {sampleIssues.length}{" "}
                    {sampleIssues.length === 1 ? "field still has" : "fields still have"} our
                    example text. They look finished, so they're easy to miss — swap in your own
                    words.
                  </p>
                  <ul className="dash-issues">
                    {sampleIssues.map((issue) => (
                      <li key={issue.path}>
                        <span>{issue.message}</span>
                        {issue.path && (
                          <button
                            type="button"
                            className="go-link"
                            onClick={() => jumpTo(issue.path)}
                          >
                            edit →
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {missingIssues.length > 0 && (
                <>
                  <p className="field-hint">Still to add:</p>
                  <ul className="dash-issues">
                    {missingIssues.map((issue) => (
                      <li key={issue.path}>
                        <span>{issue.message}</span>
                        {issue.path && (
                          <button
                            type="button"
                            className="go-link"
                            onClick={() => jumpTo(issue.path)}
                          >
                            edit →
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Section>
          )}

          {/*
            "The look": everything about layout and photographs, with the
            template first because it decides what the fields below are for —
            they have to be visible before the author scrolls into a long
            form. Colour follows only when that template actually renders
            from the shared presets; editorial and scrapbook bring their own
            palettes, so a picker there would lie.

            `AppearanceEditor` renders one half of the form per pass: the
            structure here, the words in the group below. It still owns the
            conditional template switch, so the fields follow whatever is
            chosen here.
          */}
          <SectionGroup title="The look" hint="Template, photographs and pages">
            <Section
              id={SECTION_ID.template}
              title="Template"
              hint="The layout of the whole site"
              icon={<FiLayout />}
              defaultOpen = {true}
            >
              <TemplatePicker
                value={site.template}
                onChange={(id) => draft.set("template", id)}
                isAvailable={canUseTemplate}
              />
            </Section>

            {templateUsesThemes(site.template) && (
              <Section
                id={SECTION_ID.colours}
                title="Colours"
                hint="Five ready-made palettes"
                icon={<FiDroplet />}
              >
                <ThemePicker value={site.theme} onChange={(id) => draft.set("theme", id)} />
              </Section>
            )}

            <AppearanceEditor draft={draft} part="structure" />
          </SectionGroup>

          {/*
            "Your message": what she actually reads — the name, the headline,
            the letter, the sign-off, in whichever template is selected above.
          */}
          <SectionGroup title="Your message" hint="The name, the message, the sign-off">
            <AppearanceEditor draft={draft} part="words" />
          </SectionGroup>

          {/*
            PublishDock: sticky bottom bar with the readiness sentence and the
            one primary action. It is the only place publishing happens — there
            is no second Publish button in the top bar, because two buttons for
            one irreversible action is how the wrong one gets clicked.
          */}
          <PublishDock
            site={site}
            status={siteStatus}
            slug={slug}
            local={repositoryKind() === "local"}
            dockRef={dockRef}
            onPublish={() => {
              setPublishError(null);
              void setPublished("published");
            }}
            onUnpublish={() => {
              setPublishError(null);
              void setPublished("draft");
            }}
          />
        </div>

        <aside className="dash-side">
          <PreviewPane
            site={site}
            basePath={previewBasePath(previewPage)}
            device={device}
            onDeviceChange={setDevice}
            onEdit={(path, value) => draft.set(path, value)}
            editing={editing}
            onEditingChange={setEditing}
          />

          <div className="segmented">
            <button
              type="button"
              className="btn btn-icon"
              aria-pressed={previewPage === "home"}
              onClick={() => setPreviewPage("home")}
            >
              <FiHome aria-hidden="true" />
              Front page
            </button>
            <button
              type="button"
              className="btn btn-icon"
              aria-pressed={previewPage === "gallery"}
              onClick={() => setPreviewPage("gallery")}
            >
              <FiImage aria-hidden="true" />
              Gallery
            </button>
          </div>

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
