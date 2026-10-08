import { lazy, Suspense, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import EditableText from "./EditableText";
import FilmFrame from "./FilmFrame";
import MediaPlaceholder from "./MediaPlaceholder";
import ScrollToTop from "./ScrollToTop";
import SiteFooter from "./SiteFooter";
import SiteNav from "./SiteNav";
import { Eyebrow, Reveal } from "./primitives";
import { chapterLabel, hasContent, visibleBlocks } from "../../lib/site/derive";
import { countLabel } from "../../lib/format";
import type { Chapter, Site } from "../../lib/site/schema";
import { blocky, glossyGold } from "../../lib/shape";

/** three.js is lazy so it never lands in the initial bundle. */
const GoldParticles = lazy(() => import("./ornaments/GoldParticles"));

/**
 * The gallery: a vertical reel.
 *
 * Chapters are rendered in config order. Each opens with a title screen, then
 * one screen per film, then a screen of photographs. A chapter with neither
 * films nor stills is skipped by `visibleBlocks` rather than rendered hollow.
 */
export default function GalleryPage({ site, basePath }: { site: Site; basePath: string }) {
  const blocks = visibleBlocks(site);

  // Snap the document for the vertical feed, and hand it back on the way out so
  // the home page keeps its free-form scroll
  useEffect(() => {
    document.documentElement.classList.add("gallery-feed");
    return () => document.documentElement.classList.remove("gallery-feed");
  }, []);

  // No filtering. Every chapter renders, including empty ones, which show their
  // own placeholder slots. Dropping them here used to leave the footer sitemap
  // pointing at anchors that were not in the document — and the outline's
  // "Empty — hidden" badge was the only thing that disagreed.
  const chapters = site.gallery.chapters;

  return (
    <div className="relative bg-void text-content">
      <div aria-hidden="true" className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[image:var(--theme-grad-hero-bg)]" />
        <div className="absolute inset-0 bg-[image:var(--theme-grad-hero-glow)]" />
      </div>
      {site.ornaments.particles && (
        <Suspense fallback={null}>
          <GoldParticles className="fixed inset-0 z-0 opacity-40" />
        </Suspense>
      )}

      <SiteNav name={site.identity.name} basePath={basePath} />

      {blocks.galleryHero && (
        <header
          data-snap
          className="relative z-10 flex min-h-svh flex-col items-center justify-center px-6 py-32 text-center sm:px-10"
        >
          <Reveal>
            <EditableText
              as="p"
              path="gallery.hero.eyebrow"
              value={site.gallery.hero.eyebrow}
              maxLength={60}
              placeholder="The gallery"
              className="text-[10px] font-semibold uppercase tracking-[0.32em] text-gold/85 sm:text-[11px]"
            />
          </Reveal>

          <Reveal delay={120}>
            <h1 className="mt-7 font-display text-[clamp(2rem,5vw,3.75rem)] leading-[1.12] italic">
              <EditableText
                as="span"
                path="gallery.hero.lineOne"
                value={site.gallery.hero.lineOne}
                maxLength={120}
                placeholder="The opening line"
                className="block"
              />
              <EditableText
                as="span"
                path="gallery.hero.lineTwo"
                value={site.gallery.hero.lineTwo}
                maxLength={120}
                placeholder="and the second"
                className="mt-1.5 block text-transparent bg-clip-text bg-[image:var(--theme-grad-title)]"
              />
            </h1>
          </Reveal>

          {site.gallery.hero.blurb && (
            <Reveal delay={240}>
              <EditableText
                as="p"
                path="gallery.hero.blurb"
                value={site.gallery.hero.blurb}
                maxLength={500}
                placeholder="A line introducing the reel"
                className="mt-8 max-w-md text-lavender/85 leading-relaxed sm:text-lg"
              />
            </Reveal>
          )}

          <Reveal delay={420}>
            <span
              aria-hidden="true"
              className="mt-16 flex h-14 w-px items-start overflow-hidden bg-gold/12"
            >
              <span className="cue-line block h-full w-px bg-gold/55" />
            </span>
          </Reveal>
        </header>
      )}

      <main className="relative z-10">
        {chapters.length > 0 ? (
          chapters.map((chapter, i) => (
            <div key={chapter.id} className="contents">
              <ChapterScreen chapter={chapter} index={i} base={`gallery.chapters.${i}`} />
              {chapter.films.map((film, fi) => (
                <FilmScreen
                  key={film.id}
                  film={film}
                  index={fi + 1}
                  base={`gallery.chapters.${i}.films.${fi}`}
                />
              ))}
              {/*
                An empty chapter keeps its title screen and shows the slots it
                would hold. Hiding it instead left the footer sitemap pointing at
                an anchor that was not in the document, so the link did nothing —
                and it contradicted the moments strip, where an empty moment still
                renders its box.
              */}
              {chapter.stills.length > 0 ? (
                <StillsScreen chapter={chapter} base={`gallery.chapters.${i}`} />
              ) : (
                // The title screen above is the chapter's heading, so this only
                // supplies the slots — no second title screen saying "no chapters".
                <EmptyChapterSlots chapterTitle={chapter.title} />
              )}
            </div>
          ))
        ) : (
          <EmptyChapterSlots />
        )}
      </main>

      {blocks.outro && (
        <footer
          data-snap
          className="relative z-10 flex min-h-svh flex-col items-center justify-center px-6 py-32 text-center sm:px-10"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 h-[55vmin] w-[80vw] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(217,169,78,0.10),rgba(91,42,134,0.08)_50%,transparent_75%)] blur-3xl"
          />

          <Reveal className="relative">
            <p className="font-display text-[clamp(1.6rem,3.4vw,2.6rem)] leading-tight italic">
              <EditableText
                path="gallery.outro.lineOne"
                value={site.gallery.outro.lineOne}
                maxLength={120}
                placeholder="The closing words"
              />{" "}
              <EditableText
                as="span"
                path="gallery.outro.lineTwo"
                value={site.gallery.outro.lineTwo}
                maxLength={120}
                placeholder="and the last"
                className="text-transparent bg-clip-text bg-[image:var(--theme-grad-title)]"
              />
            </p>
          </Reveal>

          {site.gallery.outro.aside && (
            <Reveal delay={160} className="relative">
              <EditableText
                as="p"
                path="gallery.outro.aside"
                value={site.gallery.outro.aside}
                maxLength={300}
                placeholder="A small line under them"
                className="mt-6 text-sm text-lavender/60"
              />
            </Reveal>
          )}

          <Reveal delay={280} className="relative mt-11">
            <Link
              to={basePath}
              className={`${blocky} ${glossyGold} inline-block px-8 py-3.5 text-sm font-bold tracking-wide text-on-gold transition-transform duration-300 ease-out hover:-translate-y-0.5 motion-reduce:hover:translate-y-0`}
            >
              <span className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                {site.gallery.outro.backLabel}
              </span>
            </Link>
          </Reveal>
        </footer>
      )}

      <ScrollToTop />
        <SiteFooter site={site} basePath={basePath} />

    </div>
  );
}

/**
 * The slots a chapter would hold, shown when it holds nothing yet.
 *
 * Same rule as the moments strip: an empty slot is already an honest gap, so
 * hiding the whole section would leave a blank page where the structure should
 * be.
 *
 * Two jobs, because they need different copy. With no chapters at all there is
 * nothing to hang slots off, so a title screen explains the empty page. An
 * existing-but-empty chapter already has its own title screen directly above —
 * repeating "No chapters yet" there would tell someone with three chapters that
 * they have none.
 */
function EmptyChapterSlots({ chapterTitle }: { chapterTitle?: string | undefined }) {
  const hasTitle = hasContent(chapterTitle);

  return (
    <>
      {!hasTitle && (
        <section
          data-snap
          className="relative flex min-h-svh items-center justify-center px-6 py-28 text-center sm:px-10 sm:py-24"
        >
          <div className="relative w-full max-w-3xl">
            <Reveal>
              <Eyebrow>01</Eyebrow>
            </Reveal>
            <Reveal delay={100}>
              <h2 className="mt-7 font-display text-[clamp(2rem,5.5vw,4rem)] leading-[1.08] italic">
                No chapters yet
              </h2>
            </Reveal>
            <Reveal delay={200}>
              <p className="mx-auto mt-7 max-w-md font-display text-base leading-relaxed italic text-content/75 sm:text-lg">
                Everything you add lands here, in the order you put it.
              </p>
            </Reveal>
            <Reveal delay={300}>
              <p className="mt-10 text-[10px] uppercase tracking-[0.28em] text-gold/60">
                No films or photographs
              </p>
            </Reveal>
          </div>
        </section>
      )}

      <section
        data-snap
        aria-label={hasTitle ? `${chapterTitle} — films and photographs` : "Films and photographs"}
        className="relative flex min-h-svh items-center justify-center px-6 py-16 sm:px-10 sm:py-14"
      >
        <div className="w-full max-w-3xl">
          <Reveal>
            <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
              <div className="overflow-hidden rounded-2xl border border-gold/18 bg-card-deep">
                <FilmFrame src="" title="No video yet" />
              </div>
              <div className="overflow-hidden rounded-2xl border border-gold/18 bg-card-deep">
                <div className="aspect-square w-full">
                  <MediaPlaceholder kind="image" className="!min-h-0" />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * CHAPTER
 * ------------------------------------------------------------------ */

/** What a chapter holds, said plainly. */
function contents(chapter: Chapter): string {
  const parts: string[] = [];
  if (chapter.films.length) parts.push(countLabel(chapter.films.length, "film"));
  if (chapter.stills.length) parts.push(countLabel(chapter.stills.length, "photograph"));
  return parts.join(" · ");
}

function ChapterScreen({
  chapter,
  index,
  base,
}: {
  chapter: Chapter;
  index: number;
  /** Dotted path to this chapter in the config, for on-page editing. */
  base: string;
}) {
  return (
    <section
      data-snap
      id={chapter.id}
      aria-labelledby={`${chapter.id}-title`}
      className="relative flex min-h-svh items-center justify-center px-6 py-28 text-center sm:px-10 sm:py-24"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[50vmin] w-[75vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(217,169,78,0.10),rgba(91,42,134,0.07)_50%,transparent_75%)] blur-3xl"
      />

      <div className="relative w-full max-w-3xl">
        <Reveal>
          <Eyebrow>{chapterLabel(chapter.label, index)}</Eyebrow>
        </Reveal>

        <Reveal delay={100}>
          <EditableText
            as="h2"
            attributes={{ id: `${chapter.id}-title` }}
            path={`${base}.title`}
            value={chapter.title}
            maxLength={120}
            placeholder="Name this part of the story"
            className="mt-7 font-display text-[clamp(2rem,5.5vw,4rem)] leading-[1.08] italic"
          />
        </Reveal>

        {chapter.blurb && (
          <Reveal delay={200}>
            <EditableText
              as="p"
              path={`${base}.blurb`}
              value={chapter.blurb}
              maxLength={400}
              placeholder="A line that sets up the chapter"
              className="mx-auto mt-7 max-w-md font-display text-base leading-relaxed italic text-content/75 sm:text-lg"
            />
          </Reveal>
        )}

        <Reveal delay={300}>
          <p className="mt-10 text-[10px] uppercase tracking-[0.28em] text-gold/60">
            {contents(chapter)}
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/** One film, one screen. Numbered within its chapter, not across the gallery. */
function FilmScreen({
  film,
  index,
  base,
}: {
  film: Chapter["films"][number];
  index: number;
  /** Dotted path to this film in the config, for on-page editing. */
  base: string;
}) {
  return (
    <section
      id={film.id}
      data-snap
      aria-labelledby={`${film.id}-title`}
      className="relative flex min-h-svh items-center justify-center px-6 py-24 sm:px-10 sm:py-20"
    >
      <div className="grid w-full max-w-5xl items-center gap-10 md:grid-cols-[1fr_auto] md:gap-14 lg:gap-20">
        {/* Film first on mobile, beside the text on desktop */}
        <Reveal delay={110} className="order-1 md:order-2">
          <FilmFrame src={film.src.url} title={film.title} />
        </Reveal>

        <div className="order-2 text-center md:order-1 md:text-left">
          <Reveal>
            <Eyebrow align="left">{String(index).padStart(2, "0")}</Eyebrow>
          </Reveal>

          <Reveal delay={90}>
            <EditableText
              as="h3"
              attributes={{ id: `${film.id}-title` }}
              path={`${base}.title`}
              value={film.title}
              maxLength={200}
              placeholder="A name for this clip"
              className="mt-6 font-display text-[clamp(1.6rem,3.2vw,2.4rem)] leading-tight"
            />
          </Reveal>

          {film.note && (
            <Reveal delay={180}>
              <EditableText
                as="p"
                path={`${base}.note`}
                value={film.note}
                maxLength={1000}
                placeholder="Write it to her, not about her"
                className="mx-auto mt-5 max-w-sm font-display text-base leading-relaxed italic text-content/80 md:mx-0 sm:text-lg"
              />
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}

/** A chapter's photographs, each at its own proportions. */
function StillsScreen({ chapter, base }: { chapter: Chapter; base: string }) {
  const stills = chapter.stills;
  const wide = stills.length < 3;
  // Two portraits side by side are taller for the same width than three, so the
  // two-up row gets a tighter cap
  const rowWidth = wide
    ? "max-w-[min(100%,28rem,64vmin)]"
    : "max-w-[min(100%,40rem,72vmin)]";

  return (
    <section
      data-snap
      id={`${chapter.id}-photos`}
      aria-label={`${chapter.title} — photographs`}
      className="relative flex min-h-svh items-center justify-center px-6 py-16 sm:px-10 sm:py-14"
    >
      <div className="w-full max-w-5xl text-center">
        <Reveal>
          <Eyebrow>{chapter.title}</Eyebrow>
        </Reveal>

        {/* Each photograph keeps its own shape — the sets are all different sizes,
            and cropping them to match would be the wrong kind of tidy. The row is
            capped against vmin so a tall portrait can't push this screen past a
            short window. */}
        <div
          className={`mx-auto mt-10 grid items-start gap-4 sm:mt-12 sm:gap-6 ${rowWidth} ${
            wide ? "grid-cols-2" : "grid-cols-3"
          }`}
        >
          {stills.map((still, i) => (
            <Reveal key={still.id} delay={140 + i * 110}>
              <figure className={wide ? "sm:mt-8" : i === 1 ? "sm:mt-10" : i === 2 ? "sm:mt-4" : ""}>
                <div className="overflow-hidden border border-gold/18 bg-card-deep shadow-[0_26px_50px_-24px_rgba(0,0,0,0.85)]">
                  {/* No photo yet: keep the frame rather than emitting an empty
                      `src`, which browsers resolve to the current page URL. */}
                  {still.src.url ? (
                    <img
                      src={still.src.url}
                      alt={still.src.alt || still.caption}
                      loading="lazy"
                      decoding="async"
                      className="h-auto w-full"
                    />
                  ) : (
                    <MediaPlaceholder kind="image" className="aspect-square !min-h-0" />
                  )}
                </div>
                {still.caption && (
                  <figcaption className="mt-4 text-[10px] uppercase tracking-[0.22em] text-gold/65">
                    <EditableText
                      path={`${base}.stills.${i}.caption`}
                      value={still.caption}
                      maxLength={300}
                      placeholder="A caption"
                    />
                  </figcaption>
                )}
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
