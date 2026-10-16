import { lazy, Suspense, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { Quote, Sparkles } from "lucide-react";
import EditableText from "../shared/EditableText";
import GlossyButton from "./GlossyButton";
import MediaPlaceholder from "../shared/MediaPlaceholder";
import PixelTransition from "./PixelTransition";
import ScrollToTop from "./ScrollToTop";
import SiteFooter from "./SiteFooter";
import SiteNav from "./SiteNav";
import useScrollReveal from "../../../hooks/useScrollReveal";
import { EMPTY_SLOT_COUNT, ctaTarget, emphasisParts, momentTag, visibleBlocks } from "../../../lib/site/derive";
import type { Site } from "../../../lib/site/schema";
import { blocky, glassPurple } from "../../../lib/shape";

/** three.js is lazy so it never lands in the initial bundle. */
const HeartDiamond = lazy(() => import("./ornaments/HeartDiamond"));
const GoldParticles = lazy(() => import("./ornaments/GoldParticles"));

/**
 * Everything GSAP is imported from here, by name.
 *
 * This file used a default import while `PixelTransition.tsx` used a named one.
 * Under Vite those can resolve to two separate copies of the library, which is
 * worth avoiding even now that this page no longer registers any plugin: the plain
 * timelines below should run on the same core as everything else. Vite is also
 * told to dedupe `gsap` (see vite.config.ts).
 */
export default function HomePage({ site, basePath }: { site: Site; basePath: string }) {
  const pageRef = useRef<HTMLDivElement>(null);
  const blocks = visibleBlocks(site);


  useLayoutEffect(() => {
    const root = pageRef.current;
    if (!root) return;

    const cleanups: Array<() => void> = [];

    /**
     * The hero entrance, and the magnetic buttons.
     *
     * No ScrollTrigger anywhere on this page — see `useScrollReveal` for what
     * that cost and why. These two are plain GSAP and work: a timeline that runs
     * once on load, and pointer listeners that are cleaned up by hand.
     */
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.set([".fh-line", ".fh-sub", ".fh-cta", ".fh-orb"], { autoAlpha: 0 })
      .set(".fh-line", { yPercent: 115 })
      .set(".fh-orb", { scale: 0.85 })
      .to(".fh-orb", { autoAlpha: 1, scale: 1, duration: 1.4, ease: "power2.out" }, 0.1)
      .to(".fh-line", { autoAlpha: 1, yPercent: 0, duration: 1, stagger: 0.1 }, 0.3)
      .to(".fh-sub", { autoAlpha: 1, y: 0, duration: 0.7 }, "-=0.5")
      .to(".fh-cta", { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.08 }, "-=0.4");

    for (const el of root.querySelectorAll<HTMLElement>(".magnetic")) {
      const xTo = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3" });
      const yTo = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3" });

      const onMove = (e: MouseEvent) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.3);
        yTo((e.clientY - r.top - r.height / 2) * 0.3);
      };
      const onLeave = () => {
        xTo(0);
        yTo(0);
      };

      el.addEventListener("mousemove", onMove);
      el.addEventListener("mouseleave", onLeave);
      cleanups.push(() => {
        el.removeEventListener("mousemove", onMove);
        el.removeEventListener("mouseleave", onLeave);
      });
    }

    return () => {
      cleanups.forEach((fn) => fn());
      tl.revert();
    };
  }, [site.ornaments.hero3d]);

  // Everything below the hero reveals on scroll. See the hook for why this is
  // IntersectionObserver and not ScrollTrigger, and why the hidden state is
  // applied from JavaScript rather than from CSS.
  useScrollReveal(pageRef);


  return (
    <>
      <div ref={pageRef} className="bg-void text-content overflow-hidden">
        {/*
          The gold particle field, as an underlay for the whole page.

          `fixed`, not absolute: it has to stay behind every section rather than
          only the hero, so the depth reads as one continuous field the reader is
          looking through the whole way down instead of an effect that stops where
          the first viewport ends. `pointer-events-none` because it spans the
          document and nothing in it is interactive.

          Sits above the page's own background but below every section, so the
          hero gradients wash over it rather than it washing over the type.
        */}
        {site.ornaments.particles && (
          <Suspense fallback={null}>
            <GoldParticles className="fixed inset-0 z-0 opacity-40 pointer-events-none" />
          </Suspense>
        )}

        {blocks.hero && (
          <section className="relative h-svh min-h-170 w-full overflow-hidden">
            <div className="absolute inset-0 bg-[image:var(--theme-grad-hero-bg)]" />
            <div className="absolute inset-0 bg-[image:var(--theme-grad-hero-glow)]" />
            <div className="absolute inset-0 bg-linear-to-t from-void via-void/30 to-transparent" />

            {/* Readability scrim: below the copy (z-10) but above the gem (z-0),
                and only where the gem sits behind the text on small screens */}
            <div
              aria-hidden="true"
              className="absolute inset-0 z-[5] md:hidden bg-[image:var(--theme-scrim-mobile)]"
            />

            <SiteNav name={site.identity.name} basePath={basePath} />

            <div className="relative z-10 h-full max-w-6xl mx-auto px-6 sm:px-10 flex flex-col md:flex-row items-start md:items-center justify-end md:justify-between pb-20 sm:pb-24 pt-28 md:pt-20">
              <div className="relative z-10 max-w-2xl">
                <h1 className="font-display leading-[0.98] tracking-tight max-w-3xl flex flex-col md:gap-2 gap-0">
                  {site.home.hero.lines.map((line, i) => {
                    const isLast = i === site.home.hero.lines.length - 1;
                    return (
                      <span key={i} className="block overflow-hidden h-14 md:h-16 lg:h-20">
                        <EditableText
                          as="span"
                          path={`home.hero.lines.${i}`}
                          value={line}
                          maxLength={90}
                          placeholder={`Headline line ${i + 1}`}
                          className={`fh-line lg:text-7xl text-4xl md:text-4xl block ${
                            isLast ? "text-transparent bg-clip-text bg-(image:--theme-grad-title)" : ""
                          }`}
                        />
                      </span>
                    );
                  })}
                </h1>

                <EditableText
                  as="p"
                  path="home.hero.subline"
                  value={site.home.hero.subline}
                  maxLength={500}
                  placeholder="A line about why this is for her"
                  className="fh-sub text-gold text-lg sm:text-xl max-w-lg mt-7"
                />

                <div className="flex flex-wrap items-center gap-4 mt-10">
                  {/*
                    The label is editable but the button is wrapped in a link, and
                    `useInertNavigation` swallows clicks on links in the preview. So
                    the text takes the click; the navigation does not follow. That
                    is the right trade for editing and the wrong one for using the
                    preview as a page, which is why the dashboard keeps its own
                    "View site" button.
                  */}
                  {site.home.hero.primaryCta && (
                    <Link to={ctaTarget("gallery", basePath)} className="fh-cta">
                      <GlossyButton size="lg">{site.home.hero.primaryCta}</GlossyButton>
                    </Link>
                  )}
                  {site.home.hero.secondaryCta && blocks.moments && (
                    <a href={ctaTarget("moments", basePath)} className="fh-cta">
                      <GlossyButton size="lg" variant="ghost">
                        {site.home.hero.secondaryCta}
                      </GlossyButton>
                    </a>
                  )}
                </div>
              </div>

              {site.ornaments.hero3d && (
                <Suspense fallback={null}>
                  <HeartDiamond
                    className="fh-orb absolute inset-0 m-auto md:relative md:inset-auto md:m-0 h-[70vw] w-[70vw] max-w-[340px] max-h-[340px] md:h-[460px] md:w-[460px] lg:h-[540px] lg:w-[540px] pointer-events-none md:pointer-events-auto z-0 opacity-40 md:opacity-100 flex-shrink-0"
                  />
                </Suspense>
              )}
            </div>
          </section>
        )}

        {blocks.moments && (
          <section id="moments" className="max-w-6xl mx-auto px-6 sm:px-10 py-28 sm:py-36">
            <div data-reveal className="max-w-xl mb-14">
              <h2 className="font-display text-[clamp(1.8rem,3vw,2.8rem)]">
                A few of the moments
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              {/*
                `> 0`, not `>= 0`. An array length is never negative, so the old
                comparison was always true and the empty-slot branch below was
                dead code — a site with no moments rendered a bare heading and
                nothing else, instead of the "Add a picture" boxes.
              */}
              {site.home.moments.length > 0 ? (
                site.home.moments.map((moment, i) => (
                  <MomentCard key={moment.id} moment={moment} index={i} />
                ))
              ) : (
                Array.from({ length: EMPTY_SLOT_COUNT }, (_, i) => (
                  <div
                    key={`empty-${i}`}
                    /*
                      The ratio lives on the cell itself rather than on a wrapper
                      inside it. With a wrapper the cell measured roughly twice its
                      own box, and a layout mystery is not worth shipping; here
                      there is one box and one rule.

                      `4 / 3`, not `75%`. Two things were wrong with the old
                      value. `aspect-ratio` takes a ratio, and a bare percentage
                      is invalid, so the browser discarded it and the box
                      collapsed to whatever its content happened to be. And the
                      direction: PixelTransition's `aspectRatio="75%"` is applied
                      as `padding-top`, so its cards are height = width × 0.75 — a
                      landscape box. These slots have to match them.
                    */
                    style={{ aspectRatio: "4 / 3" }}
                    className="relative w-full overflow-hidden rounded-2xl border border-gold/25 shadow-card"
                  >
                    <MediaPlaceholder
                      kind="image"
                      className="!border-0 !rounded-none !min-h-0 h-full"
                    />
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {blocks.quote && <QuotePanel site={site} />}

        {blocks.footer && <FooterCta site={site} basePath={basePath} />}
        </div>

        {/*
          Navigation chrome. Outside the overflow-hidden page root so the fixed
          scroll control above cannot clip it, and below the closing section so
          the author's own copy keeps its own space.
        */}
        <SiteFooter site={site} basePath={basePath} />

      {/* Outside the overflow-hidden page root so the fixed button can't be clipped */}
      <ScrollToTop />
    </>
  );
}

/* ------------------------------------------------------------------ *
 * MOMENTS
 * ------------------------------------------------------------------ */

function MomentCard({ moment, index }: { moment: Site["home"]["moments"][number]; index: number }) {
  const hasImage = moment.image.url !== undefined && moment.image.url.trim() !== "";

  return (
    <div
      data-tilt-card
      /*
        No `w-fit` here, and that is load-bearing rather than an omission.
        `PixelTransition` takes its height from a spacer div using
        `padding-top: 75%`, which resolves against the parent's *definite* width.
        `width: fit-content` is not definite and the card's own child is
        `width: 100%` of it — circular, so both resolved to zero and the whole
        card collapsed to its 1px border. Filling the grid cell is both correct
        and what the two-column grid wants.
      */
      className="relative w-full overflow-hidden border rounded-2xl border-gold/25 shadow-card group"
    >
      <PixelTransition
        firstContent={
          hasImage ? (
            <div className="relative h-full w-full bg-[image:var(--theme-grad-card-front)] select-none">
              <img
                src={moment.image.url}
                alt={moment.image.alt || moment.caption}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
              />
              {/* Scrim: keeps the tag and the prompt legible over any photo */}
              <div className="absolute inset-0 bg-[image:var(--theme-scrim-card)]" />

              <div className="relative h-full w-full p-7 sm:p-8 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-widest text-gold/90 uppercase">
                    {momentTag(moment.tag, index)}
                  </span>
                  <span className="text-xs font-medium text-lavender/85 bg-void/55 px-2.5 py-1 rounded-full border border-lavender/25">
                    Click to reveal
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <MediaPlaceholder
              kind="image"
              className="relative h-full w-full rounded-none !min-h-0 border-0"
            />
          )
        }
        secondContent={
          <div className="relative h-full w-full bg-[image:var(--theme-grad-card-back)] p-7 sm:p-8 flex flex-col justify-between border border-gold/30 select-none">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-widest text-gold-bright uppercase">
                Behind the photo
              </span>
              {moment.date && (
                <span className="text-xs font-medium text-gold/70">{moment.date}</span>
              )}
            </div>
            {moment.caption && (
              <p className="font-display text-lg sm:text-xl text-content italic leading-relaxed my-auto">
                &ldquo;
                <EditableText
                  path={`home.moments.${index}.caption`}
                  value={moment.caption}
                  maxLength={300}
                  placeholder="A caption she reads before she taps"
                />
                &rdquo;
              </p>
            )}
            <span className="text-xs text-lavender/60">Click again to close</span>
          </div>
        }
        gridSize={8}
        animationStepDuration={0.35}
        trigger="click"
        aspectRatio="75%"
        className="w-full h-full"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * QUOTE
 * ------------------------------------------------------------------ */

function QuotePanel({ site }: { site: Site }) {
  const { text, truth, author, authorSub, verdictLabel, verdictValue, toggleReveal, toggleBack } =
    site.home.quote;
  const { lead, emphasis, tail } = emphasisParts(text);
  // The letter has content — the button exists to reveal it, so it only
  // renders when `visibleBlocks` says the toggle is real.
  const [showLetter, setShowLetter] = useState(false);

  return (
    <section className="relative max-w-5xl mx-auto px-6 sm:px-10 pb-28 sm:pb-36">
      {/* Soft accent-purple ambient backlight */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] max-w-2xl h-[320px] bg-[radial-gradient(ellipse_at_center,rgba(217,169,78,0.14),rgba(91,42,134,0.16)_50%,transparent_75%)] blur-3xl pointer-events-none -z-10" />

      <div
        data-reveal
        className="relative overflow-hidden rounded-3xl border border-gold/25 bg-[image:var(--theme-grad-panel)] backdrop-blur-2xl p-8 sm:p-14 lg:p-16 shadow-panel transition-all duration-500 hover:border-gold/45"
      >
        {/* Subtle quotation watermark */}
        <div className="absolute top-4 right-8 select-none pointer-events-none text-gold/10 font-serif text-[12rem] sm:text-[15rem] leading-none -translate-y-6">
          ”
        </div>

        <div className="relative z-10 flex flex-col items-center sm:items-start text-center sm:text-left">
          {/* Only shown when there is a letter to reveal. */}
          {truth && (
            <button
              type="button"
              onClick={() => setShowLetter((v) => !v)}
              className="group inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gold/10 border border-gold/25 text-gold-bright text-xs font-semibold tracking-widest uppercase mb-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] cursor-pointer transition-all duration-300 hover:bg-gold/20 hover:border-gold/45"
            >
              <Sparkles className="w-3.5 h-3.5 text-gold-bright animate-pulse group-hover:animate-spin" />
              <span>{showLetter ? toggleBack : toggleReveal}</span>
            </button>
          )}

          {!showLetter ? (
            <div key="quote" className="animate-[fadeSlideIn_0.45s_ease-out] w-full">
              <blockquote className="font-display text-[clamp(1.75rem,3.2vw,2.85rem)] leading-[1.28] tracking-tight text-content max-w-3xl">
                {"\u201C"}
                {lead}
                {lead && " "}
                <span className="text-transparent bg-clip-text bg-[image:var(--theme-grad-quote-text)] italic font-semibold">
                  {emphasis}
                </span>
                {tail}
                {"\u201D"}
              </blockquote>

              <div className="mt-10 sm:mt-12 pt-8 border-t border-gold/15 w-full flex flex-col sm:flex-row items-center sm:justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-full p-[1.5px] bg-[image:var(--theme-grad-ring)] shadow-[0_4px_12px_rgba(138,100,23,0.35)] flex-shrink-0">
                    <div className="w-full h-full rounded-full bg-ink flex items-center justify-center">
                      <Quote className="w-4 h-4 text-gold-bright" />
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-gold-bright text-base tracking-wide">
                      <EditableText
                        path="home.quote.author"
                        value={author}
                        maxLength={120}
                        placeholder="Your name"
                      />
                    </p>
                    <p className="text-xs text-lavender/60 mt-0.5">
                      <EditableText
                        path="home.quote.authorSub"
                        value={authorSub}
                        maxLength={200}
                        placeholder="A small line"
                      />
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-void/60 border border-gold/20 text-xs text-gold">
                  <span className="text-[11px] tracking-wider uppercase text-lavender/70">
                    <EditableText
                      path="home.quote.verdictLabel"
                      value={verdictLabel}
                      maxLength={60}
                      placeholder="Verdict:"
                    />
                  </span>
                  <span className="font-semibold text-gold-bright">
                    <EditableText
                      path="home.quote.verdictValue"
                      value={verdictValue}
                      maxLength={60}
                      placeholder="10 / 10"
                    />
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div key="truth" className="animate-[fadeSlideIn_0.45s_ease-out] max-w-3xl w-full">
              {truth.split(/\n\s*\n/).filter(Boolean).map((para, i) =>
                i === 0 ? (
                  <h3 key={i} className="font-display text-2xl sm:text-3xl text-gold-bright mb-5 tracking-tight">
                    {para}
                  </h3>
                ) : (
                  <p
                    key={i}
                    className={`text-base sm:text-lg leading-relaxed text-content/85 ${
                      i > 1 ? "mt-5" : ""
                    }`}
                  >
                    {para}
                  </p>
                ),
              )}
              <p className="mt-5 text-sm text-lavender/60 italic">Tap &ldquo;{toggleBack}&rdquo; to return.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * FOOTER
 * ------------------------------------------------------------------ */

function FooterCta({ site, basePath }: { site: Site; basePath: string }) {
  const { heading, subline, ctaLabel, cards } = site.home.footer;

  return (
    <section className="relative overflow-hidden border-t border-gold/15">
      <div className="absolute inset-0 bg-[image:var(--theme-grad-footer)]" />
      <div className="absolute inset-0 bg-[radial-gradient(60%_40%_at_50%_100%,rgba(217,169,78,0.18),transparent_70%)]" />

      <div className="relative z-10 max-w-3xl mx-auto px-6 sm:px-10 pt-28 sm:pt-36 text-center">
        <EditableText
          as="h2"
          attributes={{ "data-reveal": "" }}
          path="home.footer.heading"
          value={heading}
          maxLength={200}
          placeholder="The last thing she reads"
          className="font-display text-[clamp(2rem,4.5vw,3.4rem)] balance"
        />
        {subline && (
          <EditableText
            as="p"
            attributes={{ "data-reveal": "" }}
            path="home.footer.subline"
            value={subline}
            maxLength={300}
            placeholder="A line under it"
            className="text-lavender mt-4 text-lg max-w-xl mx-auto"
          />
        )}

        {ctaLabel && (
          <div data-reveal data-reveal-start="top bottom" className="relative z-10 mt-8 mb-6">
            <div className={`magnetic inline-block p-1 ${blocky} ${glassPurple}`}>
              <Link to={ctaTarget("gallery", basePath)}>
                <GlossyButton size="lg">{ctaLabel}</GlossyButton>
              </Link>
            </div>
          </div>
        )}

        {cards.length > 0 && (
          <div className="fh-cta-row relative z-0 -mt-12 -mb-12 px-2 flex items-end justify-center gap-2 sm:gap-5">
            {cards.map((card, i) => (
              <div
                key={card.id}
                data-cta-card
                data-depth={i % 2}
                className={`fh-cta-card relative overflow-hidden shrink-0 ${blocky} w-[30vw] max-w-[250px] sm:w-60 p-4 sm:p-5 text-left bg-gold/10 backdrop-blur-md border border-gold/25 shadow-card`}
                style={{
                  zIndex: i,
                  // Fan: centre card sits highest, edges lowest
                  marginBottom: i === 1 ? 16 : i === 2 ? 8 : 0,
                }}
              >
                <div className="text-[10px] sm:text-xs font-semibold tracking-widest text-gold/70 uppercase mb-2">
                  <EditableText
                    path={`home.footer.cards.${i}.tag`}
                    value={card.tag}
                    maxLength={40}
                    placeholder={`Clip ${String(i + 1).padStart(2, "0")}`}
                  />
                </div>
                <p className="font-display text-xs sm:text-sm italic text-content/90 leading-snug">
                  &ldquo;
                  <EditableText
                    path={`home.footer.cards.${i}.quote`}
                    value={card.quote}
                    maxLength={400}
                    placeholder="A short line about this clip"
                  />
                  &rdquo;
                </p>
                {/* Light sweep — fires once after the card lands */}
                <div className="fh-cta-shine pointer-events-none absolute inset-0 opacity-0 bg-[image:var(--theme-grad-shine)]" />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
