import { useMemo, useState } from "react";

import type { Site } from "../../../lib/site/schema";

import {
  SCRAPBOOK_BASE_CSS,
  SCRAPBOOK_FONT_IMPORT,
  ScrapbookFooter,
  ScrapbookTopBar,
  Tape,
} from "./shared";
import { scrapbookPaths } from "./paths";
import { scrapbookMemories } from "../../../lib/site/derive";

/**
 * The scrapbook template's cover.
 *
 * Built around paper rather than screen: photographs sit at odd angles because
 * they were stuck down by hand, captions are written on the white border, and
 * the page is a stack of overlapping things rather than a grid.
 *
 * Nothing here animates on scroll. A scrapbook does not move when you look at
 * it — the pieces are already where someone left them, and animating them in
 * would underline the conceit.
 *
 * The album below is a preview; the gallery holds every photo with its note.
 */
export default function ScrapbookHomePage({ site, basePath }: { site: Site; basePath: string }) {
  const [openNote, setOpenNote] = useState<number | null>(null);
  const paths = useMemo(() => scrapbookPaths(basePath), [basePath]);

  /**
   * The author's own photographs, from `home.moments` — not a fixed set.
   *
   * Keyed on `site` rather than `[]`: a photo uploaded while this page is open
   * has to appear, and the cover cluster has to re-render around it.
   */
  const memories = useMemo(() => scrapbookMemories(site), [site]);

  /** The four photos shown on the cover. */
  const cover = useMemo(() => memories.slice(0, 4), [memories]);

  return (
    <div className="sb-shell">
      <div className="sb-fibre" aria-hidden="true" />
      <div className="sb-vignette" aria-hidden="true" />

      <ScrapbookTopBar active="home" paths={paths} />

      <main>
        <section className="sb-cover">
          <div className="sb-cover-head">
            <p className="sb-type-small">collected for you · since forever</p>
            <h1 className="sb-hand-h1 text-slate-500">
              things I meant
              <br />
              to keep
            </h1>
            <span className="sb-stamp sb-stamp-cover">keep this one</span>
          </div>

          {/*
            The cover cluster. Positioned rather than laid out, because a
            scrapbook page is a composition — each photo is placed relative to
            the others, and a grid would undo the whole thing.
          */}
          <div className="sb-cluster">
            {cover.map((memory, i) => (
              <figure
                key={memory.caption}
                className={`sb-polaroid sb-pos-${i + 1}`}
                style={{ ["--tilt" as string]: `${memory.tilt}deg` }}
              >
                <Tape where={memory.tape} />
                <span className="sb-brad sb-brad-tl" aria-hidden="true" />
                <img src={memory.image} alt={memory.caption} />
                <figcaption>{memory.caption}</figcaption>
              </figure>
            ))}
          </div>

          <p className="sb-cover-note sb-hand">
            {memories.length} of them, in total.
            <br />
            <a href={paths.gallery}>Turn the page →</a>
          </p>
        </section>

        {/* A letter, tucked under the photos. */}
        <section className="sb-letter">
          <div className="sb-note">
            <span className="sb-brad sb-brad-tl" aria-hidden="true" />
            <span className="sb-brad sb-brad-br" aria-hidden="true" />
            <p className="sb-type-small">a note, tucked in here</p>
            <p className="sb-letter-body sb-hand">
              I did not write you a card. I am not good at the part where you
              say the right thing on the right day. So I made you a book
              instead, and filled it with the parts I actually remember — which
              is mostly you, not being careful.
            </p>
            <p className="sb-letter-sign sb-hand">— me, again</p>
          </div>
        </section>

        <section id="album" className="sb-album">
          <div className="sb-album-head">
            <h2 className="sb-hand-h2 sb-hand">
              the ones that stayed
            </h2>
            <p className="sb-type-small">tap one to read what happened</p>
          </div>

          <div className="sb-strip">
            {memories.map((memory, i) => (
              <button
                key={i}
                type="button"
                className={`sb-chip ${openNote === i ? "is-open" : ""}`}
                style={{ ["--tilt" as string]: `${memory.tilt}deg` }}
                aria-expanded={openNote === i}
                onClick={() => setOpenNote(openNote === i ? null : i)}
              >
                <img src={memory.image} alt="" aria-hidden="true" />
                <span className="sb-chip-hand sb-hand">{memory.caption}</span>
              </button>
            ))}
          </div>

          {/*
            Guarded on `memories[openNote]` as well as on `openNote` being set:
            `openNote` is an index, and moments can be deleted while this page is
            open. Without the second test, removing the photo the reader had open
            left the panel dereferencing a position that no longer exists.
          */}
          {openNote !== null && memories[openNote] && (
            <div className="sb-read" aria-live="polite">
              <p className="sb-type-small">{memories[openNote].date}</p>
              <p className="sb-read-note sb-hand">{memories[openNote].note}</p>
              <button
                type="button"
                className="sb-read-close"
                onClick={() => setOpenNote(null)}
              >
                put it back
              </button>
            </div>
          )}

          <div className="sb-album-cta">
            <a className="sb-btn" href={paths.gallery}>
              open the whole album
            </a>
          </div>
        </section>
      </main>

      <ScrapbookFooter paths={paths} />

      <style>{`
                ${SCRAPBOOK_FONT_IMPORT}
                ${SCRAPBOOK_BASE_CSS}

                /* ---------- cover ---------- */
                .sb-cover {
                  max-width:1180px; margin:0 auto; padding:6vh 6vw 14vh;
                  display:grid; grid-template-columns:1fr 1.15fr;
                  gap:clamp(28px,5vw,72px); align-items:center;
                  min-height:86svh;
                }
                .sb-cover-head { position:relative; }
                .sb-cover-head .sb-type-small { margin:0 0 26px; }
                .sb-stamp-cover { margin-top:34px; }

                /*
                  Overlap is the point. Negative margins pull each photograph
                  over the one before it, and the z-index is set explicitly —
                  later siblings otherwise win on paint order alone, which makes
                  the layering depend on array order rather than on intent.
                */
                .sb-cluster { position:relative; min-height:min(78svh,600px); }
                .sb-polaroid {
                  position:absolute; margin:0; width:min(58%,270px);
                  padding:11px 11px 0; background:#fdfaf3;
                  box-shadow:0 12px 26px -14px rgba(74,58,34,.6), 0 2px 5px rgba(74,58,34,.14);
                  transform:rotate(var(--tilt));
                  border:1px solid rgba(180,164,136,.5);
                }
                .sb-polaroid img { display:block; width:100%; height:auto; }
                .sb-polaroid figcaption {
                  font-family:'Caveat',cursive; font-size:22px; line-height:1.25;
                  color:var(--ink); padding:9px 2px 13px; text-align:center;
                }
                .sb-pos-1 { top:2%;  left:2%;  z-index:3; }
                .sb-pos-2 { top:26%; left:34%; z-index:4; }
                .sb-pos-3 { top:52%; left:8%;  z-index:5; }
                .sb-pos-4 { top:70%; left:40%; z-index:2; }

                .sb-cover-note {
                  grid-column:1; margin:0; font-size:clamp(23px,2.4vw,30px);
                  line-height:1.35; color:var(--ink-soft);
                }
                .sb-cover-note a {
                  color:var(--red); border-bottom:1px solid var(--red);
                  padding-bottom:1px; transition:.2s;
                }
                .sb-cover-note a:hover { color:var(--ink); border-bottom-color:var(--ink); }

                /* ---------- the letter ---------- */
                .sb-letter { max-width:1180px; margin:0 auto; padding:0 6vw 12vh; }
                .sb-note {
                  position:relative; max-width:640px; margin-left:auto;
                  padding:clamp(30px,5vw,54px) clamp(28px,5vw,52px);
                  background:var(--paper-deep);
                  box-shadow:0 16px 34px -18px rgba(74,58,34,.55);
                  transform:rotate(-1.1deg);
                }
                .sb-note .sb-type-small { margin:0 0 18px; }
                .sb-letter-body { font-size:clamp(25px,2.7vw,34px); line-height:1.42; margin:0; }
                .sb-letter-sign { margin:22px 0 0; font-size:clamp(21px,2vw,26px); color:var(--ink-soft); }

                /* ---------- album ---------- */
                .sb-album { max-width:1180px; margin:0 auto; padding:0 6vw 16vh; }
                .sb-album-head { display:flex; align-items:baseline; justify-content:space-between; gap:20px; flex-wrap:wrap; margin-bottom:44px; }
                .sb-hand-h2 { font-size:clamp(42px,7vw,86px); margin:0; line-height:.95; }

                /*
                  The strip is a flex row of rotated chips, each nudged with a
                  margin so they overlap slightly — the same reason the cover
                  cluster overlaps, and for the same reason it has to be
                  deliberate rather than left to the browser.
                */
                .sb-strip {
                  display:flex; flex-wrap:wrap; gap:0;
                  align-items:flex-start; justify-content:center;
                }
                .sb-chip {
                  position:relative; margin:0 -14px; padding:9px 9px 6px;
                  background:#fdfaf3; border:1px solid rgba(180,164,136,.5);
                  box-shadow:0 10px 20px -13px rgba(74,58,34,.55);
                  transform:rotate(var(--tilt));
                  cursor:pointer; font:inherit;
                  transition:transform .25s ease, box-shadow .25s ease, z-index 0s;
                }
                .sb-chip:hover, .sb-chip:focus-visible {
                  transform:rotate(0deg) translateY(-8px);
                  box-shadow:0 20px 34px -16px rgba(74,58,34,.6);
                  /* Lifted above its neighbours on hover, or it disappears
                     behind the chips that overlap it. */
                  z-index:20;
                }
                .sb-chip.is-open { transform:rotate(0deg) translateY(-10px); z-index:20; }
                .sb-chip img {
                  display:block; width:clamp(96px,15vw,150px); height:auto;
                  filter:grayscale(.18);
                }
                .sb-chip-hand { display:block; font-size:19px; color:var(--ink); padding:6px 2px 2px; }

                .sb-read {
                  max-width:600px; margin:44px auto 0; padding:30px 34px;
                  background:var(--paper-deep); text-align:center;
                  box-shadow:0 14px 28px -16px rgba(74,58,34,.5);
                  transform:rotate(.6deg);
                }
                .sb-read .sb-type-small { margin:0 0 14px; }
                .sb-read-note { font-size:clamp(24px,2.6vw,32px); line-height:1.4; margin:0 0 20px; }
                .sb-read-close {
                  background:none; border:1px solid var(--ink-soft); cursor:pointer;
                  padding:8px 16px; font-family:'Special Elite',monospace; font-size:12px;
                  letter-spacing:.08em; text-transform:uppercase; transition:.2s;
                }
                .sb-read-close:hover { background:var(--ink); color:var(--paper); }

                .sb-album-cta { display:flex; justify-content:center; margin-top:60px; }
                .sb-btn {
                  display:inline-block; padding:15px 30px;
                  background:var(--ink); color:var(--paper);
                  font-family:'Special Elite',monospace; font-size:13px;
                  letter-spacing:.1em; text-transform:uppercase;
                  box-shadow:4px 5px 0 var(--paper-shadow);
                  transition:transform .15s ease, box-shadow .15s ease;
                }
                .sb-btn:hover { transform:translate(2px,3px); box-shadow:2px 2px 0 var(--paper-shadow); }

                @media (max-width:900px) {
                  .sb-cover { grid-template-columns:1fr; min-height:auto; padding-top:4vh; }
                  .sb-cluster { min-height:min(70svh,520px); margin-top:34px; }
                  .sb-note { margin-left:0; }
                  .sb-chip { margin:0 -8px; }
                }
              `}</style>
    </div>
  );
}