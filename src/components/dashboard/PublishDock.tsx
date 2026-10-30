import { useState, type Ref } from "react";
import { Link } from "react-router-dom";

import { publicUrl } from "../../lib/site/slug";
import type { SiteStatus } from "../../lib/site/schema";
import { readiness } from "../../lib/site/derive";

/**
 * The publish dock: the one place the primary action lives.
 *
 * Sticks to the bottom of the form column, so it is on screen whether the
 * author is at the top of the form or two hundred fields down. That is the
 * whole reason it is a dock and not a section: the action used to live in a
 * banner at the top of a long scroll, which meant the people most likely to
 * need it were the least likely to see it.
 *
 * Three states, and exactly one primary button in each:
 *
 *   - Draft → "Publish site", with a two-step confirm.
 *   - Confirming → "Yes, publish it" / "Not yet".
 *   - Published → "Copy link", because once it is live the useful thing is the
 *     link, not another publish button.
 *
 * It does not say how far along the site is. It used to — "3 things left" —
 * and that was a second progress readout sitting a few centimetres from the
 * upload ring, which made the dashboard answer the same question twice in two
 * different units. The ring is the one that measures progress; this says
 * whether the site is published, and the outstanding items are listed in the
 * form with a link to each one.
 *
 * The confirm step is not decoration. Publishing turns a private draft into
 * something anyone with the link can read, and it cannot be un-edited — and
 * because there is no review gate, *every later save goes live too*. Worth
 * saying in the product rather than only in the README.
 */
export default function PublishDock({
  site,
  status,
  slug,
  local,
  onPublish,
  onUnpublish,
  dockRef,
}: {
  site: import("../../lib/site/schema").Site;
  status: SiteStatus | null;
  slug: string;
  /**
   * True while running on local storage.
   *
   * It does not block publishing here — a local site can be published and shared
   * to whoever has this browser, which is useful for checking a real link before
   * a backend exists. It does mean the wording cannot promise the link reaches
   * anyone else, so this stays a warning rather than becoming the "not
   * published" notice it is on a hosted backend.
   */
  local: boolean;
  onPublish: () => void;
  onUnpublish: () => void;
  /**
   * The dock's own element, so the dashboard can measure it.
   *
   * The upload ring sits directly above this, and the dock changes height with
   * its state — the confirm step adds a line, and the published state adds a
   * link. A hard-coded offset for the ring would be wrong for two of the three
   * states, so the ring is positioned from the measured height instead.
   */
  dockRef?: Ref<HTMLDivElement> | undefined;
}) {
  // Two-step rather than window.confirm: a native dialog cannot be styled and
  // reads as a browser error rather than as a decision this app is asking for.
  //
  // `confirmingAt` is keyed by the status it was opened against, rather than being
  // a bare boolean that an effect resets when `status` changes. The question being
  // asked — "publish this draft?" — stops being true the moment it is no longer a
  // draft, so deriving that here means a save landing mid-decision collapses the
  // prompt with no extra render and no chance of the two disagreeing.
  const [confirmingAt, setConfirmingAt] = useState<SiteStatus | null>(null);
  const [copied, setCopied] = useState(false);

  const confirming = confirmingAt !== null && confirmingAt === status;
  const state = readiness(site);
  const published = status === "published";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl(slug));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (no permission, or not a secure context). The link is
      // on screen and selectable, so there is still a way to copy it by hand.
    }
  };

  return (
    <div className="publish-dock" ref={dockRef}>
      <div className="publish-dock-info">
        {published ? (
          <>
            <p className="publish-dock-title">
              Live —{" "}
              <Link
                to={publicUrl(slug)}
                target="_blank"
                rel="noreferrer"
                className="publish-dock-link"
              >
                /s/{slug}
              </Link>
            </p>
            <p className="publish-dock-meta">
              Every save from now on goes live immediately.
              {local && " Stored in this browser only, so the link works here and nowhere else yet."}
            </p>
          </>
        ) : confirming ? (
          <>
            <p className="publish-dock-title">Publish this site?</p>
            <p className="publish-dock-meta">
              {state.missing > 0 ? (
                <>
                  Some things are still missing or placeholder, so whoever opens it will see
                  them.
                </>
              ) : (
                <>The link will work for anyone who has it.</>
              )}
            </p>
          </>
        ) : (
          <>
            <p className="publish-dock-title">Not published yet</p>
            <p className="publish-dock-meta">
              Publishing makes the link work for anyone who has it.
            </p>
          </>
        )}
      </div>

      <div className="publish-dock-actions">
        {published ? (
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void copyLink()}
              title="Copy the link to this site"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
            <button type="button" className="btn btn-danger" onClick={onUnpublish}>
              Unpublish
            </button>
          </>
        ) : confirming ? (
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setConfirmingAt(null);
                onPublish();
              }}
            >
              Yes, publish it
            </button>
            <button type="button" className="btn" onClick={() => setConfirmingAt(null)}>
              Not yet
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setConfirmingAt(status ?? "draft")}
          >
            Publish site
          </button>
        )}
      </div>
    </div>
  );
}
