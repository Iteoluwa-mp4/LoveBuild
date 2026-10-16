# Classic — Release Print

## Scope and mode

Target: `src/components/site/classic/` — the `classic` template, served at
`/s/:slug`, `/s/:slug/gallery` and `/preview`.

Visitor mode: **Experience**. The visitor is one named person who has been sent
one link. They have no task, no choice to make, and nothing to convert. The work
leads; the interface recedes to film-strip chrome.

Reach: home page and gallery page are one world. The chrome — the slate, the
frame rails, the running readout, the tail leader — is shared between them.

## Audience, job, proof, constraints

- **Author** (unseen): fills a form, publishes one link.
- **Visitor**: reads to the end. The proof is the photographs and the words —
  nothing is claimed, nothing is sold.
- **Proof available**: `sample()` in `src/lib/site/default.ts` — four moments, a
  quote, a five-paragraph letter, a closing section, three closing cards, a
  three-chapter gallery with films and stills. Production-quality instructional
  copy. No photography exists; empty media slots must render honestly.
- **Constraints carried from PRODUCT.md**: config purity (no hardcoded content in
  a component); every `EditableText` keeps its dotted path, `maxLength` and
  placeholder; media regions always render, text regions hide when empty;
  scroll reveals stay JS-classed with the 1.2s failsafe and no CSS-only hidden
  state; all five theme presets must work; must not resemble the modern orbit or
  the scrapbook paper.

## Direction

**A motion-picture release print.** The site is a strip of 35mm film running
under a light. Matte black leader stock is the ground; the photographs are the
frames; the theme accent is the *emulsion* — the light coming through the film,
not chrome laid over it. Sprocket perforations run top and bottom of every
frame. Real film carries tiny printed edge markings between frames; those become
the page's technical voice and only ever carry real numbers. Gallery chapters
are reels in cans, numbered; films play inside a frame; photographs hang as a
contact strip. The page is dark because the scene is dark: she is on her phone,
at night, and this is a print coming up in front of her.

The decision round ran `concept-seed --scope direction --mode experience`
(seed `502ccb0f`), which assigned grounded candidate 4 of my list. No decision
page could be served — the interview channel was dismissed and no desktop
browser is attached — so the roll was honoured and the substitution disclosed.

### Verdicts on the dealt challengers

| # | Challenger | Verdict | Kept / raised |
|---|---|---|---|
| 1 | Ikebana in a tokonoma alcove | declined | **Raise — `ma`.** The page plans its emptiness as an active region. A whole viewport may be mostly ground with one line on it. |
| 2 | Brick build-instruction book | declined | **Raise — the stud grid.** One declared module governs the whole layout; every rule, perforation, frame edge and caption baseline snaps to it, and a caption is registered to its frame at 1:1. |
| 3 | Screenprint through translucent paper | competitive | **Kept — the registration cross and the off-register second pass.** One ink deliberately printed a hair out of register. |
| 4 | Sapeur portrait plate | competitive | **Kept — the ruled caption with a leader line** from the name back to its frame. |
| 5 | Ikeda datamatics | declined | **Raise — the field.** A real generative emulsion on canvas — grain, dust, weave — not a gradient wash. |
| 6 | Rhythm-machine step row | declined | **Raise — the running readout.** A persistent position rail that always says where in the reel you are. |

### Memorable moment

**Develop it.** A frame on the strip is dark until light passes through it.
Opening a moment runs it through the gate: the emulsion comes up out of grain —
blurred, low-contrast blotches resolving into the sharp image — while the words
written underneath it develop at the same rate, one line at a time, as though
the print and the caption were on the same sheet. It is the one authored moment
on the page, and it is the product's thesis in one gesture: he made this, and
light is what reveals it.

## Direction contract

**THESIS.** A gift site is not a landing page with photographs on it; it is a
strip of film with a person printed on it, and the only thing that makes it
visible is that someone turned the light on. The build refuses the category
default — dark hero, gradient-clipped serif, 3D ornament, a row of equal photo
cards — by making the film's own mechanism the page: the strip is the layout,
the perforations are the grid, the running position is the navigation, and the
reveal is a print developing rather than a pixel wipe.

**OWN-WORLD.** Matte warm-black leader stock with real perforation rails top and
bottom of every frame; a canvas-generated emulsion (seeded grain, dust specks,
faint weave) over the whole ground; one luminous accent that behaves as *light in
the film* — flat emissive, blooming softly, never a gradient across text and
never a glass panel; hard 1px emulsion hairlines at 12–24% doing all the
separating work, with one raised edge where a rule catches the light; corner
radii of 2px and nothing else, because a film frame has square corners; frame
numbers and reel positions set in a condensed grotesque at 10–11px, tracked
`0.18em`, always reporting a real count. Type: **Gloock** for display — a
high-contrast, slightly archaic, engraved-warm face that carries a cinema title
card without becoming a luxury-magazine serif — and **Archivo** for reading and
UI, its narrow sibling for every edge marking. Two voices only: engraved, and
industrial.

**STORY.** She arrives from one link. In the first viewport she knows what this
is, who it is for, and how much is waiting: the strip runs across the bottom
third with one frame lit and four still dark, so the site counts its own
promise before she scrolls. She moves right along the strip, develops whatever
she likes, reads the quote and then the letter behind it, and reaches the tail
leader knowing how many reels there were. She believes the thing is real because
it is printed rather than styled — nothing glows that is not carrying light, and
nothing is chrome she does not need.

**FIRST VIEWPORT.** Full-bleed, no card. A 96px film slate across the top: the
site's name in Gloock at the left, `HOME` / `THE REEL` at the right in edge
markings with an underline marking the current page. The headline sits left of
centre at `clamp(2.75rem, 7vw, 5.75rem)` in Gloock, three lines, the last one
in flat emulsion with a soft bloom behind it — 9vw of quiet to its left, never
centred on the full width. The subline sits beneath at 68ch in Archivo. The
primary action is a flat emulsion bar with a hard 1px dark edge, left-aligned
under the subline; there is no ghost secondary in the same place. The bottom
33% is the strip: a horizontal band entering past the left edge, two
perforation rails, five frames at least, **frame 01 lit and frames 02–05 dark**,
each dark frame showing only its leader stock, its frame number and a 1px
registration cross. A hairline of light leaks in from the lower-right corner.
Nothing is centred. Everything is on the module.

**FORM.** The release-print system, chosen from my grounded list at position 4,
seed `502ccb0f`. Form, structure and grammar: horizontal film strip; sprocket
perforations as the grid and the section separator; edge markings as the only
technical type; a can label for chapter openings; an academy-leader countdown as
the gallery's opener; contact strip for stills; tail leader for the close;
develop-under-light as the reveal; running readout as position.

**FINISH.** unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance.

## Unresolved

- No live browser is attached to this session, so the batched screenshot round
  and the finish reviewer have no capture evidence. Verified by `npm run build`,
  `npm test` and `impeccable detect` instead, and disclosed.
- `ornaments.hero3d` in the schema is now the light-leak/emulsion layer rather
  than a 3D object. The key is kept so stored configs keep parsing; the meaning
  changed and the schema comment says so.