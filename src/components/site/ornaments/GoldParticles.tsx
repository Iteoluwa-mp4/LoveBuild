import { useEffect, useRef } from "react";
import * as THREE from "three";

import { cssColorNumber } from "./themeColor";

/**
 * Drifting gold particle field behind the gallery.
 *
 * Lazy-loaded for the same reason as the gem: three.js is heavy and
 * `ornaments.particles` can switch it off.
 */
export default function GoldParticles({ className = "" }: { className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const gold = cssColorNumber("gold-bright", 0xf0c96a);
    const lavender = cssColorNumber("lavender", 0xc9a6e8);

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 60);
    camera.position.z = 14;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const COUNT = 260;
    const positions = new Float32Array(COUNT * 3);
    const speeds = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 22;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 22;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 16;
      speeds[i] = 0.15 + Math.random() * 0.35;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const goldMat = new THREE.PointsMaterial({
      color: gold,
      size: 0.06,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true,
    });
    const lavenderMat = new THREE.PointsMaterial({
      color: lavender,
      size: 0.045,
      transparent: true,
      opacity: 0.5,
      sizeAttenuation: true,
    });

    const goldPoints = new THREE.Points(geometry, goldMat);
    const lavenderPoints = new THREE.Points(geometry, lavenderMat);
    lavenderPoints.position.z = -3;
    scene.add(goldPoints);
    scene.add(lavenderPoints);

    let raf = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      const t = clock.getElapsedTime();
      const pos = geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < COUNT; i++) {
        const y = pos.getY(i);
        const speed = speeds[i];
        let ny = y + speed * 0.01;
        if (ny > 11) ny = -11;
        pos.setY(i, ny);
      }
      pos.needsUpdate = true;

      goldPoints.rotation.y = t * 0.02;
      lavenderPoints.rotation.y = -t * 0.015;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
      geometry.dispose();
      goldMat.dispose();
      lavenderMat.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className={className} />;
}