import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SphereGallery3D from "../../originkit/ui/sphere-gallery-3d";
import PhotoStrip from "./PhotoStrip";
import {
  AmbientField,
  MEMORIES,
  MODERN_BASE_CSS,
  MODERN_FONT_IMPORT,
  TopBar,
  sphereItems,
} from "./shared";
import { modernPaths } from "./paths";

gsap.registerPlugin(ScrollTrigger);

/** The archive's memories. Shared with the gallery page so the two agree. */
const memories = MEMORIES;

export default function ModernTemplate() {
  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const [opened, setOpened] = useState(false);
  const galleryItems = useMemo(() => sphereItems(), []);
  const paths = useMemo(() => modernPaths(), []);

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
              <span className="eyebrow-line" /> a small universe for you
            </p>
            <h1 className="hero-title">
              <span className="word">You</span> <em>are</em>
              <br />
              <span className="word accent-word">my favorite</span>
              <br />
              <span className="word">place.</span>
            </h1>
            <p className="hero-copy">
              A little constellation of the moments, frequencies, and quiet
              magic that make us <strong>us</strong>.
            </p>
            <div className="hero-actions">
              <button className="open-button" onClick={handleOpen}>
                Open your note <span>↗</span>
              </button>
              <a className="scroll-hint" href={paths.archive}>
                <span className="scroll-icon">↓</span> drift through our archive
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
            <span>for: my person</span>
            <span>from: still yours</span>
            <span>∞ / ∞</span>
          </div>
        </section>

        <section
          className={`letter-panel ${opened ? "is-open" : ""}`}
          aria-live="polite"
        >
          <div className="letter-kicker">PRIVATE NOTE / UNSEALED</div>
          <p className="letter-text">
            If I could keep one thing in a time capsule, it would be the feeling
            of finding you. Thank you for making ordinary days feel like they
            have a secret frequency.
          </p>
          <p className="letter-signoff">
            Love you in every timeline.
            <br />
            <span>— me</span>
          </p>
        </section>

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
                <span className="eyebrow-line" /> contact sheet
              </p>
              <h2>
                Pick one. <em>Stay a while.</em>
              </h2>
            </div>
            <p className="heading-note">
              Use the arrows.
              <br />
              Or just tap one.
            </p>
          </div>

          <PhotoStrip
            memories={memories}
            label="Contact sheet"
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
                <span className="eyebrow-line" /> memory archive
              </p>
              <h2>
                A few favorite <em>signals.</em>
              </h2>
            </div>
            <p className="heading-note">
              Drag the orbit.
              <br />
              Every frame is ours.
            </p>
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
                coreColor: "#ffb8d466",
                lineColor: "#a17baf4d",
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
              <a className="memory-row" href={paths.gallery} key={memory.label}>
                <span>0{index + 1}</span>
                <strong>{memory.label}</strong>
                <small>{memory.caption}</small>
              </a>
            ))}
          </div>

          <div className="archive-more">
            <a className="open-button" href={paths.gallery}>
              Open the full archive <span>↗</span>
            </a>
          </div>
        </section>

        <section className="closing-section reveal">
          <div className="closing-mark">
            O<span>+</span>Y
          </div>
          <p className="eyebrow">
            <span className="eyebrow-line" /> end of transmission
          </p>
          <h2>
            Same team.
            <br />
            <em>Same orbit.</em>
          </h2>
          <p className="closing-copy">
            No matter how far the signal travels, it always finds its way back
            to you.
          </p>
          <div className="closing-signature">
            with all my heart <span>♡</span>
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

                .hero-section { min-height:calc(100vh - 84px); max-width:1400px; margin:auto; padding:12vh 8vw 10vh; position:relative; display:flex; align-items:center; }
                .hero-copy-wrap { max-width:730px; position:relative; z-index:2; }
                .hero-title { font-size:clamp(58px, 8.4vw, 132px); letter-spacing:-.08em; line-height:.88; margin:0; font-weight:700; }
                .hero-title em { font-family:'Playfair Display',serif; font-weight:500; letter-spacing:-.07em; color:var(--pink); }
                .accent-word { color:#eee4e7; }
                .hero-copy { max-width:430px; margin:39px 0 0 8px; color:var(--muted); line-height:1.7; font-size:14px; }
                .hero-copy strong { color:var(--pink); font-weight:500; }
                .hero-actions { display:flex; align-items:center; gap:24px; margin:38px 0 0 8px; }
                .open-button { border:1px solid rgba(255,184,203,.75); color:var(--ink); background:rgba(255,184,203,.08); padding:15px 18px; cursor:pointer; transition:.25s; }
                .open-button:hover { background:var(--pink); color:#1b0e18; }
                .open-button span { margin-left:28px; color:var(--pink); }
                .open-button:hover span { color:#1b0e18; }
                .scroll-hint { color:var(--muted); font-family:'DM Mono',monospace; font-size:10px; text-transform:uppercase; letter-spacing:.09em; }
                .hero-orbit { position:absolute; right:5vw; top:16%; width:min(34vw,460px); aspect-ratio:1; border-radius:50%; display:grid; place-items:center; opacity:.85; }
                .orbit-ring { position:absolute; inset:0; border:1px solid rgba(255,184,203,.24); border-radius:50%; box-shadow:0 0 90px rgba(255,111,156,.08); }
                .orbit-ring:before,.orbit-ring:after { content:''; position:absolute; border-radius:50%; border:1px solid rgba(170,139,255,.32); inset:12%; transform:rotate(55deg) skewX(-15deg); }
                .orbit-ring:after { inset:25%; transform:rotate(-35deg) skewX(18deg); border-color:rgba(255,184,203,.4); }
                .orbit-core { width:23%; aspect-ratio:1; border-radius:50%; background:radial-gradient(circle at 35% 25%, #fff, var(--pink) 12%, #6f3975 43%, #171024 70%); display:grid; place-items:center; font-family:'Playfair Display',serif; font-size:42px; color:#190d1c; box-shadow:0 0 50px #ff6f9c66; }
                .orbit-label { position:absolute; color:var(--muted); font:10px 'DM Mono',monospace; text-transform:uppercase; letter-spacing:.14em; }
                .label-one { top:8%; right:8%; }
                .label-two { bottom:11%; left:3%; }
                .hero-meta { position:absolute; left:8vw; bottom:5vh; display:flex; gap:30px; color:#746b78; font-family:'DM Mono',monospace; text-transform:uppercase; letter-spacing:.12em; font-size:10px; }

                .letter-panel { max-width:670px; margin:-20px auto 13vh; padding:42px 48px; border:1px solid rgba(255,184,203,.24); background:rgba(20,13,25,.74); backdrop-filter:blur(16px); transform:translateY(30px); opacity:0; }
                .letter-panel.is-open { opacity:1; transform:none; }
                .letter-kicker { color:var(--pink); margin-bottom:24px; font-family:'DM Mono',monospace; text-transform:uppercase; letter-spacing:.12em; font-size:10px; }
                .letter-text { font-family:'Playfair Display',serif; font-style:italic; font-size:clamp(25px,3vw,36px); line-height:1.28; margin:0; color:#f3e8eb; }
                .letter-signoff { color:var(--muted); line-height:1.6; margin-bottom:0; }
                .letter-signoff span { color:var(--pink); font-family:'Playfair Display',serif; font-size:22px; }

                .strip-section { padding:14vh 0 4vh; }
                .strip-section .section-heading { max-width:1220px; margin:0 auto 44px; padding:0 5vw; }

                .archive-section { max-width:1220px; margin:0 auto; padding:15vh 5vw; }
                .section-heading { display:flex; justify-content:space-between; align-items:end; margin-bottom:60px; }
                .heading-note { color:#837887; text-align:right; line-height:1.7; font-family:'DM Mono',monospace; text-transform:uppercase; letter-spacing:.12em; font-size:10px; }
                .gallery-frame { height:clamp(430px,56vw,660px); border:0; background:transparent; overflow:hidden; position:relative; box-shadow:none; }
                .gallery-frame > div { min-width:0 !important; min-height:0 !important; }
                .memory-index { display:grid; grid-template-columns:repeat(4,1fr); border-left:1px solid var(--line); border-bottom:1px solid var(--line); }
                .memory-row {
                  padding:20px 14px; border-right:1px solid var(--line);
                  display:flex; flex-direction:column; gap:8px;
                  /* A link, so it needs the anchor affordances back. */
                  color:inherit; transition:background .25s, border-bottom-color .25s;
                }
                .memory-row:hover { background:rgba(255,184,203,.05); border-bottom-color:var(--pink); }
                .memory-row span { color:var(--pink); font-family:'DM Mono',monospace; text-transform:uppercase; letter-spacing:.12em; font-size:10px; }
                .memory-row strong { font-family:'Manrope',sans-serif; text-transform:none; letter-spacing:0; font-size:13px; }
                .memory-row small { color:#837887; text-transform:none; letter-spacing:0; font:12px/1.45 'Manrope',sans-serif; }

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
