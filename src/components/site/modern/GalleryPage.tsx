import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import SphereGallery3D from "../../originkit/ui/sphere-gallery-3d";
import {
  AmbientField,
  MEMORIES,
  MODERN_BASE_CSS,
  MODERN_FONT_IMPORT,
  ModernFooter,
  TopBar,
  sphereItems,
} from "./shared";
import { modernPaths } from "./paths";

gsap.registerPlugin(ScrollTrigger);

/**
 * The modern template's gallery.
 *
 * A separate page rather than a section of the home page, because the archive is
 * the thing people come back to: the home page sells the idea, this is where the
 * memories actually live.
 *
 * Everything visual comes from `modern/shared.tsx` — the same tokens, starfield,
 * grain and type scale the home page uses. The look of this template is one
 * system, so the second page cannot be allowed to invent its own.
 *
 * The sphere is the same component and the same settings as the home page's, so
 * the archive reads as the same object seen from further out rather than as a
 * second gallery.
 */
export default function ModernGallery() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);

  const items = useMemo(() => sphereItems(), []);
  const paths = useMemo(() => modernPaths(), []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".archive-lead .eyebrow, .archive-lead .word, .archive-lead .lead-copy, .archive-lead .count", {
        y: 24,
        opacity: 0,
        duration: 0.9,
        stagger: 0.08,
        ease: "power3.out",
        delay: 0.15,
      });

      gsap.from(".gallery-frame", {
        y: 60,
        opacity: 0,
        duration: 1.2,
        ease: "power3.out",
        delay: 0.35,
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

  /** The memory currently opened in the detail panel. */
  const current = active === null ? null : MEMORIES[active];

  return (
    <div ref={rootRef} className="site-shell">
      <AmbientField />
      <div className="grain" />
      <TopBar active="gallery" status="archive open / 04 signals" paths={paths} />

      <main id="top">
        <section className="archive-lead">
          <p className="eyebrow">
            <span className="eyebrow-line" /> the complete archive
          </p>
          <h1 className="archive-title">
            <span className="word">Every</span> <em>orbit</em>
            <br />
            <span className="word">we ever</span>
            <br />
            <span className="word accent-word">ran.</span>
          </h1>
          <div className="lead-foot">
            <p className="lead-copy">
              Four signals, kept in order. Drag the sphere, or open any one of
              them below for the longer version.
            </p>
            <span className="count mono">
              {String(MEMORIES.length).padStart(2, "0")} / total
            </span>
          </div>
        </section>

        <section className="archive-section">
          <div className="gallery-frame">
            <SphereGallery3D
              images={items}
              branches={22}
              /*
                Transparent on purpose. The canvas sits over the page's own
                radial gradient, and clearing to alpha 0 is what lets that show
                through instead of the gallery looking like its own surface.
              */
              background="transparent"
              scale={57}
              size={24}
              scatter={9}
              speed={13}
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
        </section>

        <section className="archive-index reveal">
          <div className="memory-index">
            {MEMORIES.map((memory, index) => (
              <button
                key={memory.label}
                type="button"
                className="memory-row"
                aria-expanded={active === index}
                onClick={() => setActive(active === index ? null : index)}
              >
                <span className="mono">{String(index + 1).padStart(2, "0")}</span>
                <strong>{memory.label}</strong>
                <small>{memory.caption}</small>
                <span className="row-toggle mono" aria-hidden="true">
                  {active === index ? "close" : "open"}
                </span>
              </button>
            ))}
          </div>
        </section>

        {current && (
          <section className="memory-detail" aria-live="polite">
            <figure>
              <img src={current.image} alt={current.caption} />
              <figcaption>
                <span className="mono">
                  signal {String((active ?? 0) + 1).padStart(2, "0")}
                </span>
                <strong>{current.label}</strong>
              </figcaption>
            </figure>
            <div className="detail-copy">
              <h2>{current.label}</h2>
              <p className="detail-caption">{current.caption}</p>
              <p className="detail-note">{current.note}</p>
              <button
                type="button"
                className="close-detail"
                onClick={() => setActive(null)}
              >
                back to the archive <span>↙</span>
              </button>
            </div>
          </section>
        )}

        <section className="closing-section reveal">
          <div className="closing-mark">
            O<span>+</span>Y
          </div>
          <p className="eyebrow">
            <span className="eyebrow-line" /> end of archive
          </p>
          <h2>
            That is
            <br />
            <em>all of it.</em>
          </h2>
          <p className="closing-copy">
            Nothing is hidden. Nothing is on a timer. Go back as often as you
            like.
          </p>
          <a className="open-button" href={paths.home}>
            Return home <span>↗</span>
          </a>
        </section>
      </main>

      <ModernFooter />

      <style>{`
                ${MODERN_FONT_IMPORT}
                ${MODERN_BASE_CSS}

                .archive-lead {
                  max-width:1400px; margin:auto; padding:14vh 8vw 8vh;
                  display:flex; flex-direction:column; min-height:74svh; justify-content:center;
                }
                .archive-title { font-size:clamp(58px,8.4vw,132px); letter-spacing:-.08em; line-height:.88; margin:0; font-weight:700; }
                .archive-title em { font-family:'Playfair Display',serif; font-weight:500; letter-spacing:-.07em; color:var(--pink); }
                .accent-word { color:#eee4e7; }
                .lead-foot { display:flex; align-items:flex-end; justify-content:space-between; gap:32px; margin:44px 0 0 8px; flex-wrap:wrap; }
                .lead-copy { max-width:420px; margin:0; color:var(--muted); line-height:1.7; font-size:14px; }
                .count { color:var(--pink); }

                .archive-section { max-width:1220px; margin:0 auto; padding:0 5vw 10vh; }
                .gallery-frame {
                  height:clamp(430px,56vw,660px);
                  background:transparent; overflow:hidden; position:relative;
                  box-shadow:none; border:0;
                }
                /*
                  The sphere sets a 1200x800 floor on its own host so the WebGL
                  viewport is always large enough. Overridden here so the frame
                  takes its height from the layout instead.
                */
                .gallery-frame > div { min-width:0 !important; min-height:0 !important; }

                .archive-index { max-width:1220px; margin:0 auto; padding:0 5vw 14vh; }
                .memory-index {
                  display:grid; grid-template-columns:repeat(4,1fr);
                  border-left:1px solid var(--line); border-top:1px solid var(--line);
                }
                .memory-row {
                  position:relative; text-align:left; cursor:pointer;
                  background:none; border:0; border-right:1px solid var(--line); border-bottom:1px solid var(--line);
                  padding:20px 14px 34px; display:flex; flex-direction:column; gap:8px;
                  transition:background .25s, border-color .25s;
                }
                .memory-row:hover { background:rgba(255,184,203,.05); }
                .memory-row[aria-expanded='true'] { background:rgba(255,184,203,.09); border-bottom-color:var(--pink); }
                .memory-row > span:first-child { color:var(--pink); }
                .memory-row strong { font-family:'Manrope',sans-serif; text-transform:none; letter-spacing:0; font-size:13px; font-weight:700; }
                .memory-row small { color:var(--faint); text-transform:none; letter-spacing:0; font:12px/1.45 'Manrope',sans-serif; }
                .row-toggle { color:var(--faint); }
                .memory-row[aria-expanded='true'] .row-toggle { color:var(--pink); }

                .memory-detail {
                  max-width:1220px; margin:0 auto; padding:0 5vw 16vh;
                  display:grid; gap:clamp(24px,4vw,56px); align-items:center;
                  grid-template-columns:1fr;
                  animation:detailIn .5s ease-out;
                }
                .memory-detail figure { margin:0; border:1px solid var(--line); overflow:hidden; background:var(--bg); }
                .memory-detail img { display:block; width:100%; height:auto; }
                .memory-detail figcaption { display:flex; align-items:baseline; gap:14px; padding:14px 16px; border-top:1px solid var(--line); }
                .memory-detail figcaption span { color:var(--pink); }
                .memory-detail figcaption strong { font-family:'Manrope',sans-serif; font-size:13px; letter-spacing:0; text-transform:none; }

                .detail-copy h2 { font-size:clamp(32px,4vw,58px); letter-spacing:-.06em; line-height:1; margin:0 0 20px; }
                .detail-caption { font-family:'Playfair Display',serif; font-style:italic; font-size:clamp(19px,2vw,25px); line-height:1.4; color:#f3e8eb; margin:0 0 18px; }
                .detail-note { color:var(--muted); font-size:14px; line-height:1.7; max-width:44ch; margin:0 0 30px; }

                .close-detail {
                  display:inline-flex; align-items:center; gap:26px;
                  border:1px solid rgba(255,184,203,.75); color:var(--ink);
                  background:rgba(255,184,203,.08); padding:15px 18px;
                  cursor:pointer; transition:.25s; font:inherit;
                }
                .close-detail:hover { background:var(--pink); color:#1b0e18; }
                .close-detail span { color:var(--pink); }
                .close-detail:hover span { color:#1b0e18; }

                .closing-section {
                  max-width:1100px; text-align:center; padding:12vh 5vw 18vh; margin:auto;
                  border-top:1px solid var(--line);
                }
                .closing-mark { color:var(--pink); font:500 46px 'Playfair Display',serif; margin-bottom:44px; }
                .closing-mark span { color:var(--hot); font:24px 'DM Mono',monospace; }
                .closing-section .eyebrow { justify-content:center; }
                .closing-section h2 { margin:30px 0; }
                .closing-copy { max-width:360px; margin:auto auto 36px; color:var(--muted); font-size:14px; line-height:1.7; }

                .open-button {
                  display:inline-block;
                  border:1px solid rgba(255,184,203,.75); color:var(--ink);
                  background:rgba(255,184,203,.08); padding:15px 18px;
                  cursor:pointer; transition:.25s; font:inherit;
                }
                .open-button:hover { background:var(--pink); color:#1b0e18; }
                .open-button span { margin-left:26px; color:var(--pink); }
                .open-button:hover span { color:#1b0e18; }

                @keyframes detailIn { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:none; } }

                @media (min-width:900px) {
                  .memory-detail { grid-template-columns:1.05fr .95fr; }
                }

                @media (max-width:760px) {
                  .archive-lead { padding:12vh 8vw 8vh; min-height:auto; }
                  .lead-foot { margin-top:34px; }
                  .memory-index { grid-template-columns:repeat(2,1fr); }
                  .memory-detail { padding-bottom:12vh; }
                  .archive-section { padding-bottom:6vh; }
                  .archive-index { padding-bottom:10vh; }
                }
            `}</style>
    </div>
  );
}