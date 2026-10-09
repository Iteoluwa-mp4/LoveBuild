import { useEffect, useRef } from "react";
import * as THREE from "three";

import type { GalleryItem } from "../../originkit/ui/sphere-gallery-3d";
import type { ModernPaths } from "./paths";

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

export type Memory = GalleryItem & {
  label: string;
  caption: string;
  /** Shown in the gallery's expanded index. */
  note: string;
};

/**
 * Builds a memory frame.
 *
 * The artwork is a generated SVG rather than a photograph, so the page has
 * something to show without shipping anyone else's pictures. The gradient stops
 * and the dark base are passed in so each frame keeps the palette.
 */
export const makeMemory = (
  label: string,
  caption: string,
  note: string,
  start: string,
  end: string,
  number: string,
): Memory => ({
  label,
  caption,
  note,
  image: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='900' height='640' viewBox='0 0 900 640'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop stop-color='%23${start}'/%3E%3Cstop offset='1' stop-color='%23${end}'/%3E%3C/linearGradient%3E%3Cfilter id='blur'%3E%3CfeGaussianBlur stdDeviation='42'/%3E%3C/filter%3E%3C/defs%3E%3Crect width='900' height='640' fill='%23090814'/%3E%3Ccircle cx='170' cy='150' r='170' fill='%23${start}' opacity='.42' filter='url(%23blur)'/%3E%3Ccircle cx='720' cy='500' r='240' fill='%23${end}' opacity='.34' filter='url(%23blur)'/%3E%3Cpath d='M0 500 C230 360 390 690 900 300 L900 640 L0 640Z' fill='url(%23g)' opacity='.54'/%3E%3Ctext x='72' y='108' font-family='Arial,sans-serif' font-size='22' letter-spacing='5' fill='white' opacity='.74'%3E${label.toUpperCase()}%3E/text%3E%3Ctext x='72' y='565' font-family='Arial,sans-serif' font-size='120' font-weight='700' fill='white' opacity='.94'%3E${number}%3E/text%3E%3C/svg%3E`,
  link: "",
});

export const MEMORIES: Memory[] = [
  makeMemory(
    "first orbit",
    "The night everything quietly changed.",
    "Before this, the whole thing was hypothetical. Afterwards it had a date on it.",
    "ff5e86",
    "6e3bff",
    "01",
  ),
  makeMemory(
    "soft launch",
    "Coffee, rain, and a two-hour goodbye.",
    "Neither of us mentioned the train. Both of us noticed it was late.",
    "fa8d68",
    "ffcf70",
    "02",
  ),
  makeMemory(
    "our frequency",
    "Somehow, we always find the same song.",
    "Four playlists, three years, one song on both of ours.",
    "3a71ff",
    "43d8bd",
    "03",
  ),
  makeMemory(
    "future file",
    "Still my favorite place to be is next to you.",
    "Nothing exotic in this one. Just the ordinary version, which is the point.",
    "a15cff",
    "ff6aa5",
    "04",
  ),
];

/**
 * Just the bits the sphere needs.
 *
 * `link` is only ever an empty string here, so it is spread rather than passed
 * as `{ link }`. With `exactOptionalPropertyTypes` on, passing a `string` to an
 * optional `string` is fine but passing `undefined` is not, and mapping
 * `link` directly produced `string | undefined` the moment `Memory['link']` was
 * left off a record.
 */
export const sphereItems = (): GalleryItem[] => MEMORIES.map((m) => ({ ...m }));

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
    const material = new THREE.PointsMaterial({
      color: 0xffb8cb,
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
  --ink:#f7f2f3;
  --muted:#aaa0aa;
  --faint:#837887;
  --pink:#ffb8cb;
  --hot:#ff6f9c;
  --violet:#aa8bff;
  --bg:#090810;
  --tint:#21132b;
  --line:rgba(255,255,255,.1);
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
  border:1px solid #716776; width:26px; height:26px; border-radius:50%; margin-right:8px;
}

.footer { padding:24px 5vw; display:flex; justify-content:space-between; color:#6f6572; border-top:1px solid var(--line); font-family:'DM Mono',monospace; text-transform:uppercase; letter-spacing:.12em; font-size:10px; }

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