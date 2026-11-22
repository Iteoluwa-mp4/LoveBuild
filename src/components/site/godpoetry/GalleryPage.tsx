import { useMemo, useRef } from "react";

import { FALLBACK_ART } from "./art";
import useScrollReveal from "../../../hooks/useScrollReveal";
import { momentTag } from "../../../lib/site/derive";
import type { Site } from "../../../lib/site/schema";
import { godPoetryPaths } from "./paths";

/**
 * The God Poetry gallery — "the little things".
 *
 * The home page is a long-form blessing, so its gallery is deliberately quieter:
 * a wall of photographs with the words that were written under them. It reads
 * as the same object as the blessing — paper, gold, Fraunces, the same masthead
 * — rather than as a second template bolted on.
 *
 * The photographs are `home.moments`, the one list every template shares. An
 * empty slot still renders, with a generated landscape, so an author midway
 * through uploading sees the shape of the page and where each picture lands.
 */
export default function GodPoetryGalleryPage({
  site,
  basePath,
}: {
  site: Site;
  basePath: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const paths = useMemo(() => godPoetryPaths(basePath), [basePath]);

  const name = site.identity.name.trim() || "Cristian";
  const initials = site.identity.initials.trim() || "grace notes";

  const photos = useMemo(
    () =>
      site.home.moments.map((moment, index) => ({
        id: moment.id,
        image: moment.image.url.trim() || FALLBACK_ART[index % FALLBACK_ART.length],
        alt:
          moment.image.alt.trim() ||
          moment.caption.trim() ||
          `${name}, photograph ${index + 1}`,
        caption: moment.caption.trim() || momentTag(moment.tag, index),
        note: moment.secret.trim(),
        date: moment.date.trim(),
      })),
    [name, site.home.moments],
  );

  useScrollReveal(rootRef, ".gpg-reveal");

  return (
    <div ref={rootRef} className="gpg">
      <style>{GALLERY_CSS}</style>
      <div className="gpg-noise" />

      <header className="gpg-nav">
        <a href={paths.home} className="gpg-mark">
          <span aria-hidden="true">✦</span> {initials}
        </a>
        <nav>
          <a href={paths.word}>the word</a>
          <a href={paths.poem}>the poem</a>
          <a href={paths.letter}>a blessing</a>
        </nav>
        <span className="gpg-nav-meta">the little things / 01</span>
      </header>

      <main className="gpg-main">
        <section className="gpg-hero">
          <p className="gpg-kicker gpg-reveal">
            <span aria-hidden="true" /> a gathering / for {name}
          </p>
          <h1 className="gpg-title gpg-reveal">
            The little
            <br />
            <em>things.</em>
          </h1>
          <p className="gpg-sub gpg-reveal">
            Every photograph kept because it was ordinary, and because it was ours.
            Nothing here is asking to be impressive. It is only asking to be remembered.
          </p>
          <div className="gpg-meta gpg-reveal">
            <span>
              {photos.length} {photos.length === 1 ? "photograph" : "photographs"}
            </span>
            <span aria-hidden="true">✦</span>
            <span>collected slowly</span>
          </div>
        </section>

        {photos.length > 0 ? (
          <section className="gpg-grid" aria-label="Photographs">
            {photos.map((photo, index) => (
              <figure className="gpg-item gpg-reveal" key={photo.id}>
                <div className="gpg-figure">
                  <img src={photo.image} alt={photo.alt} loading="lazy" />
                  <span className="gpg-number">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <figcaption>
                  <p className="gpg-caption">{photo.caption}</p>
                  {photo.note && <p className="gpg-note">{photo.note}</p>}
                  {photo.date && <span className="gpg-date">{photo.date}</span>}
                </figcaption>
              </figure>
            ))}
          </section>
        ) : (
          <section className="gpg-empty gpg-reveal">
            <span aria-hidden="true">✦</span>
            <h2>No photographs yet.</h2>
            <p>
              The blessing still has its words. Add a photograph and it will find its
              place here, and on the cover.
            </p>
          </section>
        )}

        <section className="gpg-outro gpg-reveal">
          <div className="gpg-rule">
            <span aria-hidden="true">✦</span>
            <small>the final note</small>
            <span aria-hidden="true">✦</span>
          </div>
          <h2>
            Go gently.
            <br />
            <em>Keep the little things.</em>
          </h2>
          <p>
            For {name}, with love —
            <br />
            and with every ordinary thing still ahead.
          </p>
          <a className="gpg-back" href={paths.home}>
            ← back to the blessing
          </a>
        </section>
      </main>

      <footer className="gpg-footer">
        <span>{initials}</span>
        <span>for {name}</span>
        <span aria-hidden="true">∞</span>
      </footer>
    </div>
  );
}

const GALLERY_CSS = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600&display=swap');
    :root { --god-paper:#f4f0e6; --god-ink:#182d32; --god-soft:#687679; --god-line:#c4c4b5; --god-deep:#203d42; }
    * { box-sizing:border-box; }
    html { scroll-behavior:smooth; }
    body { margin:0; background:var(--god-paper); color:var(--god-ink); font-family:Inter,Arial,sans-serif; }
    a { color:inherit; text-decoration:none; }
    /* SiteShell applies the preset's pale text; this paper needs its own ink anchor. */
    .gpg { min-height:100vh; overflow:hidden; position:relative; background:var(--god-paper); color:var(--god-ink); }
    .gpg-noise { position:fixed; z-index:12; pointer-events:none; inset:0; opacity:.13; mix-blend-mode:multiply; background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.72' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.4'/%3E%3C/svg%3E"); }
    .gpg-nav, .gpg-main, .gpg-footer { position:relative; z-index:2; }
    .gpg-nav { width:min(1360px,100%); margin:auto; display:flex; align-items:center; justify-content:space-between; padding:25px 5vw; border-bottom:1px solid var(--god-line); color:var(--god-soft); font:9px 'DM Mono',monospace; text-transform:uppercase; letter-spacing:.12em; }
    .gpg-mark { color:var(--god-ink); font:600 18px 'Fraunces',serif; letter-spacing:-.03em; text-transform:none; }
    .gpg-mark span { color:#b08d4f; font-size:14px; margin-right:7px; }
    .gpg-nav nav { display:flex; gap:28px; }
    .gpg-nav nav a:hover { color:#b08d4f; }
    .gpg-nav-meta { color:#b08d4f; }
    .gpg-main { width:min(1200px,100%); margin:auto; }
    .gpg-hero { padding:14vh 5vw 10vh; border-bottom:1px solid var(--god-line); }
    .gpg-kicker { margin:0; color:#b08d4f; font:10px 'DM Mono',monospace; text-transform:uppercase; letter-spacing:.14em; }
    .gpg-kicker span { display:inline-block; width:33px; margin-right:12px; border-top:1px solid #b08d4f; vertical-align:middle; }
    .gpg-title { margin:25px 0 32px; font:600 clamp(67px,10vw,142px)/.8 'Fraunces',serif; letter-spacing:-.09em; }
    .gpg-title em { color:#b08d4f; font-style:italic; }
    .gpg-sub { max-width:480px; margin:0; color:var(--god-soft); font:italic 22px/1.35 'Fraunces',serif; }
    .gpg-meta { display:flex; gap:18px; align-items:center; margin-top:48px; color:var(--god-soft); font:9px 'DM Mono',monospace; text-transform:uppercase; letter-spacing:.1em; }
    .gpg-meta span:nth-child(2) { color:#b08d4f; font-size:17px; }
    .gpg-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10vh 6vw; padding:13vh 5vw; border-bottom:1px solid var(--god-line); }
    .gpg-item { margin:0; }
    .gpg-item:first-child:nth-last-child(1) { grid-column:1 / -1; max-width:760px; margin:0 auto; }
    .gpg-figure { position:relative; overflow:hidden; background:var(--god-deep); }
    .gpg-figure img { width:100%; aspect-ratio:4 / 5; display:block; object-fit:cover; filter:saturate(.85) contrast(.96); }
    .gpg-figure:after { content:''; position:absolute; inset:0; background:linear-gradient(180deg,rgba(24,45,50,.04),transparent 55%,rgba(24,45,50,.32)); pointer-events:none; }
    .gpg-number { position:absolute; z-index:1; right:20px; top:18px; color:#fff7de; font:10px 'DM Mono',monospace; letter-spacing:.12em; }
    .gpg-item figcaption { padding:22px 2px 0; }
    .gpg-caption { margin:0; font:italic 28px/1.08 'Fraunces',serif; letter-spacing:-.02em; }
    .gpg-note { max-width:520px; margin:14px 0 0; color:var(--god-soft); font:15px/1.75 Georgia,serif; }
    .gpg-date { display:block; margin-top:16px; color:#b08d4f; font:9px 'DM Mono',monospace; text-transform:uppercase; letter-spacing:.12em; }
    .gpg-empty { padding:14vh 5vw; text-align:center; border-bottom:1px solid var(--god-line); }
    .gpg-empty > span { color:#b08d4f; font-size:28px; }
    .gpg-empty h2 { margin:26px 0 0; font:600 clamp(42px,5vw,70px)/.95 'Fraunces',serif; letter-spacing:-.06em; }
    .gpg-empty p { max-width:430px; margin:26px auto 0; color:var(--god-soft); font:16px/1.75 Georgia,serif; }
    .gpg-outro { padding:16vh 5vw 18vh; text-align:center; }
    .gpg-rule { display:flex; align-items:center; gap:15px; max-width:450px; margin:0 auto 65px; color:#b08d4f; }
    .gpg-rule:before, .gpg-rule:after { content:''; flex:1; border-top:1px solid var(--god-line); }
    .gpg-rule small { font:9px 'DM Mono',monospace; text-transform:uppercase; letter-spacing:.1em; }
    .gpg-outro h2 { margin:0; font:600 clamp(54px,8vw,110px)/.84 'Fraunces',serif; letter-spacing:-.085em; }
    .gpg-outro h2 em { color:#b08d4f; font-style:italic; }
    .gpg-outro p { margin:42px auto 0; color:var(--god-soft); font:italic 21px/1.4 'Fraunces',serif; }
    .gpg-back { display:inline-block; margin-top:48px; padding-bottom:7px; border-bottom:1px solid #b08d4f; color:#b08d4f; font:10px 'DM Mono',monospace; text-transform:uppercase; letter-spacing:.12em; }
    .gpg-back:hover { color:var(--god-ink); border-color:var(--god-ink); }
    .gpg-footer { display:flex; justify-content:space-between; padding:23px 5vw; border-top:1px solid var(--god-line); color:var(--god-soft); font:9px 'DM Mono',monospace; text-transform:uppercase; letter-spacing:.1em; }
    .gpg-reveal { transition:opacity .85s cubic-bezier(.16,1,.3,1), transform .85s cubic-bezier(.16,1,.3,1); transition-delay:var(--reveal-delay,0ms); }
    .gpg-reveal.js-reveal-pending { opacity:0; transform:translateY(28px); }
    @media (prefers-reduced-motion: reduce) { html { scroll-behavior:auto; } .gpg-reveal { transition:none; } }
    @media (max-width:760px) {
        .gpg-nav { padding:20px 18px; }
        .gpg-nav nav { display:none; }
        .gpg-nav-meta { font-size:8px; }
        .gpg-hero { padding:80px 18px 70px; }
        .gpg-sub { font-size:20px; }
        .gpg-meta { margin-top:38px; flex-wrap:wrap; gap:12px; }
        .gpg-grid { grid-template-columns:1fr; padding:80px 18px; gap:64px; }
        .gpg-item:first-child:nth-last-child(1) { max-width:none; }
        .gpg-figure img { aspect-ratio:4 / 5; }
        .gpg-caption { font-size:25px; }
        .gpg-outro { padding:100px 20px 110px; }
        .gpg-footer { padding:20px 18px; font-size:8px; }
        .gpg-footer span:nth-child(2) { max-width:90px; text-align:center; }
    }
`;
