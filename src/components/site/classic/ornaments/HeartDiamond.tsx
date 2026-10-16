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
 * else (never blocks page scrolling), faceted "cut gem" look via flat shading,
 * gold glass material. Rendered without postprocessing so the canvas keeps its
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

    /* ---------- geometry: heart-cut gem ---------- */
    const heartShape = (() => {
      const s = new THREE.Shape();
      const x = 0,
        y = 0;
      s.moveTo(x, y);
      s.bezierCurveTo(x, y - 0.6, x - 1.4, y - 0.6, x - 1.4, y + 0.35);
      s.bezierCurveTo(x - 1.4, y + 1.05, x - 0.7, y + 1.5, x, y + 2.15);
      s.bezierCurveTo(x + 0.7, y + 1.5, x + 1.4, y + 1.05, x + 1.4, y + 0.35);
      s.bezierCurveTo(x + 1.4, y - 0.6, x, y - 0.6, x, y);
      return s;
    })();

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: 0.9,
      bevelEnabled: true,
      bevelThickness: 0.55,
      bevelSize: 0.5,
      bevelSegments: 3,
      curveSegments: 8,
      steps: 1,
    };

    const gemGeometry = new THREE.ExtrudeGeometry(heartShape, extrudeSettings);
    gemGeometry.center();
    // the raw shape traces point-up; one Z flip is all it takes to seat the point down
    gemGeometry.rotateZ(Math.PI);
    gemGeometry.scale(0.85, 0.85, 0.72);
    gemGeometry.computeVertexNormals();

    const diamondMaterial = new THREE.MeshPhysicalMaterial({
      color: gold,
      metalness: 0,
      roughness: 0.015,
      transmission: 1,
      thickness: 2.2,
      ior: 2.42, // real diamond refractive index
      reflectivity: 1,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 1.6,
      iridescence: 0.4,
      iridescenceIOR: 1.3,
      iridescenceThicknessRange: [100, 400],
      specularIntensity: 1,
      flatShading: true, // the faceted "cut gem" look
    });

    const gem = new THREE.Mesh(gemGeometry, diamondMaterial);
    gem.position.y = 0.45;
    scene.add(gem);

    // subtle inner "fire" core — a smaller, brighter copy for sparkle depth
    const coreGeo = gemGeometry.clone();
    coreGeo.scale(0.72, 0.72, 0.72);
    const coreMat = new THREE.MeshPhysicalMaterial({
      color: gold,
      transmission: 1,
      roughness: 0,
      ior: 2.6,
      thickness: 1,
      envMapIntensity: 2.2,
      flatShading: true,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.copy(gem.position);
    scene.add(core);

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
      core.rotation.copy(gem.rotation);

      gem.position.y = 0.45 + Math.sin(t * 0.7) * 0.04;
      core.position.y = gem.position.y;

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
      coreGeo.dispose();
      diamondMaterial.dispose();
      coreMat.dispose();

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