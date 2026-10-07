import { useState } from "react";

import { publicUrl } from "../../lib/site/slug";
import type { SiteStatus } from "../../lib/site/schema";

/**
 * Says out loud whether anyone can see this yet, and offers the one action that
 * changes the answer.
 *
 * Publishing used to be a manual `update sites set status = 'published'` in a SQL
 * editor, or on local storage a flag nobody could reach from the app. That was
 * honest about how little was built, and unusable in practice: someone could save
 * everything, share the link, and have nobody see it, with nothing in the product
 * acknowledging the gap.
 *
 * The confirm step is not decoration. Publishing is the point at which a private
 * draft becomes something anyone with the link can read and you cannot un-edit,
 * and the real trade of having no review gate is that *every later save goes live
 * too*. That is worth saying in the product rather than only in the README.
 */
export default function StatusBanner({
  status,
  slug,
  local,
  missingCount,
  onPublish,
  onUnpublish,
}: {
  status: SiteStatus | null;
  slug: string;
  /**
   * True while running on local storage.
   *
   * It does not block publishing here — a local site can be published and shared
   * to whoever has this browser, which is useful for checking a real link before
   * a backend exists. It does mean the wording cannot promise the link reaches
   * anyone else, so this stays a warning rather than becoming the "not published"
   * notice it is on a hosted backend.
   */
  local: boolean;
  /** Fields `findIssues` still reports. Only used to phrase the confirmation. */
  missingCount: number;
  onPublish: () => void;
  onUnpublish: () => void;
}) {
  // Two-step rather than window.confirm: a native dialog cannot be styled and
  // reads as a browser error rather than as a decision this app is asking for.
  //
  // `confirming` is keyed by the status it was opened against, rather than being
  // a bare boolean that an effect resets when `status` changes. The question being
  // asked — "publish this draft?" — stops being true the moment it is no longer a
  // draft, so deriving that here means a save landing mid-decision collapses the
  // prompt with no extra render and no chance of the two disagreeing.
  const [confirmingAt, setConfirmingAt] = useState<SiteStatus | null>(null);
  const confirming = confirmingAt !== null && confirmingAt === status;

  if (status === "published") {
    return (
      <div className="notice notice-live">
        <p style={{ margin: 0 }}>
          <strong>Live.</strong> Anyone with this link can see it:{" "}
          <a href={publicUrl(slug)} target="_blank" rel="noreferrer" className="notice-link">
            {publicUrl(slug)}
          </a>
        </p>
        <p style={{ margin: "0.35rem 0 0", opacity: 0.85 }}>
          Every save from now on goes live immediately. Unpublish to hide it again while you
          work.
        </p>
        {local && (
          <p style={{ margin: "0.35rem 0 0", opacity: 0.85 }}>
            Stored in this browser only, so the link works on this machine and nowhere else yet.
          </p>
        )}
        <div className="btn-row" style={{ marginTop: "0.5rem" }}>
          <button type="button" className="btn" onClick={onUnpublish}>
            Unpublish
          </button>
        </div>
      </div>
    );
  }

  if (status === null) {
    // No row for this slug in the owner's list. Usually a first save that has not
    // landed yet, so it is not worth alarming anyone about.
    return null;
  }

  if (confirming) {
    return (
      <div className="notice notice-warn">
        <p style={{ margin: 0 }}>
          <strong>Publish this site?</strong>{" "}
          {missingCount > 0 ? (
            <>
              {missingCount} {missingCount === 1 ? "thing is" : "things are"} still missing or
              placeholder, so whoever opens it will see them.
            </>
          ) : (
            <>The link will work for anyone who has it.</>
          )}
        </p>
        <div className="btn-row" style={{ marginTop: "0.5rem" }}>
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
        </div>
      </div>
    );
  }

  return (
    <div className="notice notice-warn">
      <p style={{ margin: 0 }}>
        <strong>Nobody can see this yet.</strong> It is saved, but it is not published — the
        link stays blank for everyone but you until it is.
      </p>
      <div className="btn-row" style={{ marginTop: "0.5rem" }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setConfirmingAt(status)}
        >
          Publish site
        </button>
      </div>
    </div>
  );
}