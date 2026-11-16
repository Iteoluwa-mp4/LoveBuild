/**
 * Where a jump lands.
 *
 * The dashboard's pointing buttons — the outline rows, and every `edit →` in
 * What's Left? — hold a config path such as `home.moments.1.caption`. A path is
 * not a place on screen: something has to turn it into the section of the form
 * that owns it.
 *
 * That used to be done by matching section *headings*, and it quietly stopped
 * working when the headings grew counts — the code looked for "Moments" while
 * the form rendered "Photographs (4)". Nothing threw; the buttons simply did
 * nothing, which is the worst shape for this bug in particular: the list whose
 * whole job is to say "here is the thing to fix" pointed at every one of those
 * things and took you nowhere.
 *
 * So the mapping is by id. Ids come from `SECTION_ID`, and the sections
 * themselves are given those same ids from this object, so a section and the
 * jump pointing at it cannot drift apart. The only way to break a jump is to
 * remove the section, and then there is nothing to scroll to anyway — which
 * `useScrollToSection` treats as the no-op it honestly is.
 */

/**
 * The id of every form section that can be jumped to.
 *
 * One name per section, shared by the editors and by `sectionIdFor`. The
 * template-specific sections are all here: only one template's editor is
 * rendered at a time, so their ids never collide even where the sections do
 * the same job — `hero` is the standard form's "First impression" and the
 * modern one's.
 */
export const SECTION_ID = {
  /** "Site name" on the standard form, "First impression" on the editorial. */
  identity: "section-identity",
  /** "First impression" — the hero, whichever template is selected. */
  hero: "section-hero",
  /** "Photographs" — `home.moments`, on every template. */
  moments: "section-moments",
  /** "Quote and letter" on the standard form, "The quote" on the editorial. */
  quote: "section-quote",
  /** "From the editor" — the editorial letter. */
  letter: "section-letter",
  /** "Closing section". */
  footer: "section-footer",
  /** "Gallery intro and outro". */
  galleryIntro: "section-gallery-intro",
  /** "Chapters". */
  chapters: "section-chapters",
  /** The template picker. */
  template: "section-template",
  /** The colour picker. */
  colours: "section-colours",
  /** Modern: "Her note". */
  modernNote: "section-modern-note",
  /** Modern: "Photo strip". */
  modernStrip: "section-modern-strip",
  /** Modern: "Archive". */
  modernArchive: "section-modern-archive",
  /** Modern: "Archive page" — what she sees at /gallery. */
  modernGallery: "section-modern-gallery",
  /** Modern: "Closing". */
  modernClosing: "section-modern-closing",
} as const;

/**
 * Which path prefix each section owns.
 *
 * The outline and What's Left? only ever produce `home.*` and `gallery.*`
 * paths today; the `modern.*` and `editorial.*` entries are here so a caller
 * pointing at template-specific config gets the right section for free rather
 * than silently getting none.
 */
const SECTION_BY_PATH: ReadonlyArray<readonly [path: string, section: string]> = [
  ["identity", SECTION_ID.identity],
  ["editorial.person", SECTION_ID.identity],
  ["home.hero", SECTION_ID.hero],
  ["modern.hero", SECTION_ID.hero],
  ["home.moments", SECTION_ID.moments],
  ["home.quote", SECTION_ID.quote],
  ["editorial.quote", SECTION_ID.quote],
  ["editorial.letter", SECTION_ID.letter],
  ["home.footer", SECTION_ID.footer],
  ["gallery.hero", SECTION_ID.galleryIntro],
  ["gallery.outro", SECTION_ID.galleryIntro],
  ["gallery.chapters", SECTION_ID.chapters],
  ["template", SECTION_ID.template],
  ["theme", SECTION_ID.colours],
  ["modern.letter", SECTION_ID.modernNote],
  ["modern.strip", SECTION_ID.modernStrip],
  ["modern.archive", SECTION_ID.modernArchive],
  ["modern.gallery", SECTION_ID.modernGallery],
  ["modern.closing", SECTION_ID.modernClosing],
];

/**
 * The id of the section owning a config path, or null when no section does.
 *
 * Walks the path from the whole thing down to its first segment, so the
 * deepest section containing the path is the one that wins:
 * `gallery.chapters.2.films.0.title` falls back to `gallery.chapters`, and
 * `home.quote.truth` falls back to `home.quote` rather than overshooting to
 * the root.
 *
 * Null means genuinely nowhere to go — a path no section owns, or one whose
 * section belongs to a template that is not selected.
 */
export function sectionIdFor(path: string): string | null {
  const segments = path.split(".");
  for (let end = segments.length; end > 0; end -= 1) {
    const prefix = segments.slice(0, end).join(".");
    const hit = SECTION_BY_PATH.find(([owned]) => owned === prefix);
    if (hit) return hit[1];
  }
  return null;
}
