import { siteOutline, visibleBlocks } from "../../lib/site/derive";
import type { Site } from "../../lib/site/schema";

/**
 * What will actually appear.
 *
 * The reason this exists: an author who skips the quote letter should not
 * discover at the end that there is an empty panel on the site. Greyed rows are
 * sections that will be hidden, and clicking one jumps the form to it.
 */
export default function OutlinePanel({
  site,
  onJump,
}: {
  site: Site;
  onJump: (path: string) => void;
}) {
  const entries = siteOutline(site);
  const blocks = visibleBlocks(site);

  const live = entries.filter((e) => e.shown).length;
  const total = entries.length;

  // Chapters that exist but hold nothing are the one case worth counting
  // separately: they are not "hidden", they are unfinished.
  const unfinishedChapters = site.gallery.chapters.filter(
    (c) => c.films.length === 0 && c.stills.length === 0,
  ).length;

  return (
    <div className="outline">
      <div className="outline-head">
        On the site right now
        <span className="field-count">
          {live}/{total} sections
        </span>
      </div>

      {unfinishedChapters > 0 && (
        <div style={{ padding: "0.6rem 0.8rem 0" }}>
          <p className="field-warn">
            {unfinishedChapters === 1 ? "1 chapter has" : `${unfinishedChapters} chapters have`}{" "}
            no videos or photos, so {unfinishedChapters === 1 ? "it is" : "they are"} skipped
            entirely.
          </p>
        </div>
      )}

      <div className="outline-list">
        {entries.map((entry, i) => (
          <button
            key={entry.path ?? `row-${i}`}
            type="button"
            className="outline-row"
            data-shown={String(entry.shown)}
            disabled={!entry.path}
            onClick={() => entry.path && onJump(entry.path)}
            title={entry.detail ?? (entry.shown ? "Will appear on the site" : "Will be hidden")}
          >
            <span className="outline-dot" />
            <span>{entry.label}</span>
            {entry.detail && <span className="outline-detail">{entry.detail}</span>}
            {entry.advanced && <span className="outline-badge">advanced</span>}
          </button>
        ))}
      </div>

      {blocks.quote && !blocks.quoteTruth && (
        <div style={{ padding: "0.6rem 0.8rem" }}>
          <p className="field-hint">
            The quote shows but the reveal button is hidden, because the letter behind it is
            empty.
          </p>
        </div>
      )}
    </div>
  );
}