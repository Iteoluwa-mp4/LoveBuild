import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SphereGallery3D from "../../originkit/ui/sphere-gallery-3d";
import PhotoStrip from "./PhotoStrip";
import { DriftBand, SignalInterlude, MODERN_INTERLUDE_CSS } from "./Interlude";
import EditableText from "../shared/EditableText";
import {
  AmbientField,
  MODERN_BASE_CSS,
  MODERN_FONT_IMPORT,
  TopBar,
  sphereItems,
} from "./shared";
import { modernPaths } from "./paths";
import { modernMemories } from "../../../lib/site/derive";
import { cssColorNumber } from "../classic/ornaments/themeColor";
import type { Site } from "../../../lib/site/schema";

gsap.registerPlugin(ScrollTrigger);

/**
 * The modern template's home page.
 *
 * Config-driven like the classic template: every string comes from `site.modern`
 * and every photograph comes from `site.home.moments`, which is why switching
 * `template` back and forth keeps the uploads. See `modernMemories` in
 * `derive.ts` for the mapping, and the note on `modernSchema` for why the copy
 * is stored separately even though the images are not.
 */
export default function ModernTemplate({ site, basePath }: { site: Site; basePath: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const [opened, setOpened] = useState(false);

  // Keyed on the moments rather than on `site`, because the template renders one
  // moment list and nothing else on this page derives from the config object.
  // The whole site is a fresh object on every keystroke in the preview, so
  // depending on it would rebuild the sphere's image list per character typed.
  const memories = useMemo(() => modernMemories(site), [site.home.moments]);
  const galleryItems = useMemo(() => sphereItems(memories), [memories]);
  const paths = useMemo(() => modernPaths(basePath), [basePath]);

  const { hero, letter, strip, archive, closing } = site.modern;

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(
        ".eyebrow, .hero-title .word, .hero-copy, .hero-actions, .hero-meta",
        {
          y: 24,
          opacity: 0,
          duration: 0.9,
          stagger: 0.08,
          ease: "power3.out",
          delay: 0.15,
        },
      );
      gsap.from(".signal-card", {
        y: 60,
        opacity: 0,
        duration: 1.2,
        ease: "power3.out",
        delay: 0.35,
      });
      gsap.to(".orbit-ring", {
        rotate: 360,
        duration: 32,
        repeat: -1,
        ease: "none",
      });
      gsap.to(".pulse-dot", {
        scale: 1.9,
        opacity: 0,
        duration: 1.8,
        repeat: -1,
        ease: "power2.out",
        stagger: 0.6,
      });
      gsap.utils.toArray<HTMLElement>(".reveal").forEach((element) => {
        gsap.from(element, {
          scrollTrigger: { trigger: element, start: "top 82%" },
          y: 34,
          opacity: 0,
          duration: 0.8,
          ease: "power3.out",
        });
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  const handleOpen = () => {
    setOpened(true);
    gsap.to(".letter-panel", {
      y: 0,
      opacity: 1,
      duration: 0.7,
      ease: "power3.out",
    });
    gsap.to(".open-button", {
      scale: 0.96,
      yoyo: true,
      repeat: 1,
      duration: 0.12,
    });
  };

  return (
    <div ref={rootRef} className="site-shell">
      <AmbientField />
      <div className="grain" />
      <TopBar active="home" status="transmission private / 01" paths={paths} />

      <main id="top">
        <section ref={heroRef} className="hero-section">
          <div className="hero-copy-wrap">
            <p className="eyebrow">
              <span className="eyebrow-line" />
              <EditableText
                path="modern.hero.eyebrow"
                value={hero.eyebrow}
                placeholder="a small universe for you"
                maxLength={60}
              />
            </p>
            <h1 className="hero-title">
              {/*
                Three stored lines rather than one string. The middle one is the
                serif accent, and a caret cannot cross the tag boundary that
                makes it, so keeping them apart is what lets each be edited in
                place. The stored array is the same shape as the classic hero's
                for that reason.
              */}
              <EditableText
                as="span"
                className="word"
                path="modern.hero.lines.0"
                value={hero.lines[0] ?? ""}
                placeholder="You"
                maxLength={60}
              />{" "}
              <em>
                <EditableText
                  path="modern.hero.lines.1"
                  value={hero.lines[1] ?? ""}
                  placeholder="are"
                  maxLength={60}
                />
              </em>
              <br />
              <span className="word accent-word">
                <EditableText
                  path="modern.hero.lines.2"
                  value={hero.lines[2] ?? ""}
                  placeholder="my favorite place"
                  maxLength={60}
                />
              </span>
            </h1>
            <EditableText
              as="p"
              className="hero-copy"
              path="modern.hero.subline"
              value={hero.subline}
              placeholder="A little constellation of the moments that make us us."
              maxLength={300}
            />
            <div className="hero-actions">
              <button className="open-button" onClick={handleOpen}>
                <EditableText
                  path="modern.hero.ctaLabel"
                  value={hero.ctaLabel}
                  placeholder="Open your note"
                  maxLength={40}
                />{" "}
                <span aria-hidden="true">↗</span>
              </button>
              <a className="scroll-hint" href={paths.archive}>
                <span className="scroll-icon" aria-hidden="true">
                  ↓
                </span>
                <EditableText
                  path="modern.hero.scrollHint"
                  value={hero.scrollHint}
                  placeholder="drift through our archive"
                  maxLength={40}
                />
              </a>
            </div>
          </div>
          <div className="hero-orbit" aria-hidden="true">
            <div className="orbit-ring" />
            <div className="orbit-core">∞</div>
            <span className="orbit-label label-one">always</span>
            <span className="orbit-label label-two">and again</span>
          </div>
          <div className="hero-meta">
            <span>{site.identity.name || "for: my person"}</span>
            <span>from: still yours</span>
            <span>∞ / ∞</span>
          </div>
        </section>

        <section
          className={`letter-panel ${opened ? "is-open" : ""}`}
          aria-live="polite"
        >
          <div className="letter-kicker">
            <EditableText
              path="modern.letter.kicker"
              value={letter.kicker}
              placeholder="PRIVATE NOTE / UNSEALED"
              maxLength={60}
            />
          </div>
          <EditableText
            as="p"
            className="letter-text"
            multiline
            path="modern.letter.text"
            value={letter.text}
            placeholder="If I could keep one thing in a time capsule, it would be the feeling of finding you."
            maxLength={2000}
          />
          <EditableText
            as="p"
            className="letter-signoff"
            multiline
            path="modern.letter.signoff"
            value={letter.signoff}
            placeholder="Love you in every timeline. — me"
            maxLength={200}
          />
        </section>

        {/*
          The first break, between the letter and the strip.

          The letter is the longest single piece of reading on the page and it
          ends mid-thought. Going straight from it into another argument — the
          strip's heading and note — gave the reader no edge to stop on, so this
          sits between them as one: a band that moves while nothing else asks
          them to.
        */}
        <DriftBand memories={memories} />

        {/*
          The strip sits between the letter and the archive, on the reasoning that
          it is the page's texture: something to look at while reading, rather than
          something to read. The archive below it is where a photograph opens in
          full, which is why every slice is also a link there.
        */}
        <section className="strip-section reveal">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                <span className="eyebrow-line" />
                <EditableText
                  path="modern.strip.eyebrow"
                  value={strip.eyebrow}
                  placeholder="contact sheet"
                  maxLength={60}
                />
              </p>
              <EditableText
                as="h2"
                multiline
                path="modern.strip.heading"
                value={strip.heading}
                placeholder="Pick one. Stay a while."
                maxLength={120}
              />
            </div>
            <EditableText
              as="p"
              className="heading-note"
              multiline
              path="modern.strip.note"
              value={strip.note}
              placeholder="Use the arrows. Or just tap one."
              maxLength={200}
            />
          </div>

          {/*
            Empty is a real state, not an error. An author who has added moments
            but no photos still gets the strip's slots rather than a section that
            silently disappears, which would leave a heading with nothing under
            it.
          */}
          <PhotoStrip
            memories={memories}
            label={strip.eyebrow || "Photographs"}
            badge={
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 8l4 4 5-6 5 6 4-4" />
                <path d="M4 17h16" />
              </svg>
            }
          />
        </section>

        <section id="archive" className="archive-section reveal">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                <span className="eyebrow-line" />
                <EditableText
                  path="modern.archive.eyebrow"
                  value={archive.eyebrow}
                  placeholder="memory archive"
                  maxLength={60}
                />
              </p>
              <EditableText
                as="h2"
                multiline
                path="modern.archive.heading"
                value={archive.heading}
                placeholder="A few favorite signals."
                maxLength={120}
              />
            </div>
            <EditableText
              as="p"
              className="heading-note"
              multiline
              path="modern.archive.note"
              value={archive.note}
              placeholder="Drag the orbit. Every frame is ours."
              maxLength={200}
            />
          </div>
          <div className="gallery-frame">
            <SphereGallery3D
              images={galleryItems}
              branches={40}
              background="transparent"
              scale={57}
              size={32}
              scatter={9}
              speed={60}
              direction="counterclockwise"
              hover={150}
              rounded={20}
              core={{
                coreSize: 22,
                // Read from the theme, so the sphere's core is on-palette. See
                // AmbientField for why these are resolved rather than aliased.
                coreColor: `${cssColorNumber("gold-bright", 0xffb8cb).toString(16).padStart(6, "0")}66`,
                lineColor: `${cssColorNumber("purple", 0xa17baf).toString(16).padStart(6, "0")}4d`,
              }}
            />
          </div>
          {/*
            The rows are links, not static text. They preview the four memories
            on this page and the gallery is where each one opens in full, so a
            row that does nothing would be the most obvious dead end on the page.
          */}
          <div className="memory-index">
            {memories.map((memory, index) => (
              <a className="memory-row" href={paths.gallery} key={`${index}-${memory.label}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{memory.label}</strong>
                <small>{memory.caption}</small>
              </a>
            ))}
          </div>

          <div className="archive-more">
            <a className="open-button" href={paths.gallery}>
              <EditableText
                path="modern.archive.ctaLabel"
                value={archive.ctaLabel}
                placeholder="Open the full archive"
                maxLength={40}
              />{" "}
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>

        {/*
          The second break, before the close.

          The archive is the densest section on the page — a live 3D scene, an
          index of rows, a button — and the closing section asks the reader to
          stop and feel something. Going straight from one to the other meant the
          ending arrived while the archive was still in the eye. This is the
          quiet before it, and it restates the only thing on the page that is
          always true: whose it is, and how many signals came with it.
        */}
        <SignalInterlude
          name={site.identity.name || "ours"}
          count={memories.length}
        />

        <section className="closing-section reveal">
          <div className="closing-mark">
            O<span>+</span>Y
          </div>
          <p className="eyebrow">
            <span className="eyebrow-line" /> end of transmission
          </p>
          <EditableText
            as="h2"
            multiline
            path="modern.closing.heading"
            value={closing.heading}
            placeholder="Same team. Same orbit."
            maxLength={200}
          />
          <EditableText
            as="p"
            className="closing-copy"
            multiline
            path="modern.closing.copy"
            value={closing.copy}
            placeholder="No matter how far the signal travels, it always finds its way back to you."
            maxLength={500}
          />
          <div className="closing-signature">
            <EditableText
              path="modern.closing.signature"
              value={closing.signature}
              placeholder="with all my heart"
              maxLength={80}
            />{" "}
            <span aria-hidden="true">♡</span>
          </div>
        </section>
      </main>

      <footer className="footer">
        <span>Ours / 2026</span>
        <span>made with intent, not a template</span>
        <span>♡</span>
      </footer>

      <style>{`
                ${MODERN_FONT_IMPORT}
                ${MODERN_BASE_CSS}
                ${MODERN_INTERLUDE_CSS}

                .hero-section { min-height:calc(100vh - 84px); max-width:1400px; margin:auto; padding:12vh 8vw 10vh; position:relative; display:flex; align-items:center; }
                .hero-copy-wrap { max-width:730px; position:relative; z-index:2; }
                .hero-title { font-size:clamp(58px, 8.4vw, 132px); letter-spacing:-.08em; line-height:.88; margin:0; font-weight:700; }
                .hero-title em { font-family:'Playfair Display',serif; font-weight:500; letter-spacing:-.07em; color:var(--pink); }
                .accent-word { color:var(--theme-text, #eee4e7); }
                .hero-copy { max-width:430px; margin:39px 0 0 8px; color:var(--muted); line-height:1.7; font-size:14px; }
                .hero-copy strong { color:var(--pink); font-weight:500; }
                .hero-actions { display:flex; align-items:center; gap:24px; margin:38px 0 0 8px; }
                .open-button { border:1px solid var(--accent-edge); color:var(--ink); background:var(--accent-wash); padding:15px 18px; cursor:pointer; transition:.25s; }
                /* The hover pair swaps to the accent, so the label needs the
                   theme's own "text on accent" token — the old #1b0e18 was the
                   dark half of one specific palette and unreadable on another. */
                .open-button:hover { background:var(--pink); color:var(--theme-on-gold, #1b0e18); }
                .open-button span { margin-left:28px; color:var(--pink); }
                .open-button:hover span { color:var(--theme-on-gold, #1b0e18); }
                .scroll-hint { color:var(--muted); font-family:'DM Mono',monospace; font-size:10px; text-transform:uppercase; letter-spacing:.09em; }
                .hero-orbit { position:absolute; right:5vw; top:16%; width:min(34vw,460px); aspect-ratio:1; border-radius:50%; display:grid; place-items:center; opacity:.85; }
                .orbit-ring { position:absolute; inset:0; border:1px solid var(--theme-accent-line, rgba(255,184,203,.24)); border-radius:50%; box-shadow:0 0 90px var(--theme-accent-glow, rgba(255,111,156,.08)); }
                .orbit-ring:before,.orbit-ring:after { content:''; position:absolute; border-radius:50%; border:1px solid var(--theme-ring-alt, rgba(170,139,255,.32)); inset:12%; transform:rotate(55deg) skewX(-15deg); }
                .orbit-ring:after { inset:25%; transform:rotate(-35deg) skewX(18deg); border-color:var(--theme-accent-edge, rgba(255,184,203,.4)); }
                /* The orb's gradient is a whole token rather than four literals,
                   because it spans gold through purple to near-black and none of
                   those stops exist anywhere else in this template. */
                .orbit-core { width:23%; aspect-ratio:1; border-radius:50%; background:var(--theme-grad-orb, radial-gradient(circle at 35% 25%, #fff, var(--pink) 12%, #6f3975 43%, #171024 70%)); display:grid; place-items:center; font-family:'Playfair Display',serif; font-size:42px; color:var(--theme-on-gold, #190d1c); box-shadow:0 0 50px var(--theme-accent-glow, #ff6f9c66); }
                .orbit-label { position:absolute; color:var(--muted); font:10px 'DM Mono',monospace; text-transform:uppercase; letter-spacing:.14em; }
                .label-one { top:8%; right:8%; }
                .label-two { bottom:11%; left:3%; }
                .hero-meta { position:absolute; left:8vw; bottom:5vh; display:flex; gap:30px; color:var(--faint); font-family:'DM Mono',monospace; text-transform:uppercase; letter-spacing:.12em; font-size:10px; }

                .letter-panel { max-width:670px; margin:-20px auto 13vh; padding:42px 48px; border:1px solid var(--theme-accent-line, rgba(255,184,203,.24)); background:var(--theme-panel, rgba(20,13,25,.74)); backdrop-filter:blur(16px); transform:translateY(30px); opacity:0; }
                .letter-panel.is-open { opacity:1; transform:none; }
                .letter-kicker { color:var(--pink); margin-bottom:24px; font-family:'DM Mono',monospace; text-transform:uppercase; letter-spacing:.12em; font-size:10px; }
                .letter-text { font-family:'Playfair Display',serif; font-style:italic; font-size:clamp(25px,3vw,36px); line-height:1.28; margin:0; color:var(--ink); }
                .letter-signoff { color:var(--muted); line-height:1.6; margin-bottom:0; }
                .letter-signoff span { color:var(--pink); font-family:'Playfair Display',serif; font-size:22px; }

                .strip-section { padding:14vh 0 4vh; }
                .strip-section .section-heading { max-width:1220px; margin:0 auto 44px; padding:0 5vw; }

                .archive-section { max-width:1220px; margin:0 auto; padding:15vh 5vw; }
                .section-heading { display:flex; justify-content:space-between; align-items:end; margin-bottom:60px; }
                .heading-note { color:var(--faint); text-align:right; line-height:1.7; font-family:'DM Mono',monospace; text-transform:uppercase; letter-spacing:.12em; font-size:10px; }
                .gallery-frame { height:clamp(430px,56vw,660px); border:0; background:transparent; overflow:hidden; position:relative; box-shadow:none; }
                .gallery-frame > div { min-width:0 !important; min-height:0 !important; }
                .memory-index { display:grid; grid-template-columns:repeat(4,1fr); border-left:1px solid var(--line); border-bottom:1px solid var(--line); }
                .memory-row {
                  padding:20px 14px; border-right:1px solid var(--line);
                  display:flex; flex-direction:column; gap:8px;
                  /* A link, so it needs the anchor affordances back. */
                  color:inherit; transition:background .25s, border-bottom-color .25s;
                }
                .memory-row:hover { background:var(--theme-accent-wash-2, rgba(255,184,203,.05)); border-bottom-color:var(--pink); }
                .memory-row span { color:var(--pink); font-family:'DM Mono',monospace; text-transform:uppercase; letter-spacing:.12em; font-size:10px; }
                .memory-row strong { font-family:'Manrope',sans-serif; text-transform:none; letter-spacing:0; font-size:13px; }
                .memory-row small { color:var(--faint); text-transform:none; letter-spacing:0; font:12px/1.45 'Manrope',sans-serif; }

                /* Centre the link under the index rather than letting it sit flush. */
                .archive-more { display:flex; justify-content:center; margin-top:44px; }

                .closing-section { max-width:1100px; text-align:center; padding:12vh 5vw 18vh; margin:auto; }
                .closing-mark { color:var(--pink); font:500 46px 'Playfair Display',serif; margin-bottom:44px; }
                .closing-mark span { color:var(--hot); font:24px 'DM Mono',monospace; }
                .closing-section .eyebrow { justify-content:center; }
                .closing-section h2 { margin:30px 0; }
                .closing-copy { max-width:360px; margin:auto; color:var(--muted); font-size:14px; line-height:1.7; }
                .closing-signature { color:var(--pink); font:italic 21px 'Playfair Display',serif; margin-top:36px; }
                .closing-signature span { font-style:normal; font-size:30px; margin-left:10px; }

                @media (max-width:760px) {
                  .hero-section { padding:12vh 8vw 16vh; min-height:auto; display:block; }
                  .hero-orbit { position:relative; right:auto; top:auto; width:70vw; margin:70px auto 0; }
                  .hero-meta { position:relative; left:auto; bottom:auto; margin-top:48px; flex-wrap:wrap; gap:12px 22px; }
                  .hero-actions { align-items:flex-start; flex-direction:column; }
                  .letter-panel { margin:0 8vw 12vh; padding:28px 24px; }
                  .section-heading { align-items:flex-start; flex-direction:column; gap:24px; }
                  .heading-note { text-align:left; }
                  .memory-index { grid-template-columns:repeat(2,1fr); }
                }
            `}</style>
    </div>
  );
}
