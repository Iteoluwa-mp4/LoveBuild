import { useMemo, useState } from "react";

import type { Site } from "../../../lib/site/schema";

import Flipbook, { FLIPBOOK_CSS } from "./Flipbook";
import {
  MEMORIES,
  SCRAPBOOK_BASE_CSS,
  SCRAPBOOK_FONT_IMPORT,
  ScrapbookFooter,
  ScrapbookTopBar,
  Tape,
} from "./shared";
import { scrapbookPaths } from "./paths";

/**
 * The scrapbook template's album.
 *
 * A flipbook. The photographs are the same objects the cover scatters, but a
 * scrapbook you scroll is a scrapbook you have already decided the order of —
 * so the album is something you turn through: a cover, a fold, pages that swing.
 *
 * The detail panel stays *below* the book rather than replacing it. Lifting a
 * photograph off the page was the earlier approach and it fought the turn: both
 * wanted to own the same gesture.
 */
export default function ScrapbookGalleryPage({ site: _site, basePath }: { site: Site; basePath: string }) {
  const paths = useMemo(() => scrapbookPaths(basePath), [basePath]);
  const [shown, setShown] = useState<(typeof MEMORIES)[number] | null>(null);

  return (
    <div className="sb-shell">
      <div className="sb-fibre" aria-hidden="true" />
      <div className="sb-vignette" aria-hidden="true" />

      <ScrapbookTopBar active="gallery" paths={paths} />

      <main>
        <section className="sg-head">
          <p className="sb-type-small">
            page two · {MEMORIES.length} photographs
          </p>
          <h1 className="sb-hand-h1">the whole album</h1>
          <p className="sg-intro sb-hand">
            Turn the pages, or drag a corner across. Every one is with what
            actually happened.
          </p>
        </section>

        <section className="sg-book">
          <Flipbook memories={MEMORIES} onPick={setShown} />
        </section>

        {/* The selected photograph, outside the book so a turn never competes
            with a panel opening underneath it. */}
        {shown && (
          <section className="sg-detail" aria-live="polite">
            <button
              type="button"
              className="sg-detail-close"
              onClick={() => setShown(null)}
            >
              put it back
            </button>
            <div className="sg-detail-inner">
              <figure className="sg-detail-figure">
                <Tape where={shown.tape} />
                <img src={shown.image} alt={shown.caption} />
                <figcaption className="sb-hand">{shown.caption}</figcaption>
              </figure>
              <div className="sg-detail-copy">
                <p className="sb-type-small">{shown.date}</p>
                <p className="sg-detail-note sb-hand">{shown.note}</p>
                <button
                  type="button"
                  className="sg-detail-open"
                  onClick={() => setShown(null)}
                >
                  back to the book
                </button>
              </div>
            </div>
          </section>
        )}

        <section className="sg-tail">
          <p className="sb-hand sg-tail-line">
            That is the whole of it.
            <br />
            Nothing is on a timer, and nothing is locked.
          </p>
          <a className="sb-btn" href={paths.home}>
            back to the cover
          </a>
        </section>
      </main>

      <ScrapbookFooter paths={paths} />

      <style>{`
                ${SCRAPBOOK_FONT_IMPORT}
                ${SCRAPBOOK_BASE_CSS}
                ${FLIPBOOK_CSS}

                .sg-head { max-width:1180px; margin:0 auto; padding:4vh 6vw 4vh; text-align:center; }
                .sg-head .sb-type-small { margin:0 0 24px; }
                .sg-intro { margin:26px auto 0; font-size:clamp(22px,2.5vw,29px); color:var(--ink-soft); }

                .sg-book { padding:2vh 0 12vh; display:flex; justify-content:center; }

                .sg-detail { max-width:820px; margin:0 auto; padding:0 6vw 12vh; }
                .sg-detail-inner {
                  display:grid; gap:clamp(22px,4vw,48px); align-items:center;
                  grid-template-columns:1fr;
                  animation:sgRise .4s ease-out;
                }
                .sg-detail-figure {
                  position:relative; margin:0; padding:12px 12px 0; background:#fdfaf3;
                  border:1px solid rgba(180,164,136,.5);
                  box-shadow:0 16px 30px -16px rgba(74,58,34,.55);
                }
                .sg-detail-figure img { display:block; width:100%; aspect-ratio:1; object-fit:cover; }
                .sg-detail-figure figcaption { padding:9px 2px 12px; text-align:center; font-size:clamp(20px,2.4vw,26px); }
                .sg-detail-note { margin:14px 0 24px; font-size:clamp(22px,2.6vw,30px); line-height:1.38; }
                .sg-detail-open, .sg-detail-close {
                  border:1px solid var(--ink-soft); background:var(--paper-deep); cursor:pointer;
                  padding:11px 18px; font-family:'Special Elite',monospace; font-size:11px;
                  letter-spacing:.1em; text-transform:uppercase; transition:.2s;
                }
                .sg-detail-open:hover, .sg-detail-close:hover { background:var(--ink); color:var(--paper); }
                .sg-detail-close { display:block; margin:0 0 22px auto; }

                @keyframes sgRise { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:none; } }

                .sg-tail {
                  max-width:1180px; margin:0 auto; padding:0 6vw 16vh;
                  display:flex; align-items:center; justify-content:space-between;
                  gap:32px; flex-wrap:wrap;
                }
                .sg-tail-line { margin:0; font-size:clamp(25px,2.7vw,34px); line-height:1.32; color:var(--ink-soft); }

                @media (min-width:760px) {
                  .sg-detail-inner { grid-template-columns:1fr 1fr; }
                }
                @media (max-width:820px) {
                  .sg-tail { flex-direction:column; align-items:flex-start; }
                }
              `}</style>
    </div>
  );
}