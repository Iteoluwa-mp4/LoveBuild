import { useMemo, useState } from "react";

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
 * The same objects as the cover, given room. Where the cover overlaps four
 * photographs into one composition, this lays them out as a page of a book —
 * still tilted, still taped, but each with enough space to be read.
 *
 * Selecting a photograph lifts it out of the page rather than opening a modal.
 * A modal is the wrong idea for a scrapbook: it stops being an object on a
 * surface and becomes an interface, which is the opposite of what this template
 * is for.
 */
export default function ScrapbookGalleryPage() {
  const [open, setOpen] = useState<number | null>(null);
  const paths = useMemo(() => scrapbookPaths(), []);

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
            Every one of them, with what actually happened. Lift one to read it.
          </p>
        </section>

        {/*
          A two-column page rather than a grid, because the photographs are
          deliberately different sizes — the layout should look hand-placed,
          so the rows are driven by the content and the leftover space is
          allowed to stay empty.
        */}
        <section className="sg-page">
          {MEMORIES.map((memory, i) => (
            <article
              key={memory.caption}
              className={`sg-slot ${open === i ? "is-open" : ""}`}
              style={{ ["--tilt" as string]: `${memory.tilt}deg` }}
            >
              <button
                type="button"
                className="sg-polaroid"
                aria-expanded={open === i}
                onClick={() => setOpen(open === i ? null : i)}
              >
                <Tape where={memory.tape} />
                <span className="sb-brad sb-brad-tl" aria-hidden="true" />
                <img src={memory.image} alt={memory.caption} />
                <figcaption>
                  <span className="sg-date">{memory.date}</span>
                  <span className="sg-caption sb-hand">{memory.caption}</span>
                </figcaption>
              </button>

              {/* Always in the DOM, so the row does not reflow when it opens. */}
              <div className="sg-note" aria-hidden={open !== i}>
                <p className="sg-note-body sb-hand">{memory.note}</p>
                <button
                  type="button"
                  className="sg-put-back"
                  onClick={() => setOpen(null)}
                >
                  tuck it back in
                </button>
              </div>
            </article>
          ))}
        </section>

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

                .sg-head { max-width:1180px; margin:0 auto; padding:4vh 6vw 8vh; }
                .sg-head .sb-type-small { margin:0 0 24px; }
                .sg-intro { margin:30px 0 0; font-size:clamp(23px,2.5vw,31px); color:var(--ink-soft); }

                .sg-page {
                  max-width:1180px; margin:0 auto; padding:0 6vw 14vh;
                  display:grid; gap:clamp(34px,5vw,60px) clamp(30px,5vw,80px);
                  grid-template-columns:repeat(2,1fr);
                  align-items:start;
                }
                /*
                  Alternating column and lean, so the page reads as hand-placed
                  rather than as two tidy stacks. The nth-of-type rules are
                  scoped to the slot so they cannot leak into the strip on the
                  cover, which reuses the same children.
                */
                .sg-slot:nth-child(2n) { transform:translateY(46px); }

                .sg-polaroid {
                  position:relative; display:block; width:100%; margin:0; padding:13px 13px 0;
                  background:#fdfaf3; cursor:pointer; font:inherit;
                  border:1px solid rgba(180,164,136,.5);
                  box-shadow:0 14px 28px -16px rgba(74,58,34,.6), 0 2px 5px rgba(74,58,34,.14);
                  transform:rotate(var(--tilt));
                  transition:transform .25s ease, box-shadow .25s ease;
                }
                .sg-polaroid:hover, .sg-polaroid:focus-visible {
                  transform:rotate(-1deg) translateY(-6px);
                  box-shadow:0 24px 40px -18px rgba(74,58,34,.62), 0 2px 5px rgba(74,58,34,.14);
                }
                .sg-polaroid img {
                  display:block; width:100%; height:auto; aspect-ratio:1;
                  object-fit:cover; filter:grayscale(.15);
                }
                .sg-polaroid figcaption {
                  display:flex; flex-direction:column; align-items:center; gap:2px;
                  padding:12px 4px 15px;
                }
                .sg-date { font-family:'Special Elite',monospace; font-size:11px; letter-spacing:.12em; color:var(--ink-faint); }
                .sg-caption { font-size:clamp(22px,2.3vw,29px); color:var(--ink); }

                /* Lifted off the page when open, and pulled forward so it clears
                   the photograph above it in the staggered column. */
                .sg-slot.is-open { z-index:30; transform:translateY(30px); }
                .sg-slot.is-open .sg-polaroid {
                  transform:rotate(-.5deg) translateY(-8px);
                  box-shadow:0 30px 52px -20px rgba(74,58,34,.66), 0 2px 5px rgba(74,58,34,.14);
                }

                /*
                  Collapsed by height rather than unmounted. The note is always
                  rendered so opening one photograph cannot make the page jump,
                  which is what an unmounted panel would do to a layout that
                  depends on rotation.
                */
                .sg-note {
                  display:grid; grid-template-rows:0fr;
                  transition:grid-template-rows .3s ease;
                  margin-top:0;
                }
                .sg-note > * { overflow:hidden; }
                .sg-slot.is-open .sg-note { grid-template-rows:1fr; margin-top:16px; }
                .sg-note-body {
                  margin:0; padding:20px 22px 6px; font-size:clamp(22px,2.2vw,28px);
                  line-height:1.38; text-align:center;
                  background:var(--paper-deep);
                  box-shadow:0 10px 22px -14px rgba(74,58,34,.5);
                }
                .sg-put-back {
                  display:block; width:100%; background:var(--paper-deep);
                  border:0; border-top:1px dashed var(--line); cursor:pointer;
                  padding:12px; font-family:'Special Elite',monospace; font-size:11px;
                  letter-spacing:.1em; text-transform:uppercase; color:var(--ink-soft);
                  transition:.2s;
                }
                .sg-put-back:hover { background:var(--ink); color:var(--paper); }

                .sg-tail {
                  max-width:1180px; margin:0 auto; padding:0 6vw 16vh;
                  display:flex; align-items:center; justify-content:space-between;
                  gap:32px; flex-wrap:wrap;
                }
                .sg-tail-line { margin:0; font-size:clamp(25px,2.7vw,34px); line-height:1.32; color:var(--ink-soft); }

                @media (max-width:820px) {
                  .sg-page { grid-template-columns:1fr; }
                  .sg-slot:nth-child(2n) { transform:none; }
                  .sg-tail { flex-direction:column; align-items:flex-start; }
                }
              `}</style>
    </div>
  );
}