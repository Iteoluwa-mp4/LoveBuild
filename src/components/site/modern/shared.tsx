import { useEffect, useRef } from "react";
import * as THREE from "three";

import type { GalleryItem } from "../../originkit/ui/sphere-gallery-3d";
import type { ModernMemory } from "../../../lib/site/derive";
import type { ModernPaths } from "./paths";
import { cssColorNumber } from "../classic/ornaments/themeColor";

/**
 * Pieces shared by the modern template's pages.
 *
 * The home page and the gallery are two views of one site, so the tokens, the
 * starfield, the wordmark and the memory data are defined once here rather than
 * copied. Copying them is how the two pages quietly drift into looking like
 * different sites.
 *
 * `MODERN_BASE_CSS` is emitted by each page. It is the reset plus the pieces
 * above, and every page adds only its own sections on top.
 */

/**
 * Just the bits the sphere needs.
 *
 * Takes the site's moments rather than importing its own, so the modern
 * template shows the same photographs the classic one does and a template
 * switch cannot strand an upload. See `modernMemories` in `derive.ts`.
 *
 * `link` is only ever an empty string here, so it is set rather than spread.
 * With `exactOptionalPropertyTypes` on, passing `undefined` to an optional
 * `string` is not allowed, and mapping `link` straight through produced
 * `string | undefined` the moment `ModernMemory` had no `link` field.
 */
export const sphereItems = (memories: ModernMemory[]): GalleryItem[] =>
  memories.map((m) => ({ ...m, link: "" }));

/**
 * The drifting starfield behind everything.
 *
 * `alpha: true` and no clear colour, so the page's own gradient shows through.
 */
export function AmbientField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.z = 8;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(900 * 3);
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] = (Math.random() - 0.5) * 18;
      positions[i + 1] = (Math.random() - 0.5) * 11;
      positions[i + 2] = (Math.random() - 0.5) * 13;
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    /*
      Reads the accent from the published tokens rather than repeating the
      template's old hardcoded pink.

      three.js wants a number and CSS custom properties are strings, so this
      cannot be `var(--pink)`. `cssColorNumber` resolves the computed value,
      which is what keeps the starfield on-theme when the palette changes —
      with a fallback so the field still renders if the token is missing.
    */
    const material = new THREE.PointsMaterial({
      color: cssColorNumber("gold-bright", 0xffb8cb),
      size: 0.018,
      transparent: true,
      opacity: 0.58,
    });
    const stars = new THREE.Points(geometry, material);
    scene.add(stars);
    const clock = new THREE.Clock();
    let frame = 0;
    const resize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const animate = () => {
      const t = clock.getElapsedTime();
      stars.rotation.y = t * 0.012;
      stars.rotation.x = Math.sin(t * 0.09) * 0.04;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    resize();
    animate();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="ambient-field" aria-hidden="true" />
  );
}

/** Where each page is, and the signal's status line. */
export function TopBar({
  active,
  status,
  paths,
}: {
  active: "home" | "gallery";
  status: string;
  /** Derived in `paths.ts`, never written out here. */
  paths: ModernPaths;
}) {
  return (
    <header className="topbar">
      <a className="wordmark" href={paths.home} aria-label="Ours home">
        <span>O</span>URS<span className="wordmark-dot">.</span>
      </a>
      <nav className="topnav" aria-label="Sections">
        <a href={paths.home} aria-current={active === "home" ? "page" : undefined}>
          home
        </a>
        <a
          href={paths.gallery}
          aria-current={active === "gallery" ? "page" : undefined}
        >
          archive
        </a>
      </nav>
      <div className="status">
        <i /> {status}
      </div>
    </header>
  );
}

export function ModernFooter() {
  return (
    <footer className="footer">
      <span>Ours / 2026</span>
      <span>made with intent, not a template</span>
      <span>♡</span>
    </footer>
  );
}

/**
 * Tokens, reset, and the chrome every page shares.
 *
 * Emitted as a string rather than a stylesheet import because the colours are
 * also read as values here — the gallery uses `--bg` when it needs to paint
 * something opaque, so a second source of truth would only be a chance to
 * disagree.
 */
export const MODERN_BASE_CSS = `
:root {
  /*
    Aliased, not hardcoded.

    Every colour below used to be a literal here — one pink, propagated into
    thirty rgba() values across both pages and into the WebGL core colour. The
    aliases below are what let a palette change reach this template: the page
    keeps its own vocabulary, but every value now resolves to the active theme.

    The mapping is role-for-role, not literal-for-literal. The accent alias
    takes goldBright, the hotter accent takes gold, and the page ground
    takes void.

    Each has a fallback because these tokens are published by SiteShell onto
    <html>, and a themed fragment rendered on its own — the dev screens, a
    future partial — must not collapse to transparent.
  */
  --ink: var(--theme-text, #f7f2f3);
  --muted: var(--theme-dim, #aaa0aa);
  --faint: var(--theme-faint, #837887);
  --pink: var(--theme-gold-bright, #ffb8cb);
  --hot: var(--theme-gold, #ff6f9c);
  --violet: var(--theme-lavender, #aa8bff);
  --bg: var(--theme-void, #090810);
  --tint: var(--theme-ink, #21132b);
  --line: var(--theme-line, rgba(255,255,255,.1));
  /* The tints of the accent that used to be written out by hand. */
  --accent-edge: var(--theme-accent-edge, rgba(255,184,203,.75));
  --accent-wash: var(--theme-accent-wash, rgba(255,184,203,.08));
}
* { box-sizing:border-box; }
html { scroll-behavior:smooth; }
body { margin:0; background:var(--bg); color:var(--ink); font-family:'Manrope',sans-serif; }
button, a { font:inherit; }
a { color:inherit; text-decoration:none; }

.site-shell {
  min-height:100vh;
  overflow:hidden;
  background:radial-gradient(circle at 70% 12%, var(--tint) 0, transparent 32%), var(--bg);
  position:relative;
  /* This template's own ground, so it does not depend on the shell's class. */
  color:var(--ink);
  font-family:'Manrope',sans-serif;
}
.ambient-field { position:fixed; inset:0; width:100%; height:100%; opacity:.75; pointer-events:none; z-index:0; }
.grain {
  position:fixed; inset:0; opacity:.07; pointer-events:none; z-index:2;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.35'/%3E%3C/svg%3E");
}
.topbar, main, .footer { position:relative; z-index:3; }
.topbar { display:flex; justify-content:space-between; align-items:center; padding:30px 5vw; border-bottom:1px solid var(--line); }
.wordmark { font-size:20px; font-weight:800; letter-spacing:.24em; }
.wordmark span:first-child { color:var(--pink); }
.wordmark-dot { color:var(--hot); }

.topnav { display:flex; gap:26px; }
.topnav a {
  font-family:'DM Mono',monospace; text-transform:uppercase;
  letter-spacing:.14em; font-size:10px; color:var(--faint);
  padding-bottom:2px; border-bottom:1px solid transparent; transition:.25s;
}
.topnav a:hover { color:var(--ink); }
.topnav a[aria-current='page'] { color:var(--pink); border-bottom-color:var(--pink); }

.status { color:var(--muted); }
/*
  The status dot is green in every palette, and deliberately so: it means
  "this site is live", not "this is an accent". A theme that recoloured it
  would be making a claim about the design that the author never asked for.
*/
.status i { display:inline-block; width:6px; height:6px; border-radius:50%; background:#74e0ad; margin-right:8px; box-shadow:0 0 14px #74e0ad; }

.eyebrow {
  display:flex; align-items:center; gap:12px;
  font-family:'DM Mono',monospace; text-transform:uppercase;
  letter-spacing:.12em; font-size:10px;
  color:var(--pink); margin:0 0 25px;
}
.eyebrow-line { width:35px; height:1px; display:inline-block; background:var(--pink); }

.hero-title, h2 { font-size:clamp(48px,6.5vw,96px); letter-spacing:-.08em; line-height:.88; margin:0; font-weight:700; }
.hero-title em, h2 em { font-family:'Playfair Display',serif; font-weight:500; letter-spacing:-.07em; color:var(--pink); }

.mono {
  font-family:'DM Mono',monospace; text-transform:uppercase;
  letter-spacing:.12em; font-size:10px;
}

.scroll-icon {
  display:inline-flex; justify-content:center; align-items:center;
  border:1px solid var(--faint); width:26px; height:26px; border-radius:50%; margin-right:8px;
}

.footer { padding:24px 5vw; display:flex; justify-content:space-between; color:var(--faint); border-top:1px solid var(--line); font-family:'DM Mono',monospace; text-transform:uppercase; letter-spacing:.12em; font-size:10px; }

@media (max-width:760px) {
  .topbar { padding:24px 6vw; }
  .status { display:none; }
  .footer { font-size:8px; gap:12px; }
  .footer span:nth-child(2) { display:none; }
}
`;

/** The webfont load. Kept together so both pages request the same set. */
export const MODERN_FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,500;0,600;1,500;1,600&display=swap');"