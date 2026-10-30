import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

import { cssColorNumber } from "./themeColor";

/**
 * HeartDiamond
 *
 * A gold, heart-cut diamond rendered with three.js inside a React component.
 * No react-three-fiber — raw three.js in a useEffect, so it drops into any TSX
 * project.
 *
 * Transparent background, a small eased lean toward the pointer and nothing
 * else (never blocks page scrolling). The gem is a real heart-cut stone built
 * from scratch — a flat front table, a sloped crown, a wide girdle ring and a
 * pointed pavilion behind — so it has the table/crown/pavilion silhouette of a
 * cut diamond rather than a puffy slab. It is polished metallic gold, so every
 * facet mirrors the environment and the lean sends crisp highlights sweeping
 * across the surface. Rendered without postprocessing so the canvas keeps its
 * alpha over the page gradient.
 *
 * It carries no sparkle field. There was one — 260 additive points twinkling in a
 * shell around the gem — and it was the wrong effect here twice over: it read as
 * glitter rather than as a cut stone, and the drifting gold particles already
 * on the page behind it did the same job at the right scale. The gem is now the
 * only lit object in the frame.
 *
 * Colours are read from the active theme rather than hardcoded, so the gem
 * belongs to whatever preset the site uses.
 *
 * Lazy-loaded: three.js is by far the heaviest thing in the bundle and a site
 * may switch this off entirely via `ornaments.hero3d`.
 */
export default function HeartDiamond({
  className,
  pointerParallax = true,
}: {
  className?: string;
  /**
   * Let the gem lean toward the pointer.
   *
   * This is the gem's only gesture. It used to take an `autoRotate` as well,
   * which spun continuously; the spin is gone, so the prop went with it rather
   * than staying behind as a switch for a behaviour that no longer exists.
   */
  pointerParallax?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const gold = cssColorNumber("gold-bright", 0xf4d98a);
    const purple = cssColorNumber("purple", 0x5b2a86);
    const violet = cssColorNumber("violet", 0x3a1b5c);

    /* ---------- core setup ---------- */
    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(
      38,
      container.clientWidth / container.clientHeight,
      0.1,
      100,
    );
    camera.position.set(0, 0.3, 6.5);
    camera.lookAt(0, 0.3, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    // canvas fades in after the first frame — kept off the container so the
    // slot's opacity classes stay in control of the element itself
    renderer.domElement.style.opacity = "0";
    renderer.domElement.style.transition = "opacity 0.6s ease";
    container.appendChild(renderer.domElement);

    /* ---------- environment (no HDRI download needed) ---------- */
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.035);
    scene.environment = envRT.texture;

    /* ---------- pointer parallax (passive — never blocks scrolling) ---------- */
    let mouseX = 0;
    const handlePointer = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    };
    if (pointerParallax) window.addEventListener("pointermove", handlePointer);

    /* ---------- geometry: heart-cut gem (table + crown + girdle + pavilion) ---------- */
    /*
      Built by hand instead of ExtrudeGeometry.

      The old gem was a flat extruded heart with a fat bevel — it read as a
      puffy sticker, not a cut stone. A real gem is a stack of rings that taper
      to a point, and that silhouette is what makes it legible as a diamond:

        table      flat top face, scaled inward
        crown      slopes down/out from table to the widest point
        girdle     a thin belt at the widest outline (the gem's "equator")
        pavilion   slopes down/in from the girdle to a sharp culet point

      Each ring uses the same heart outline, so the heart shape is carried all
      the way through and the culet lands dead centre. Flat shading turns every
      band into visible facets, which is the "defined" look we want.
    */
    const gemGeometry = (() => {
      const N = 48; // outline resolution — chunky enough that facets read

      // classic parametric heart, point down, cleft at the top
      const raw: THREE.Vector2[] = [];
      for (let i = 0; i < N; i++) {
        const t = (i / N) * Math.PI * 2;
        raw.push(
          new THREE.Vector2(
            16 * Math.pow(Math.sin(t), 3),
            13 * Math.cos(t) -
              5 * Math.cos(2 * t) -
              2 * Math.cos(3 * t) -
              Math.cos(4 * t),
          ),
        );
      }

      // centre it and normalise to a target half-width
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
      for (const p of raw) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      const k = 1.1 / ((maxX - minX) / 2);
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      // slight vertical stretch so it reads as an elegant heart, not a stubby one
      const outline = raw.map(
        (p) => new THREE.Vector2((p.x - cx) * k, (p.y - cy) * k * 1.2),
      );

      const zTable = 0.5;
      const zMid = 0.22;
      const zGirdleTop = 0.06;
      const zGirdleBottom = -0.06;
      const zCulet = -0.95;

      const positions: number[] = [];
      const index: number[] = [];

      const pushRing = (scale: number, z: number) => {
        const base = positions.length / 3;
        for (const p of outline) positions.push(p.x * scale, p.y * scale, z);
        return base;
      };

      const table = pushRing(0.5, zTable);
      const mid = pushRing(0.78, zMid);
      const girdleTop = pushRing(1, zGirdleTop);
      const girdleBottom = pushRing(1, zGirdleBottom);

      const tableCenter = positions.length / 3;
      positions.push(0, 0, zTable);
      const culet = positions.length / 3;
      positions.push(0, 0, zCulet);

      // a quad band between two equal-length rings
      const band = (a: number, b: number) => {
        for (let i = 0; i < N; i++) {
          const j = (i + 1) % N;
          index.push(a + i, a + j, b + i, a + j, b + j, b + i);
        }
      };
      // a triangle fan from a ring to a single apex.
      //
      // `reverse` is not decoration: the two caps need opposite winding. The
      // table's apex sits *in* its ring's own plane, so the triangle normal
      // comes purely from the ring's winding in xy — and the ring runs
      // clockwise, which drives the normal to -z, into the stone. The
      // pavilion's apex sits far below its ring instead, and that offset
      // already flips the cross product back outward. Winding the table the
      // other way is what makes both caps face out of the shell.
      //
      // Nothing here shows it today: with `flatShading` the shader takes its
      // normal from screen-space derivatives, which ignore index order, and
      // `side: DoubleSide` hides it either way. It is a hole in the shell
      // waiting for someone to turn one of those off.
      const fan = (ring: number, apex: number, reverse = false) => {
        for (let i = 0; i < N; i++) {
          const j = (i + 1) % N;
          if (reverse) index.push(apex, ring + j, ring + i);
          else index.push(apex, ring + i, ring + j);
        }
      };

      fan(table, tableCenter, true); // flat table face
      band(table, mid); // upper crown
      band(mid, girdleTop); // lower crown
      band(girdleTop, girdleBottom); // the girdle belt
      fan(girdleBottom, culet); // pavilion down to the culet

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geo.setIndex(index);
      geo.computeVertexNormals();
      geo.center();
      return geo;
    })();

    /*
      Polished gold, not glass.

      The old gem was a `transmission: 1` diamond. Transmission refracts whatever
      is *behind* the object, and this canvas is transparent over a page gradient
      — so there was nothing behind it to bend, and the stone came out washed out
      and hollow. Metal reflects the environment instead of refracting a missing
      backdrop, so every facet now catches a real, bright reflection: that is what
      makes it read as a cut gem and what gives it the sparkle.

      Low roughness + full metalness = mirror-sharp facet reflections; a clearcoat
      lays a second crisp highlight on top; a whisper of iridescence gives the
      reflected light a little fire at grazing angles.
    */
    const diamondMaterial = new THREE.MeshPhysicalMaterial({
      color: gold,
      metalness: 1,
      roughness: 0.14,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.9,
      iridescence: 0.18,
      iridescenceIOR: 1.6,
      iridescenceThicknessRange: [120, 420],
      specularIntensity: 1,
      flatShading: true, // crisp per-facet normals
      side: THREE.DoubleSide, // winding-agnostic; the gem is a closed shell
    });

    const gem = new THREE.Mesh(gemGeometry, diamondMaterial);
    gem.position.y = 0.45;
    scene.add(gem);

    /* ---------- lighting: gold key, purple rim ---------- */
    scene.add(new THREE.AmbientLight(violet, 0.5));

    const keyLight = new THREE.SpotLight(gold, 120, 20, Math.PI / 7, 0.4, 1.2);
    keyLight.position.set(4, 6, 4);
    scene.add(keyLight);

    const rimLight = new THREE.SpotLight(purple, 90, 20, Math.PI / 6, 0.5, 1.5);
    rimLight.position.set(-5, 3, -4);
    scene.add(rimLight);

    const fillLight = new THREE.PointLight(0xfff6e6, 20, 15, 2);
    fillLight.position.set(0, -2, 5);
    scene.add(fillLight);

    const underLight = new THREE.PointLight(0xfff2e0, 12, 10, 2);
    underLight.position.set(0, -1.5, 0);
    scene.add(underLight);

    /* ---------- resize ---------- */
    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    /* ---------- animation ---------- */
    const clock = new THREE.Clock();
    let frameId: number;
    let last = performance.now();
    /** The eased tilt, which is what actually gets applied to the gem. */
    let tilt = 0;

    const animate = () => {
      frameId = requestAnimationFrame(animate);

      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const t = clock.getElapsedTime();

      /*
        No turntable.

        A gem that rotates on its own is showing off its facets rather than
        being looked at, and on a page whose subject is a letter it read as a
        spinning trophy. So the only motion is a small lean toward the pointer,
        eased so it arrives rather than snaps, and a fixed resting angle that
        keeps the heart silhouette readable.

        `mouseY` is deliberately unused: up-and-down tilt turned the gem away from
        the reader at exactly the moment they looked at it.
      */
      const target = pointerParallax ? mouseX * 0.26 : 0;
      tilt += (target - tilt) * Math.min(1, dt * 3.5);

      gem.rotation.y = tilt;
      gem.rotation.x = -0.05 + Math.sin(t * 0.4) * 0.018;

      gem.position.y = 0.45 + Math.sin(t * 0.7) * 0.04;

      keyLight.position.x = Math.sin(t * 0.3) * 5;
      keyLight.position.z = Math.cos(t * 0.3) * 5;

      renderer.render(scene, camera);
    };
    animate();

    // Fade the canvas in once the first frame is on screen — setTimeout rather
    // than rAF so it also completes when the page loads in a background tab
    const fadeTimer = window.setTimeout(() => {
      renderer.domElement.style.opacity = "1";
    }, 80);

    /* ---------- cleanup ---------- */
    return () => {
      cancelAnimationFrame(frameId);
      window.clearTimeout(fadeTimer);
      resizeObserver.disconnect();
      if (pointerParallax) window.removeEventListener("pointermove", handlePointer);
      pmremGenerator.dispose();
      envRT.texture.dispose();

      gemGeometry.dispose();
      diamondMaterial.dispose();

      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [pointerParallax]);

  // className-only root: sizing/opacity come from the slot's Tailwind classes,
  // and there is deliberately no background — the page gradient shows through
  return <div ref={containerRef} className={className} />;
}