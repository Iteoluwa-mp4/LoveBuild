import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import EditableText from "../shared/EditableText";
import { hasContent, editorialMoments } from "../../../lib/site/derive";
import type { Site } from "../../../lib/site/schema";
import { editorialPaths } from "./paths";
import {
  EDITORIAL_ACCENT,
  EditorialFigureGrid,
  EditorialLightbox,
  EditorialStyles,
  LineReveal,
  editorialImage,
  slugBarcode,
  useEditorialFolio,
} from "./shared";

gsap.registerPlugin(ScrollTrigger);

/**
 * The editorial template's home page — the issue itself.
 *
 * ## What is fixed, and what is not
 *
 * The headings are the publication's, not the author's: "one person / one
 * issue", "contents", "from the editor", "figures of us.", the folio, the
 * colophon. A magazine that let the author rename every section would lose the
 * one thing the format is for, so those are chrome and live here. What is
 * configurable is exactly what is unmistakably somebody's — the person the
 * issue is about, the photographs, the pull-quote, and the editor's letter —
 * and it is those words that appear on the page as editable text.
 *
 * ## Why the photographs come from `home.moments`
 *
 * See `editorialMoments` in `derive.ts`: a moment's date becomes the dateline,
 * its caption the story headline, its secret the note. One list, read by every
 * template — so switching `template` re-presents the photographs rather than
 * stranding the uploads.
 */
export default function EditorialHomePage({ site, basePath }: { site: Site; basePath: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [selectedFigure, setSelectedFigure] = useState<number | null>(null);
  const folio = useEditorialFolio();

  const paths = useMemo(() => editorialPaths(basePath), [basePath]);
  const moments = useMemo(() => editorialMoments(site), [site.home.moments]);
  const barcode = useMemo(() => slugBarcode(site.slug), [site.slug]);

  /** The masthead name and the three lines printed over the cover photograph. */
  const coverLines = moments.slice(0, 3).map((moment) => moment.caption);

  const person = hasContent(site.editorial.person) ? site.editorial.person : site.identity.name;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".editorial-cover-kicker, .editorial-cover-title .editorial-line, .editorial-cover-line, .editorial-cover-meta",
        { y: "105%", opacity: 0 },
        { y: "0%", opacity: 1, duration: 0.8, stagger: 0.06, ease: "power3.out", delay: 0.1 },
      );
      gsap.utils.toArray<HTMLElement>(".editorial-reveal").forEach((element) => {
        gsap.fromTo(
          element,
          { y: 24, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, ease: "power2.out", scrollTrigger: { trigger: element, start: "top 84%" } },
        );
      });
      gsap.utils.toArray<HTMLElement>(".editorial-photo-reveal").forEach((element) => {
        gsap.fromTo(
          element,
          { clipPath: "inset(0 100% 0 0)" },
          { clipPath: "inset(0 0% 0 0)", duration: 1.05, ease: "power3.inOut", scrollTrigger: { trigger: element, start: "top 84%" } },
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

      <header className="editorial-cover">
        {/*
          The masthead. The middle two entries are the publication's; the
          person's name and the link to the figures are the site's.
        */}
        <nav className="editorial-nav">
          <span>{person}</span>
          <span>private edition · vol. 01</span>
          <span>{site.slug}</span>
          <a href={paths.gallery}>figures</a>
        </nav>

        <div className="editorial-cover-kicker">one person / one issue</div>

        <h1 className="editorial-cover-title">
          <LineReveal>{site.identity.name}</LineReveal>
        </h1>

        {/*
          The cover photograph is the first story's. Editorial covers come from
          the issue; there is no separate upload, because a second slot and the
          first story's would never agree.
        */}
        <div className="editorial-cover-image editorial-photo-reveal">
          <img
            src={editorialImage(moments[0] ?? { date: "", caption: "", note: "", image: "" }, 0)}
            alt={`${person}, cover`}
          />
          <span className="editorial-cover-image-label">the person behind the pages</span>
        </div>

        <div className="editorial-cover-lines">
          {coverLines.map((line, index) => (
            <p className="editorial-cover-line" key={line || index}>
              <span>0{index + 1}</span>
              {line}
            </p>
          ))}
        </div>

        <div className="editorial-barcode">
          {barcode.map((width, index) => (
            <i key={index} style={{ width }} />
          ))}
          <small>{site.slug}</small>
        </div>

        <div className="editorial-cover-meta">
          <span>an archive of the in-between</span>
          <span>read slowly</span>
        </div>
      </header>

      <main>
        {/*
          Contents. Its numbered list is derived from the stories — two lists
          would disagree the moment a story was added or reordered.
        */}
        <section className="editorial-contents editorial-reveal">
          <div className="editorial-section-marker">
            contents <span>///</span>
          </div>
          <div className="editorial-contents-grid">
            <div>
              <h2>
                Inside
                <br />
                <em>this issue.</em>
              </h2>
              <p className="editorial-deck">
                A selective record of the moments that make a life feel like ours.
              </p>
            </div>
            <ol>
              {moments.map((moment, index) => (
                <li key={index}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <b>{moment.caption}</b>
                  <i /> <em>{String(index + 3).padStart(2, "0")}</em>
                </li>
              ))}
              <li>
                <span>04</span>
                <b>From the editor</b>
                <i /> <em>10</em>
              </li>
              <li>
                <span>05</span>
                <b>Figures &amp; credits</b>
                <i /> <em>11</em>
              </li>
            </ol>
          </div>
        </section>

        {/*
          The stories. One story per photograph: dateline, headline, figure,
          body. A story renders whatever has been written — a photograph with
          no date is simply an undated one.
        */}
        {moments.map((moment, index) => (
          <article
            className={`editorial-story editorial-story-${index % 3}`}
            key={`${moment.caption}-${index}`}
          >
            <div className="editorial-story-numeral">{String(index + 1).padStart(2, "0")}</div>
            <div className="editorial-story-heading editorial-reveal">
              <p className="editorial-dateline">
                {hasContent(moment.date) ? <>{moment.date} <span>—</span> </> : null}
                field notes
              </p>
              <h2>
                <LineReveal>{moment.caption}</LineReveal>
              </h2>
            </div>
            <figure className="editorial-story-figure editorial-photo-reveal">
              <img src={editorialImage(moment, index)} alt={moment.caption} />
              <figcaption>
                Fig. {String(index + 1).padStart(2, "0")} / from the private archive
              </figcaption>
            </figure>
            <div className="editorial-story-copy editorial-reveal">
              {/*
                The EditableText wraps one paragraph shape; the drop-cap is the
                first-letter rule on `.editorial-dropcap`.
              */}
              <EditableText
                as="p"
                multiline
                className="editorial-story-body editorial-dropcap"
                path={`home.moments.${index}.secret`}
                value={moment.note}
                maxLength={600}
                placeholder="The story, told slowly."
              />
            </div>
            <aside className="editorial-margin-note">
              no. {String(index + 1).padStart(2, "0")}
              <br />
              kept forever
            </aside>
          </article>
        ))}

        {hasContent(site.editorial.quote) && (
          <section className="editorial-quote editorial-reveal">
            <span className="editorial-quote-mark">&ldquo;</span>
            <EditableText
              as="p"
              path="editorial.quote"
              value={site.editorial.quote}
              maxLength={300}
              placeholder="The line she reads twice"
            />
            <span className="editorial-quote-rule" />
          </section>
        )}

        {hasContent(site.editorial.letter) && (
          <section className="editorial-letter editorial-reveal">
            <div className="editorial-section-marker">
              from the editor <span>///</span>
            </div>
            <div className="editorial-letter-column">
              <p className="editorial-letter-lede">
                A note for the person this whole thing is about.
              </p>
              <EditableText
                as="p"
                multiline
                className="editorial-letter-body"
                path="editorial.letter"
                value={site.editorial.letter}
                maxLength={4000}
                placeholder="The letter. A few short paragraphs."
              />
              <p className="editorial-signature">
                always,
                <br />
                <em>me</em>
              </p>
            </div>
          </section>
        )}

        {/*
          The figures — a spread of every photograph, on this page and on the
          figures page. Same list, so a photo always appears exactly once
          wherever the author puts the emphasis.
        */}
        <section className="editorial-gallery editorial-reveal">
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
          <EditorialFigureGrid items={moments} onOpen={setSelectedFigure} />
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
