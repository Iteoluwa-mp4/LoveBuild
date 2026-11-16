import { Fragment, useMemo, useRef, useState } from "react";

import type { Site } from "../../../lib/site/schema";

import {
  SCRAPBOOK_BASE_CSS,
  SCRAPBOOK_FONT_IMPORT,
  ScrapbookFooter,
  ScrapbookTopBar,
  Tape,
} from "./shared";
import { scrapbookPaths } from "./paths";
import { scrapbookMemories, visibleBlocks } from "../../../lib/site/derive";
import { useScrollToReveal } from "../../../hooks/useScrollToReveal";

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
  const readRef = useRef<HTMLDivElement>(null);

  /*
    The note mounts under the strip of chips, which is usually near the bottom
    of what the reader can see. The trigger is the index itself, not a boolean:
    `0` is the first chip and must count as open, and moving from one note to
    the next changes it again — the panel is the same element, but the reader
    asked twice and should be taken to it twice.
  */
  useScrollToReveal(openNote, readRef);

  /*
    The second cover button's destination, derived the way the schema promises:
    it jumps to the moments, which on this page are the album. Keyed on a
    counter rather than a boolean so every press scrolls again — a reader who
    has already been down there and presses it a second time means it.
  */
  const albumRef = useRef<HTMLElement>(null);
  const [keepScrolling, setKeepScrolling] = useState<number | null>(null);
  useScrollToReveal(keepScrolling, albumRef);

  /*
    The longer letter behind the quote's button. A boolean, so there is no
    "0 counts as open" subtlety here: the scroll runs when it flips to true —
    the letter mounts under the button, usually below the fold — and closing
    it is a collapse rather than a destination, so closing scrolls nowhere.
  */
  const [letterOpen, setLetterOpen] = useState(false);
  const letterRef = useRef<HTMLDivElement>(null);
  useScrollToReveal(letterOpen, letterRef);

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

  /**
   * The cover headline, from `home.hero.lines` — the same three fields as the
   * "First impression" section of the form.
   *
   * This was hardcoded as "things I meant / to keep", which meant the section
   * titled "First impression" edited three lines that appeared nowhere on the
   * page while the page's own heading could not be edited at all. One source,
   * so what the form says is what the cover says.
   *
   * Blank lines are dropped rather than rendered as empty ones — the same
   * "leave blank for a shorter headline" rule the other templates follow — and
   * an entirely empty section falls back to the original words, so clearing the
   * field degrades to the heading this template shipped with instead of an
   * empty cover.
   */
  const headline = useMemo(() => {
    const lines = site.home.hero.lines.map((line) => line.trim()).filter(Boolean);
    return lines.length > 0 ? lines : ["things I meant", "to keep"];
  }, [site.home.hero.lines]);

  /*
    The rest of "First impression": the line under the headline and the two
    button labels. Trimmed once, here, so a stray space cannot render an empty
    paragraph or an empty button — blank means the field was never filled in,
    and blank stays hidden.
  */
  const subline = site.home.hero.subline.trim();
  const primaryCta = site.home.hero.primaryCta.trim();
  const secondaryCta = site.home.hero.secondaryCta.trim();

  /*
    The two blocks below the album, gated through the same `visibleBlocks`
    the dashboard outline already uses. The form's "Quote and letter" and
    "Closing section" exist on every config whatever the template says, and
    the outline hides them when they are empty — one list, so the outline and
    the page can never disagree about whether a block is there.
  */
  const blocks = visibleBlocks(site);
  const quote = site.home.quote;
  const closing = site.home.footer;

  /*
    The quote's last sentence, highlighted — the form promises it ("The last
    sentence gets highlighted automatically"). Split on sentence boundaries;
    a quote with no internal punctuation to split on is one sentence, and the
    last sentence of a one-sentence quote is the whole thing, so the marker
    covers all of it rather than none of it.
  */
  const quoteSentences = blocks.quote ? quote.text.trim().split(/(?<=[.!?…])\s+/) : [];
  const quoteLast = quoteSentences[quoteSentences.length - 1] ?? "";
  const quoteRest = quoteSentences.slice(0, -1).join(" ");

  // The letter, split the way the schema describes it: paragraphs on blank lines.
  const letterParagraphs = blocks.quoteTruth ? quote.truth.trim().split(/\n\s*\n/) : [];
  const revealLabel = quote.toggleReveal.trim() || "Read the rest";
  const backLabel = quote.toggleBack.trim() || "Back to the quote";

  // Cards with nothing written on them are placeholders, not content.
  const closingCards = closing.cards.filter(
    (card) => card.tag.trim().length > 0 || card.quote.trim().length > 0,
  );

  return (
    <div className="sb-shell">
      <div className="sb-fibre" aria-hidden="true" />
      <div className="sb-vignette" aria-hidden="true" />

      <ScrapbookTopBar active="home" paths={paths} initials={site.identity.initials} />

      <main>
        <section className="sb-cover">
          <div className="sb-cover-head">
            {/*
              Her name, slotted into the one line on the cover that addresses
              her. "you" is the fallback, so a site with no name written yet
              reads as intended rather than as an empty greeting.
            */}
            <p className="sb-type-small">
              collected for {site.identity.name.trim() || "you"} · since forever
            </p>
            <h1 className="sb-hand-h1 text-slate-500">
              {headline.map((line, i) => (
                <Fragment key={`${i}-${line}`}>
                  {i > 0 && <br />}
                  {line}
                </Fragment>
              ))}
            </h1>
            {subline && <p className="sb-cover-sub sb-hand">{subline}</p>}
            <span className="sb-stamp sb-stamp-cover">keep this one</span>
            {(primaryCta || secondaryCta) && (
              <div className="sb-cover-cta">
                {primaryCta && (
                  <a className="sb-btn" href={paths.gallery}>
                    {primaryCta}
                  </a>
                )}
                {secondaryCta && (
                  <button
                    type="button"
                    className="sb-btn"
                    onClick={() => setKeepScrolling((n) => (n ?? 0) + 1)}
                  >
                    {secondaryCta}
                  </button>
                )}
              </div>
            )}
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

        <section id="album" ref={albumRef} className="sb-album">
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
            <div ref={readRef} className="sb-read" aria-live="polite">
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

        {/*
          The quote and the letter behind it — the form's "Quote and letter"
          block. The whole section hangs off `quote.text`: clear the quote and
          it goes away, exactly as the editor's hint promises.
        */}
        {blocks.quote && (
          <section className="sb-quote">
            <div className="sb-quote-card">
              <span className="sb-brad sb-brad-tl" aria-hidden="true" />
              <span className="sb-brad sb-brad-br" aria-hidden="true" />
              <blockquote className="sb-quote-text sb-hand">
                {quoteRest && <>{quoteRest} </>}
                <mark className="sb-quote-mark">{quoteLast}</mark>
              </blockquote>
              {(quote.verdictLabel.trim() || quote.verdictValue.trim()) && (
                <p className="sb-quote-verdict sb-type">
                  {quote.verdictLabel.trim()} {quote.verdictValue.trim()}
                </p>
              )}
              {quote.author.trim() && (
                <p className="sb-quote-author sb-hand">— {quote.author.trim()}</p>
              )}
              {quote.authorSub.trim() && (
                <p className="sb-quote-author-sub sb-type-small">{quote.authorSub.trim()}</p>
              )}
              {blocks.quoteTruth && (
                <button
                  type="button"
                  className="sb-btn sb-quote-toggle"
                  aria-expanded={letterOpen}
                  onClick={() => setLetterOpen(!letterOpen)}
                >
                  {letterOpen ? backLabel : revealLabel}
                </button>
              )}
              {blocks.quoteTruth && letterOpen && (
                <div ref={letterRef} className="sb-quote-letter">
                  {letterParagraphs.map((paragraph, i) => (
                    <p key={i} className="sb-hand">
                      {paragraph}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/*
          The closing section: heading, the fan of cards, the button into the
          gallery. It hangs off the heading-or-subline pair the outline uses,
          and the cards cannot outlive it — the rule `visibleBlocks` enforces.
        */}
        {blocks.footer && (
          <section className="sb-closing">
            {closing.heading.trim() && (
              <h2 className="sb-hand-h2 sb-hand">{closing.heading.trim()}</h2>
            )}
            {closing.subline.trim() && (
              <p className="sb-closing-sub sb-hand">{closing.subline.trim()}</p>
            )}
            {blocks.footerCards && closingCards.length > 0 && (
              <div className="sb-fan">
                {closingCards.map((card) => (
                  <figure key={card.id} className="sb-fan-card">
                    {card.tag.trim() && (
                      <figcaption className="sb-type-small">{card.tag.trim()}</figcaption>
                    )}
                    <blockquote className="sb-hand">{card.quote.trim()}</blockquote>
                  </figure>
                ))}
              </div>
            )}
            {closing.ctaLabel.trim() && (
              <div className="sb-closing-cta">
                <a className="sb-btn" href={paths.gallery}>
                  {closing.ctaLabel.trim()}
                </a>
              </div>
            )}
          </section>
        )}
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

                /* The subline and the two buttons from "First impression". */
                .sb-cover-sub {
                  margin:20px 0 0; max-width:34ch;
                  font-size:clamp(24px,2.2vw,31px);
                  line-height:1.35; color:var(--ink-soft);
                }
                .sb-cover-cta {
                  display:flex; flex-wrap:wrap; gap:16px; margin-top:32px;
                }
                /* The buttons are a <button>, the gallery one a link: both get
                   the sticker look, neither keeps a UA border or underline. */
                .sb-cover-cta .sb-btn { border:0; cursor:pointer; text-decoration:none; }

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

                /* ---------- quote and letter ---------- */
                .sb-quote { max-width:1180px; margin:0 auto; padding:0 6vw 12vh; }
                .sb-quote-card {
                  position:relative; max-width:760px; margin:0 auto;
                  padding:clamp(30px,5vw,52px) clamp(28px,5vw,54px);
                  background:var(--paper-deep);
                  box-shadow:0 16px 34px -18px rgba(74,58,34,.55);
                  transform:rotate(.7deg);
                }
                .sb-quote-text {
                  margin:0; font-size:clamp(27px,3vw,40px); line-height:1.35;
                  color:var(--ink);
                }
                /* The marker swipe: a scrapbook highlights with a pen, not with
                   a link colour, and the last sentence is the one she underlines. */
                .sb-quote-mark {
                  background:linear-gradient(transparent 58%, rgba(230,57,70,.28) 58%);
                  color:inherit;
                }
                .sb-quote-verdict {
                  margin:22px 0 0; font-size:15px; letter-spacing:.1em;
                  text-transform:uppercase; color:var(--red);
                }
                .sb-quote-author { margin:18px 0 0; font-size:30px; color:var(--ink); }
                .sb-quote-author-sub { margin:6px 0 0; }
                .sb-quote-toggle { margin-top:26px; }
                .sb-quote-letter {
                  margin-top:26px; padding-top:22px;
                  border-top:1px dashed var(--ink-faint);
                }
                .sb-quote-letter p {
                  margin:0 0 16px; font-size:clamp(23px,2.4vw,29px);
                  line-height:1.5; color:var(--ink-soft);
                }
                .sb-quote-letter p:last-child { margin-bottom:0; }

                /* ---------- closing ---------- */
                .sb-closing {
                  max-width:1180px; margin:0 auto; padding:2vh 6vw 12vh;
                  text-align:center;
                }
                .sb-closing-sub {
                  margin:16px auto 0; max-width:44ch;
                  font-size:clamp(23px,2.3vw,30px); line-height:1.4;
                  color:var(--ink-soft);
                }
                .sb-fan {
                  display:flex; flex-wrap:wrap; justify-content:center;
                  gap:22px; margin:44px 0 40px;
                }
                .sb-fan-card {
                  margin:0; width:min(100%,300px); padding:20px 22px;
                  background:#fdfaf3; text-align:left;
                  border:1px solid rgba(180,164,136,.5);
                  box-shadow:0 12px 26px -16px rgba(74,58,34,.55);
                }
                /* Slapped down by hand: never square, never the same twice. */
                .sb-fan-card:nth-child(odd) { transform:rotate(-1.8deg); }
                .sb-fan-card:nth-child(even) { transform:rotate(1.5deg); }
                .sb-fan-card:nth-child(3n) { transform:rotate(.5deg); }
                .sb-fan-card figcaption { margin:0 0 10px; }
                .sb-fan-card blockquote {
                  margin:0; font-size:23px; line-height:1.4; color:var(--ink);
                }
                .sb-closing-cta { display:flex; justify-content:center; }

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