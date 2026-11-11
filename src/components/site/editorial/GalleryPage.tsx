import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { hasContent, editorialMoments } from "../../../lib/site/derive";
import type { Site } from "../../../lib/site/schema";
import { editorialPaths } from "./paths";
import {
  EDITORIAL_ACCENT,
  EditorialFigureGrid,
  EditorialLightbox,
  EditorialStyles,
  useEditorialFolio,
} from "./shared";

gsap.registerPlugin(ScrollTrigger);

/**
 * The editorial template's figures page — every photograph, with its credit.
 *
 * The home page is the issue: cover, contents, stories, letter, and a spread
 * of figures at the end. This page is the gallery route, and it answers the
 * question the magazine cannot — "all of them, together, bigger" — rather
 * than duplicating a chapter structure the format has no room for. It reads
 * the same `home.moments` list through `editorialMoments`, so there is no
 * second place where a photograph or its caption could drift.
 *
 * Headings are chrome, same as the issue: a magazine earns "figures of us"
 * by having the spread, not by asking someone to name it.
 */
export default function EditorialGalleryPage({ site, basePath }: { site: Site; basePath: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [selectedFigure, setSelectedFigure] = useState<number | null>(null);
  const folio = useEditorialFolio();

  const paths = useMemo(() => editorialPaths(basePath), [basePath]);
  const moments = useMemo(() => editorialMoments(site), [site.home.moments]);

  const person = hasContent(site.editorial.person) ? site.editorial.person : site.identity.name;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".editorial-gallery-heading",
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: "power2.out" },
      );
      gsap.utils.toArray<HTMLElement>(".editorial-reveal").forEach((element) => {
        gsap.fromTo(
          element,
          { y: 24, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, ease: "power2.out", scrollTrigger: { trigger: element, start: "top 88%" } },
        );
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={rootRef}
      className="editorial-template"
      style={{ "--editorial-accent": EDITORIAL_ACCENT } as CSSProperties}
    >
      <EditorialStyles />

      <div className="editorial-folio">{folio}</div>

      <header className="editorial-cover editorial-cover-figures">
        <nav className="editorial-nav">
          <span>{person}</span>
          <span>figures &amp; credits</span>
          <a href={paths.home}>back to the issue</a>
        </nav>
      </header>

      <main>
        <section className="editorial-gallery">
          <div className="editorial-gallery-heading">
            <div className="editorial-section-marker">
              the gallery <span>///</span>
            </div>
            <h2>
              Figures
              <br />
              <em>of us.</em>
            </h2>
            <p>Tap any figure to open the spread.</p>
          </div>
          <EditorialFigureGrid items={moments} onOpen={setSelectedFigure} className="editorial-reveal" />
        </section>

        <footer className="editorial-colophon">
          <div className="editorial-fleuron">&#10022;</div>
          <p>
            Published once, for one person.
            <br />
            Edited with care and a little bit of bias.
          </p>
          <strong>{site.identity.name}</strong>
          <small>fin.</small>
        </footer>
      </main>

      <EditorialLightbox items={moments} selected={selectedFigure} onClose={() => setSelectedFigure(null)} />
    </div>
  );
}
