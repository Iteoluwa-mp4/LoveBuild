import { useCallback, useState } from "react";

import type { DraftSite } from "../../hooks/useDraftSite";
import {
  EmptyNote,
  Item,
  Section,
  TextAreaField,
  TextField,
  ToggleField,
} from "./fields";
import MediaUploader from "./MediaUploader";
import { hasContent, chapterLabel } from "../../lib/site/derive";
import { countLabel } from "../../lib/format";
import type { Chapter, Film, Moment, Still } from "../../lib/site/schema";
import { initiallyOpenItems } from "./openItems";

/**
 * Which item panels are open.
 *
 * Deliberately local to the editor rather than held in the draft: "which panels
 * are open" is not part of the site, and putting it in the config would mean
 * saving it, diffing it, and showing it in the outline.
 *
 * Starts with everything collapsed. That is the point of the change — four
 * moments and four chapters rendered open is a wall of identical cards.
 */
function useOpenItems(initiallyOpen: string[] = []) {
  const [open, setOpenState] = useState<ReadonlySet<string>>(() => new Set(initiallyOpen));

  const isOpen = useCallback((id: string) => open.has(id), [open]);

  const setOpen = useCallback((id: string, next: boolean) => {
    setOpenState((prev) => {
      if (prev.has(id) === next) return prev;
      const updated = new Set(prev);
      if (next) updated.add(id);
      else updated.delete(id);
      return updated;
    });
  }, []);

  /**
   * Force one open. Used when something is added, because otherwise "Add a
   * moment" appears to do nothing at all — the new row lands closed, which reads
   * as a broken button rather than a collapsed panel.
   */
  const reveal = useCallback((id: string) => {
    setOpenState((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  return { isOpen, setOpen, reveal };
}

/**
 * The editors.
 *
 * All three pages of the site have an editor here, ordered by how much they
 * matter. The original site's writing is seeded as defaults, so the common case
 * is "read it, change a name, press publish" rather than "write a love letter
 * from scratch" — which is the difference between this being usable and this
 * being homework.
 *
 * Advanced groups are collapsed and pre-filled. Emptying one hides that part of
 * the site rather than breaking it.
 */

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2, 10)}`;

/* ================================================================== *
 * HOME
 * ================================================================== */

export function HomeEditor({ draft }: { draft: DraftSite }) {
  const site = draft.site;

  // Hooks first. An early return in front of them would change the hook order
  // on any render where `site` came back null, which React does not allow.
  // A moment with no photo is one nobody has started on, so it opens itself.
  const openMoments = useOpenItems(initiallyOpenItems(site).moments);

  if (!site) return null;

  return (
    <>
      <Section title="Site name" hint="Shown in the top-left corner">
        <TextField
          label="Name"
          value={site.identity.name}
          onChange={(v) => draft.set("identity.name", v)}
          placeholder="Her name, or a nickname only she would recognise"
          hint="Shown in the corner and in the browser tab."
          maxLength={120}
        />
      </Section>

      <Section title="First impression" hint="The first thing she sees">
        <TextField
          label="Headline, line 1"
          value={site.home.hero.lines[0] ?? ""}
          onChange={(v) => draft.set("home.hero.lines.0", v)}
          placeholder="Two or three words. Something she'd smile at."
          hint="The most important line on the page. Keep it short."
          maxLength={90}
        />
        <TextField
          label="Headline, line 2"
          value={site.home.hero.lines[1] ?? ""}
          onChange={(v) => draft.set("home.hero.lines.1", v)}
          placeholder="Continue the thought"
          hint="Leave blank for a two-line headline."
          maxLength={90}
        />
        <TextField
          label="Headline, line 3"
          value={site.home.hero.lines[2] ?? ""}
          onChange={(v) => draft.set("home.hero.lines.2", v)}
          placeholder="The punchline"
          hint="This line gets the gold gradient, so it lands hardest."
          maxLength={90}
        />

        <TextAreaField
          label="A line underneath"
          value={site.home.hero.subline}
          onChange={(v) => draft.set("home.hero.subline", v)}
          rows={3}
          maxLength={500}
          hint="Why this is for her. One or two sentences."
        />

        <div className="field-row field-row-2">
          <TextField
            label="Big button label"
            value={site.home.hero.primaryCta}
            onChange={(v) => draft.set("home.hero.primaryCta", v)}
            maxLength={120}
            hint="Opens the gallery"
            placeholder="Open the gallery"
          />
          <TextField
            label="Second button label"
            value={site.home.hero.secondaryCta}
            onChange={(v) => draft.set("home.hero.secondaryCta", v)}
            maxLength={120}
            hint="Scrolls down the page. Leave blank to hide it."
            placeholder="Keep scrolling"
          />
        </div>
      </Section>

      <MomentsEditor draft={draft} open={openMoments} />

      <QuoteEditor draft={draft} />
      <FooterEditor draft={draft} />
    </>
  );
}

/**
 * The photographs, shared by both templates.
 *
 * Extracted from `HomeEditor` so the modern editor can show the same list. This
 * is what makes a template switch safe: there is one list of photographs, one
 * uploader, and whichever template is selected reads it. Editing them under
 * "Classic" and then switching to "Modern" shows the same pictures, arranged as
 * a strip and a sphere instead of a grid.
 *
 * The `hint` varies with the template because the same photo behaves
 * differently — the classic card flips to reveal the secret, the modern strip
 * just advances — and that difference should not be a surprise.
 */
function MomentsEditor({
  draft,
  open,
  modern = false,
}: {
  draft: DraftSite;
  open: ReturnType<typeof useOpenItems>;
  modern?: boolean;
}) {
  const site = draft.site;
  if (!site) return null;

  return (
    <Section
      title={`Photographs (${site.home.moments.length})`}
      hint={modern ? "Shown as a strip and an orbit" : "Photos that flip when tapped"}
    >
      {site.home.moments.length === 0 && (
        <EmptyNote>
          No photographs yet. Add one and it appears on the site in whichever template you
          have selected.
        </EmptyNote>
      )}

      {site.home.moments.map((moment, i) => (
        <MomentEditor
          key={moment.id}
          moment={moment}
          index={i}
          total={site.home.moments.length}
          draft={draft}
          open={open.isOpen(moment.id)}
          onToggle={(next) => open.setOpen(moment.id, next)}
        />
      ))}

      <div className="btn-row">
        <button
          type="button"
          className="btn"
          onClick={() => {
            const id = newId();
            draft.append("home.moments", {
              id,
              tag: "",
              date: "",
              caption: "",
              secret: "",
              image: {
                id: newId(),
                publicId: null,
                url: "",
                alt: "",
                caption: "",
                width: null,
                height: null,
                durationMs: null,
              },
            } satisfies Moment);
            // Otherwise the new row lands collapsed and the button looks dead.
            open.reveal(id);
          }}
        >
          Add a photograph
        </button>
      </div>
    </Section>
  );
}

function MomentEditor({
  moment,
  index,
  total,
  draft,
  open,
  onToggle,
}: {
  moment: Moment;
  index: number;
  total: number;
  draft: DraftSite;
  open: boolean;
  onToggle: (next: boolean) => void;
}) {
  const base = `home.moments.${index}`;

  return (
    <Item
      index={index}
      title={hasContent(moment.caption) ? moment.caption : momentTagPreview(moment, index)}
      badges={moment.image.url ? undefined : <span className="badge badge-warn">No photo</span>}
      open={open}
      onToggle={onToggle}
      onUp={index > 0 ? () => draft.move("home.moments", index, index - 1) : undefined}
      onDown={index < total - 1 ? () => draft.move("home.moments", index, index + 1) : undefined}
      onRemove={() => draft.remove(base)}
      removeLabel={`Remove moment ${index + 1}`}
    >
      <MediaUploader
        label="Photo"
        accept="image/*"
        media={moment.image}
        onChange={(next) => draft.set(`${base}.image`, next)}
        onClear={() =>
          draft.set(`${base}.image`, { ...moment.image, url: "", publicId: null })
        }
      />

      <TextField
        label="Caption on the front"
        value={moment.caption}
        onChange={(v) => draft.set(`${base}.caption`, v)}
        maxLength={300}
        hint="What she reads before tapping"
      />

      <TextAreaField
        label="Hidden message on the back"
        value={moment.secret}
        onChange={(v) => draft.set(`${base}.secret`, v)}
        rows={3}
        maxLength={600}
        hint="Revealed when the photo is tapped. This is the bit worth writing yourself."
      />

      <details>
        <summary className="field-label" style={{ cursor: "pointer" }}>
          More options
        </summary>
        <div className="item-body" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <div className="field-row field-row-2">
            <TextField
              label="Small label"
              value={moment.tag}
              onChange={(v) => draft.set(`${base}.tag`, v)}
              maxLength={120}
              placeholder={`Moment ${String(index + 1).padStart(2, "0")}`}
              hint="Leave blank for the default"
            />
            <TextField
              label="Date"
              value={moment.date}
              onChange={(v) => draft.set(`${base}.date`, v)}
              maxLength={120}
              placeholder="October 14"
            />
          </div>
        </div>
      </details>
    </Item>
  );
}

function momentTagPreview(moment: Moment, index: number): string {
  return hasContent(moment.tag) ? moment.tag : `Moment ${String(index + 1).padStart(2, "0")}`;
}

/* ================================================================== *
 * QUOTE — advanced
 * ================================================================== */

function QuoteEditor({ draft }: { draft: DraftSite }) {
  const site = draft.site;
  if (!site) return null;
  const quote = site.home.quote;

  return (
    <Section
      title="Quote and letter"
      hint={hasContent(quote.text) ? undefined : "Hidden — no quote written"}
      defaultOpen={false}
    >
      <p className="field-hint">
        Already written for you. Clear the quote and the whole section disappears from the site.
      </p>

      <TextAreaField
        label="The quote"
        value={quote.text}
        onChange={(v) => draft.set("home.quote.text", v)}
        rows={3}
        maxLength={2000}
        hint="The last sentence gets highlighted automatically."
        placeholder="Something she would recognise — a line, a message, the first thing you said."
      />

      <TextAreaField
        label="The longer letter"
        value={quote.truth}
        onChange={(v) => draft.set("home.quote.truth", v)}
        rows={8}
        maxLength={8000}
        hint="Hidden behind a button. Leave blank and the button disappears."
        placeholder="A few short paragraphs. This is the part she will read twice."
      />

      <TextField
        label="Signed"
        value={quote.author}
        onChange={(v) => draft.set("home.quote.author", v)}
        maxLength={120}
        hint="Your name. Leave blank for no signature."
        placeholder="Your name"
      />
      <TextField
        label="Under the signature"
        value={quote.authorSub}
        onChange={(v) => draft.set("home.quote.authorSub", v)}
        maxLength={200}
        placeholder="A small line, or leave blank"
      />

      <div className="field-row field-row-2">
        <TextField
          label="Score label"
          value={quote.verdictLabel}
          onChange={(v) => draft.set("home.quote.verdictLabel", v)}
          maxLength={120}
          hint="The little score beside the quote. Both blank hides it."
          placeholder="Verdict:"
        />
        <TextField
          label="Score"
          value={quote.verdictValue}
          onChange={(v) => draft.set("home.quote.verdictValue", v)}
          maxLength={120}
          placeholder="10 / 10"
        />
      </div>

      <details>
        <summary className="field-label" style={{ cursor: "pointer" }}>
          Button labels
        </summary>
        <div className="item-body" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <div className="field-row field-row-2">
            <TextField
              label="Reveal button"
              value={quote.toggleReveal}
              onChange={(v) => draft.set("home.quote.toggleReveal", v)}
              maxLength={120}
              placeholder="Show the letter"
            />
            <TextField
              label="Close button"
              value={quote.toggleBack}
              onChange={(v) => draft.set("home.quote.toggleBack", v)}
              maxLength={120}
              placeholder="Back to the quote"
            />
          </div>
        </div>
      </details>
    </Section>
  );
}

/* ================================================================== *
 * FOOTER
 * ================================================================== */

function FooterEditor({ draft }: { draft: DraftSite }) {
  const site = draft.site;
  if (!site) return null;
  const footer = site.home.footer;

  return (
    <Section
      title="Closing section"
      hint={hasContent(footer.heading) ? undefined : "Hidden — nothing written"}
      defaultOpen={false}
    >
      <TextField
        label="Heading"
        value={footer.heading}
        onChange={(v) => draft.set("home.footer.heading", v)}
        maxLength={200}
        hint="The closing words. Leave blank and the whole section disappears."
        placeholder="The last thing she reads"
      />
      <TextField
        label="Line underneath"
        value={footer.subline}
        onChange={(v) => draft.set("home.footer.subline", v)}
        maxLength={300}
        placeholder="One line under it, or leave blank"
      />
      <TextField
        label="Button label"
        value={footer.ctaLabel}
        onChange={(v) => draft.set("home.footer.ctaLabel", v)}
        maxLength={120}
        hint="Opens the gallery. Leave blank to hide the button."
        placeholder="Watch the gallery"
      />

      {footer.cards.map((card, i) => (
        <Item
          key={card.id}
          index={i}
          title={hasContent(card.quote) ? card.quote : "Empty card"}
          onUp={i > 0 ? () => draft.move("home.footer.cards", i, i - 1) : undefined}
          onDown={
            i < footer.cards.length - 1 ? () => draft.move("home.footer.cards", i, i + 1) : undefined
          }
          onRemove={() => draft.remove(`home.footer.cards.${i}`)}
          removeLabel={`Remove card ${i + 1}`}
        >
          <TextField
            label="Label"
            value={card.tag}
            onChange={(v) => draft.set(`home.footer.cards.${i}.tag`, v)}
            maxLength={120}
            placeholder={`Clip ${String(i + 1).padStart(2, "0")}`}
          />
          <TextAreaField
            label="Quote"
            value={card.quote}
            onChange={(v) => draft.set(`home.footer.cards.${i}.quote`, v)}
            rows={2}
            maxLength={400}
            placeholder="A short line about this clip"
          />
        </Item>
      ))}

      <div className="btn-row">
        <button
          type="button"
          className="btn"
          onClick={() =>
            draft.append("home.footer.cards", { id: newId(), tag: "", quote: "" })
          }
        >
          Add a card
        </button>
      </div>
    </Section>
  );
}

/* ================================================================== *
 * GALLERY
 * ================================================================== */

export function GalleryEditor({ draft }: { draft: DraftSite }) {
  const site = draft.site;

  // Hooks before the early return, same reason as HomeEditor.
  //
  // A chapter with nothing in it is unfinished, so it opens itself. Films and
  // stills start closed even inside an open chapter — a chapter of five videos
  // is as much of a wall as a chapter itself.
  const initial = initiallyOpenItems(site);
  const openChapters = useOpenItems(initial.chapters);
  const openFilms = useOpenItems(initial.films);
  const openStills = useOpenItems(initial.stills);

  if (!site) return null;
  const gallery = site.gallery;

  const totalFilms = gallery.chapters.reduce((n, c) => n + c.films.length, 0);
  const totalStills = gallery.chapters.reduce((n, c) => n + c.stills.length, 0);

  return (
    <>
      <Section
        title={`Chapters (${gallery.chapters.length})`}
        hint={`${countLabel(totalFilms, "video")} · ${countLabel(totalStills, "photo")}`}
      >
        {gallery.chapters.length === 0 && (
          <EmptyNote>
            No chapters. The gallery will be empty — that is fine if you only want the front page.
          </EmptyNote>
        )}

        {gallery.chapters.map((chapter, i) => (
          <ChapterEditor
            key={chapter.id}
            chapter={chapter}
            index={i}
            total={gallery.chapters.length}
            draft={draft}
            open={openChapters.isOpen(chapter.id)}
            onToggle={(next) => openChapters.setOpen(chapter.id, next)}
            films={openFilms}
            stills={openStills}
          />
        ))}

        <div className="btn-row">
          <button
            type="button"
            className="btn"
            onClick={() => {
              const id = newId();
              draft.append("gallery.chapters", {
                id,
                label: "",
                title: "",
                blurb: "",
                films: [],
                stills: [],
              } satisfies Chapter);
              openChapters.reveal(id);
            }}
          >
            Add a chapter
          </button>
        </div>
      </Section>

      <Section title="Gallery intro and outro" hint="Optional" defaultOpen={false}>
        <TextField
          label="Small label at the top"
          value={gallery.hero.eyebrow}
          onChange={(v) => draft.set("gallery.hero.eyebrow", v)}
          maxLength={120}
          placeholder="The gallery"
        />
        <TextAreaField
          label="Intro, line 1"
          value={gallery.hero.lineOne}
          onChange={(v) => draft.set("gallery.hero.lineOne", v)}
          rows={2}
          maxLength={120}
          placeholder="The opening line, large"
        />
        <TextAreaField
          label="Intro, line 2"
          value={gallery.hero.lineTwo}
          onChange={(v) => draft.set("gallery.hero.lineTwo", v)}
          rows={2}
          maxLength={120}
          hint="This line gets the gold gradient."
        />
        <TextAreaField
          label="Intro, underneath"
          value={gallery.hero.blurb}
          onChange={(v) => draft.set("gallery.hero.blurb", v)}
          rows={3}
          maxLength={500}
          placeholder="One line introducing the reel. Optional."
        />

        <div className="field-row field-row-2">
          <TextField
            label="Outro, line 1"
            value={gallery.outro.lineOne}
            onChange={(v) => draft.set("gallery.outro.lineOne", v)}
            maxLength={120}
            placeholder="The closing words"
          />
          <TextField
            label="Outro, line 2"
            value={gallery.outro.lineTwo}
            onChange={(v) => draft.set("gallery.outro.lineTwo", v)}
            maxLength={120}
          />
        </div>
        <TextField
          label="Outro, small line"
          value={gallery.outro.aside}
          onChange={(v) => draft.set("gallery.outro.aside", v)}
          maxLength={300}
          placeholder="A small line under them, or leave blank"
        />
        <TextField
          label="Back button"
          value={gallery.outro.backLabel}
          onChange={(v) => draft.set("gallery.outro.backLabel", v)}
          maxLength={120}
          placeholder="Back to the beginning"
        />
      </Section>
    </>
  );
}

function ChapterEditor({
  chapter,
  index,
  total,
  draft,
  open,
  onToggle,
  films: openFilms,
  stills: openStills,
}: {
  chapter: Chapter;
  index: number;
  total: number;
  draft: DraftSite;
  open: boolean;
  onToggle: (next: boolean) => void;
  films: ReturnType<typeof useOpenItems>;
  stills: ReturnType<typeof useOpenItems>;
}) {
  const base = `gallery.chapters.${index}`;
  const empty = chapter.films.length === 0 && chapter.stills.length === 0;

  return (
    <Item
      index={index}
      title={`${chapterLabel(chapter.label, index)}. ${hasContent(chapter.title) ? chapter.title : "Untitled"}`}
      badges={
        empty ? (
          <span className="badge badge-warn">Empty</span>
        ) : (
          <span className="badge badge-good">
            {chapter.films.length + chapter.stills.length}
          </span>
        )
      }
      open={open}
      onToggle={onToggle}
      onUp={index > 0 ? () => draft.move("gallery.chapters", index, index - 1) : undefined}
      onDown={index < total - 1 ? () => draft.move("gallery.chapters", index, index + 1) : undefined}
      onRemove={() => draft.remove(base)}
      removeLabel={`Remove chapter ${index + 1}`}
    >
      <TextField
        label="Chapter name"
        value={chapter.title}
        onChange={(v) => draft.set(`${base}.title`, v)}
        maxLength={120}
        hint="Name this part of the story. Chapters appear in this order."
        placeholder="The first time we met"
      />
      <TextAreaField
        label="One line about it"
        value={chapter.blurb ?? ""}
        onChange={(v) => draft.set(`${base}.blurb`, v || undefined)}
        rows={2}
        maxLength={400}
        placeholder="A line that sets up the chapter"
      />

      <div className="field">
        <span className="field-label">Videos ({chapter.films.length})</span>
        {chapter.films.map((film, i) => (
          <FilmEditor
            key={film.id}
            film={film}
            index={i}
            total={chapter.films.length}
            path={`${base}.films`}
            draft={draft}
            open={openFilms.isOpen(film.id)}
            onToggle={(next) => openFilms.setOpen(film.id, next)}
          />
        ))}
        {chapter.films.length === 0 && <EmptyNote>No videos in this chapter.</EmptyNote>}
        <div className="btn-row">
          <button
            type="button"
            className="btn"
            onClick={() => {
              const id = newId();
              draft.append(`${base}.films`, {
                id,
                title: "",
                note: "",
                src: {
                  id: newId(),
                  publicId: null,
                  url: "",
                  alt: "",
                  caption: "",
                  width: null,
                  height: null,
                  durationMs: null,
                },
              } satisfies Film);
              openFilms.reveal(id);
            }}
          >
            Add a video
          </button>
        </div>
      </div>

      <div className="field">
        <span className="field-label">Photographs ({chapter.stills.length})</span>
        {chapter.stills.map((still, i) => (
          <StillEditor
            key={still.id}
            still={still}
            index={i}
            total={chapter.stills.length}
            path={`${base}.stills`}
            draft={draft}
            open={openStills.isOpen(still.id)}
            onToggle={(next) => openStills.setOpen(still.id, next)}
          />
        ))}
        {chapter.stills.length === 0 && <EmptyNote>No photographs in this chapter.</EmptyNote>}
        <div className="btn-row">
          <button
            type="button"
            className="btn"
            onClick={() => {
              const id = newId();
              draft.append(`${base}.stills`, {
                id,
                caption: "",
                src: {
                  id: newId(),
                  publicId: null,
                  url: "",
                  alt: "",
                  caption: "",
                  width: null,
                  height: null,
                  durationMs: null,
                },
              } satisfies Still);
              openStills.reveal(id);
            }}
          >
            Add a photo
          </button>
        </div>
      </div>
    </Item>
  );
}

function FilmEditor({
  film,
  index,
  total,
  path,
  draft,
  open,
  onToggle,
}: {
  film: Film;
  index: number;
  total: number;
  path: string;
  draft: DraftSite;
  open: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <Item
      index={index}
      title={hasContent(film.title) ? film.title : "Untitled video"}
      badges={film.src.url ? undefined : <span className="badge badge-warn">No file</span>}
      open={open}
      onToggle={onToggle}
      onUp={index > 0 ? () => draft.move(path, index, index - 1) : undefined}
      onDown={index < total - 1 ? () => draft.move(path, index, index + 1) : undefined}
      onRemove={() => draft.remove(`${path}.${index}`)}
      removeLabel={`Remove video ${index + 1}`}
    >
      <MediaUploader
        label="Video file"
        accept="video/*"
        media={film.src}
        onChange={(next) => draft.set(`${path}.${index}.src`, next)}
        onClear={() => draft.set(`${path}.${index}.src`, { ...film.src, url: "", publicId: null })}
      />
      <TextField
        label="Title beside the video"
        value={film.title}
        onChange={(v) => draft.set(`${path}.${index}.title`, v)}
        maxLength={200}
        placeholder="A name for this clip"
      />
      <TextAreaField
        label="Line to her"
        value={film.note}
        onChange={(v) => draft.set(`${path}.${index}.note`, v)}
        rows={3}
        maxLength={1000}
        hint="Write it to her, not about her."
      />
    </Item>
  );
}

function StillEditor({
  still,
  index,
  total,
  path,
  draft,
  open,
  onToggle,
}: {
  still: Still;
  index: number;
  total: number;
  path: string;
  draft: DraftSite;
  open: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <Item
      index={index}
      title={hasContent(still.caption) ? still.caption : "Untitled photo"}
      badges={still.src.url ? undefined : <span className="badge badge-warn">No file</span>}
      open={open}
      onToggle={onToggle}
      onUp={index > 0 ? () => draft.move(path, index, index - 1) : undefined}
      onDown={index < total - 1 ? () => draft.move(path, index, index + 1) : undefined}
      onRemove={() => draft.remove(`${path}.${index}`)}
      removeLabel={`Remove photo ${index + 1}`}
    >
      <MediaUploader
        label="Photograph"
        accept="image/*"
        media={still.src}
        onChange={(next) => draft.set(`${path}.${index}.src`, next)}
        onClear={() => draft.set(`${path}.${index}.src`, { ...still.src, url: "", publicId: null })}
      />
      <TextField
        label="Caption underneath"
        value={still.caption}
        onChange={(v) => draft.set(`${path}.${index}.caption`, v)}
        maxLength={300}
        placeholder="A caption for this photo"
      />
    </Item>
  );
}

/* ================================================================== *
 * APPEARANCE
 * ================================================================== */

export function AppearanceEditor({ draft }: { draft: DraftSite }) {
  const site = draft.site;
  if (!site) return null;

  return (
    <>
      {/*
        The template and colour pickers live in `Dashboard.tsx`, above this — they
        decide what the fields below are for, so they have to be visible before
        the author scrolls into a long form. What is left here is the editor for
        whichever template is currently selected, plus the 3D ornaments.

        Switching template is non-destructive: `home.moments` holds the
        photographs for both, so nothing is lost either way.
      */}
      {site.template === "modern" ? (
        <ModernEditor draft={draft} />
      ) : (
        <ClassicEditor draft={draft} />
      )}

      <Section title="Extras" hint="Heavy 3D — can slow older phones">
        <ToggleField
          label="Spinning gold heart"
          value={site.ornaments.hero3d}
          onChange={(v) => draft.set("ornaments.hero3d", v)}
          hint="Large animated 3D object on the front page"
        />
        <ToggleField
          label="Drifting gold particles"
          value={site.ornaments.particles}
          onChange={(v) => draft.set("ornaments.particles", v)}
          hint="Animated background on the home and gallery"
        />
      </Section>
    </>
  );
}

/* ================================================================== *
 * TEMPLATE-SPECIFIC EDITORS
 * ================================================================== */

/**
 * The classic template's fields.
 *
 * Split out of `AppearanceEditor` purely so the template switch reads as one
 * conditional rather than two sets of fields interleaved. Nothing here is
 * template-aware; these are the sections the modern template does not use.
 */
function ClassicEditor({ draft }: { draft: DraftSite }) {
  return (
    <>
      <HomeEditor draft={draft} />
      <GalleryEditor draft={draft} />
    </>
  );
}

/**
 * The modern template's copy.
 *
 * Photographs are not here on purpose — they are `home.moments`, and the
 * moments editor below edits them for both templates. Duplicating an uploader
 * would mean uploading each photo twice and would leave the two lists free to
 * disagree.
 */
function ModernEditor({ draft }: { draft: DraftSite }) {
  // Hooks first, before the early return. The original site carried the same
  // guard and got away with it; this one is rendered conditionally by the
  // template switch, which is exactly the case React's rule is about — the hook
  // count would change with the template.
  const site = draft.site;
  const openMoments = useOpenItems(initiallyOpenItems(site).moments);

  if (!site) return null;

  const modern = site.modern;

  return (
    <>
      <MomentsEditor draft={draft} open={openMoments} modern />

      <Section title="First impression" hint="The first thing she sees">
        <TextField
          label="Small label above the headline"
          value={modern.hero.eyebrow}
          onChange={(v) => draft.set("modern.hero.eyebrow", v)}
          placeholder="A small universe"
          maxLength={120}
        />
        <TextField
          label="Headline, line 1"
          value={modern.hero.lines[0] ?? ""}
          onChange={(v) => draft.set("modern.hero.lines.0", v)}
          placeholder="For"
          hint="Short. This is set very large."
          maxLength={120}
        />
        <TextField
          label="Headline, line 2"
          value={modern.hero.lines[1] ?? ""}
          onChange={(v) => draft.set("modern.hero.lines.1", v)}
          placeholder="someone"
          hint="This line renders in the serif accent."
          maxLength={120}
        />
        <TextField
          label="Headline, line 3"
          value={modern.hero.lines[2] ?? ""}
          onChange={(v) => draft.set("modern.hero.lines.2", v)}
          placeholder="worth everything"
          maxLength={120}
        />
        <TextAreaField
          label="Under the headline"
          value={modern.hero.subline}
          onChange={(v) => draft.set("modern.hero.subline", v)}
          rows={3}
          maxLength={300}
          hint="One or two lines about why this is for her."
        />
        <div className="field-row field-row-2">
          <TextField
            label="Button"
            value={modern.hero.ctaLabel}
            onChange={(v) => draft.set("modern.hero.ctaLabel", v)}
            placeholder="Open the note"
            maxLength={120}
          />
          <TextField
            label="Scroll link"
            value={modern.hero.scrollHint}
            onChange={(v) => draft.set("modern.hero.scrollHint", v)}
            placeholder="Drift through"
            maxLength={120}
          />
        </div>
      </Section>

      <Section title="Her note" hint="Opens when she taps the button">
        <TextField
          label="Small label"
          value={modern.letter.kicker}
          onChange={(v) => draft.set("modern.letter.kicker", v)}
          placeholder="Private note"
          maxLength={120}
        />
        <TextAreaField
          label="The note"
          value={modern.letter.text}
          onChange={(v) => draft.set("modern.letter.text", v)}
          rows={6}
          maxLength={2000}
          hint="Set in the serif italic. This is the thing she reads twice."
        />
        <TextField
          label="Sign-off"
          value={modern.letter.signoff}
          onChange={(v) => draft.set("modern.letter.signoff", v)}
          placeholder="Yours, always"
          maxLength={200}
        />
      </Section>

      <Section title="Photo strip" hint="The row of narrow slices">
        <TextField
          label="Small label"
          value={modern.strip.eyebrow}
          onChange={(v) => draft.set("modern.strip.eyebrow", v)}
          placeholder="Contact sheet"
          maxLength={120}
        />
        <TextField
          label="Heading"
          value={modern.strip.heading}
          onChange={(v) => draft.set("modern.strip.heading", v)}
          placeholder="Pick one. Stay a while."
          maxLength={120}
        />
        <TextAreaField
          label="Note beside it"
          value={modern.strip.note}
          onChange={(v) => draft.set("modern.strip.note", v)}
          rows={2}
          maxLength={200}
        />
      </Section>

      <Section title="Archive" hint="The drifting sphere on the home page">
        <TextField
          label="Small label"
          value={modern.archive.eyebrow}
          onChange={(v) => draft.set("modern.archive.eyebrow", v)}
          placeholder="Memory archive"
          maxLength={120}
        />
        <TextField
          label="Heading"
          value={modern.archive.heading}
          onChange={(v) => draft.set("modern.archive.heading", v)}
          placeholder="A few favorite signals."
          maxLength={120}
        />
        <TextAreaField
          label="Note beside it"
          value={modern.archive.note}
          onChange={(v) => draft.set("modern.archive.note", v)}
          rows={2}
          maxLength={200}
        />
        <TextField
          label="Button"
          value={modern.archive.ctaLabel}
          onChange={(v) => draft.set("modern.archive.ctaLabel", v)}
          placeholder="Open the archive"
          maxLength={120}
        />
      </Section>

      <Section title="Archive page" hint="What she sees at /gallery" defaultOpen={false}>
        <TextField
          label="Small label"
          value={modern.gallery.eyebrow}
          onChange={(v) => draft.set("modern.gallery.eyebrow", v)}
          placeholder="The archive"
          maxLength={120}
        />
        <TextField
          label="Headline, line 1"
          value={modern.gallery.lines[0] ?? ""}
          onChange={(v) => draft.set("modern.gallery.lines.0", v)}
          placeholder="Every"
          maxLength={120}
        />
        <TextField
          label="Headline, line 2"
          value={modern.gallery.lines[1] ?? ""}
          onChange={(v) => draft.set("modern.gallery.lines.1", v)}
          placeholder="orbit"
          hint="This line renders in the serif accent."
          maxLength={120}
        />
        <TextField
          label="Headline, line 3"
          value={modern.gallery.lines[2] ?? ""}
          onChange={(v) => draft.set("modern.gallery.lines.2", v)}
          placeholder="we ran"
          maxLength={120}
        />
        <TextAreaField
          label="Under the headline"
          value={modern.gallery.blurb}
          onChange={(v) => draft.set("modern.gallery.blurb", v)}
          rows={3}
          maxLength={500}
        />
        <TextField
          label="Back button"
          value={modern.gallery.backLabel}
          onChange={(v) => draft.set("modern.gallery.backLabel", v)}
          placeholder="Return home"
          maxLength={120}
        />
      </Section>

      <Section title="Closing" hint="The last thing she reads" defaultOpen={false}>
        <TextAreaField
          label="Heading"
          value={modern.closing.heading}
          onChange={(v) => draft.set("modern.closing.heading", v)}
          rows={2}
          maxLength={200}
        />
        <TextAreaField
          label="A line under it"
          value={modern.closing.copy}
          onChange={(v) => draft.set("modern.closing.copy", v)}
          rows={3}
          maxLength={500}
        />
        <TextField
          label="Signature"
          value={modern.closing.signature}
          onChange={(v) => draft.set("modern.closing.signature", v)}
          placeholder="With love"
          maxLength={80}
        />
      </Section>
    </>
  );
}
