# Adding a template — prerequisites

Read this before writing any template code. A template touches more than one
file, and the failure mode is always the same shape: the page renders, the
dashboard looks fine, and one of the two is quietly showing something else —
usually a preview that renders a different template from the one that
publishes, or a form field that edits words no page displays.

Work through the checklist in order. Steps 1–5 are the minimum for the
template to exist at all; the rest are what keeps it honest.

---

## 0. The contract: the main heading

**The first big heading a visitor reads must be the field the "First
impression" section edits.** Not a hardcoded string, not a second copy of the
words, not a field the form never shows. One source, both ends.

| Template | Main heading on the page | Section in the form | Stored at |
| --- | --- | --- | --- |
| Scrapbook (standard form) | cover `<h1>` | First impression | `home.hero.lines` |
| Modern | hero `<h1>` | First impression | `modern.hero.lines` |
| Editorial | cover title `<h1>` | First impression | `identity.name` |
| God Poetry | cover title `<h1>` | First impression | `godpoetry.hero.lines` |

Rules that follow from it:

- **No hardcoded headings.** If a template ships with words, they are the
  *fallback* for an empty field, never the value that wins.
- **Blank lines drop out**; an entirely blank headline falls back to the
  seeded wording rather than rendering an empty cover.
- **The section carries a `SECTION_ID`.** `SECTION_ID.hero` for a template
  with its own hero block, `SECTION_ID.identity` when the heading *is* the
  site name — either way an id from `SECTION_ID`, so outline rows and
  "edit →" buttons land on the section that holds the field.
- **Labels say what the visitor sees** ("Headline, line 1"), hints say where
  it appears ("This line gets the gold gradient"). A field whose hint
  describes something the page does not do is a bug in the copy.

A template that cannot honour this should say so in its section hint rather
than pretending: dead fields in the form are the same defect as a dead
heading on the page.

---

## 0b. The contract: every reveal scrolls

**Wherever a click opens or reveals something on a page of the site — a note,
a panel, a photograph, an expanded row — the scroll-to-section function has to
kick in and take the reader to it.** The revealed thing is usually below the
fold; that is most of why it needed opening. A button that flips a boolean
and leaves the result off screen has done half the job.

Arm it with `useScrollToReveal` (`src/hooks/useScrollToReveal.ts`), the
site-side twin of the dashboard's jump:

```tsx
const readRef = useRef<HTMLDivElement>(null);
useScrollToReveal(openNote, readRef);
…
{openNote !== null && <div ref={readRef} …>…</div>}
```

The rules:

- **The trigger is the state the reveal is keyed on**, not a boolean invented
  for the occasion. `null`, `undefined` and `false` are closed; **`0` counts
  as open**, because an index of zero is the first item rather than the
  absence of one. Changing while already open scrolls again — the second row
  the reader picks is a second destination, and its detail sits below the
  whole list.
- **Aim at the revealed element with a ref**, so the target cannot drift away
  from the markup. The scroll runs one frame after React commits: inside the
  click handler the conditional render has not happened yet, and a target
  that does not exist is a silent no-op.
- **Never on first paint.** The trigger starts closed — this is a reaction to
  a click, not a page-load animation.
- **`block: "start"` (the default) for a section-sized reveal** — a letter
  panel, an opened detail, a note: it lands at the top of the viewport.
  **`block: "nearest"` for a reveal that sits where the reader already is** —
  a caption under the photo strip, a widget on screen — so it moves only when
  the thing has actually ended up off screen.
- **Two exceptions, both deliberate:**
  - **Overlays.** A dialog covering the viewport — how the editorial
    template's figures open — has no section to scroll to: the reveal *is*
    the viewport, and scrolling the page underneath a modal has no visible
    effect. Wire nothing there.
  - **Movement inside a widget already in view** (the flipbook's cover and
    page turns) is still armed, with `"nearest"`: the guarantee that the
    widget is in view is stated, and the scroll no-ops the rest of the time.
- Reduced motion, opening collapsed `<details>` in the way, and a missing
  target being a no-op rather than an error all come from `scrollToSection`.
  Do not re-implement them.

---

## 0c. The contract: her name and the monogram

Two values belong to *her*, not to any one layout, so every template has to
offer both and slot them in:

| Field | What it is | Where it goes |
|---|---|---|
| `identity.name` | Her name — what the copy calls her | Wherever the page addresses her: the modern's hero meta and sphere, the editorial's issue title, the scrapbook's cover greeting |
| `identity.initials` | The monogram — `O + Y` | Wherever the page prints a short mark: the top bar's wordmark, the masthead line |

The rules:

- **Offer both in the editor, always.** Use `IdentityFields` from
  `editors.tsx` — the same paths, placeholders and limits on every template —
  wrapped in the template's own `Section`. The *label* on the name may vary
  (`"Issue title"` on the editorial, where the name is the cover); the field
  does not. A form that cannot change a value the page prints is the §0
  defect one level down.
- **Slot them in wherever the design has a natural home for them**, and say
  where in the section hint. The name greets her where the copy addresses
  her; the monogram takes the place of the template's own short mark.
- **Blank falls back to the template's designed default, never to nothing.**
  Clearing the monogram brings back `OURS.` / `ours` / the slug, and clearing
  the name degrades to the greeting the template shipped with. An empty
  corner where a mark belongs is a rendering bug, not a fallback.
- **One field each, shared by every template** — never a per-template copy.
  Two lists of her name would disagree the moment one was edited, which is
  the same reasoning as one list of photographs (§1).
- Both are sample-seeded (`"Her name"`, `"O + Y"`), so `findSampleText`
  flags them until they are replaced, and `identity.*` paths jump to the
  section that owns them through the existing `SECTION_BY_PATH` entry —
  no jump wiring needed for a new field under `identity.*`.
- A page with no natural home for the monogram does not invent one; it
  simply does not print it. The *option* exists on every template either
  way, because the field is shared and the form is not.

---

## 0d. The contract: every field renders, and the limit is the schema's

Both rules come from the same defect. The scrapbook's form offered a hero
subtitle, two button labels, a quote-and-letter block and a closing
section; the page rendered none of them, and the subtitle and the main
button label were still counted as outstanding work at publish time — the
author was chased to finish fields nobody would ever see.

- **Every field the editor shows for a template must render on that
  template's page.** The form is a promise. Gate whole sections through
  `visibleBlocks` rather than re-deriving "is this empty" inside the page,
  so the dashboard outline and the page can never disagree about whether a
  block exists. Where the design has no home for a field, the field does not
  go in that template's editor at all — that is what makes the editors
  template-specific. Hiding the input is how a dead field gets buried;
  wiring it in is how it gets fixed.
- **`maxLength` mirrors the schema cap — the same number at both ends.**
  The browser limit is the save limit: one character past
  `z.string().max(60)` and the whole autosave is rejected as an invalid
  config, which reads as "the save is broken" rather than "that field is too
  long". Add the field to the schema first, then copy the number into the
  editor. Mismatches here have shipped more than once, which is why this is a
  contract rather than a habit.

---

## 1. Schema and defaults

- `src/lib/site/schema.ts`
  - Add the id to `TEMPLATE_IDS`. `templateSchema` derives from it: an id the
    build no longer knows falls back to `editorial` rather than rejecting the
    config, so adding here is safe for stored sites.
  - If the template has its own copy, add a `<name>Schema` block **present on
    every config, whatever `template` says** — the way `modern` and
    `editorial` are. That is what makes switching templates non-destructive:
    a draft never loses its words because a different layout was briefly
    chosen.
- `src/lib/site/default.ts` — seed that block in `sample()` / `defaultSite()`
  (and `emptySite()` if it differs). The seed is the demo, the standalone
  preview, and the text every hint and placeholder is written against.

## 2. Render the template

- `src/components/site/<name>/` with `HomePage.tsx`, `GalleryPage.tsx`,
  `paths.ts`, `shared.tsx` — the shape the other three use.
- **CSS is emitted as a string** (`MODERN_BASE_CSS`, `SCRAPBOOK_BASE_CSS`,
  `EDITORIAL_BASE_CSS`) and rendered by each page, so a page can be mounted
  anywhere — dashboard iframe, standalone route, published site — without a
  stylesheet import that only resolves in one of them.
- **Read the shared config.** Photographs are `home.moments` (see §6), the
  heading is whatever §0 says, `identity.name` is the site name. A private
  copy of anything shared is a second source of truth that will disagree.
- Make the copy you want editable on the page use `EditableText` with a
  dotted `path`. **Every path must exist in `siteSchema`**: the preview frame
  parses every config it is handed, and a path the schema does not know is
  stripped — the edit appears to work and is gone on the next post.

## 3. Routes — two switches that must agree

- `src/App.tsx`
  - `SitePages`: the home/gallery switch that renders the published site.
  - Dev preview routes at the template's own `BASE` from its `paths.ts`,
    plus a `…PreviewPage` mounting it against `sample()`.
- `src/components/dashboard/PreviewPage.tsx` — the **same** switch, written
  out line for line.

These two are the classic drift point: scrapbook was added to `SitePages`
and missed here, so the preview rendered one template and the published site
rendered another, silently. If you add a branch to one, add it to the other
in the same commit.

## 4. The dashboard

- `src/components/dashboard/fields.tsx` — add to `TEMPLATES` (id, label,
  note, icon). The note is a sentence about what the layout is *like*; it is
  the only thing anyone reads before choosing.
- **Private templates:** gate the card through `isTemplateAvailable` in
  `src/lib/site/templateAccess.ts`, and pass the signed-in email from the
  dashboard. Mirror the same check on the template's development preview
  route. This restricts *authoring*, never rendering: a published `/s/:slug`
  page must stay readable by the recipient without an account.
- `src/components/dashboard/editors.tsx` — add the branch in
  `AppearanceEditor` and write the template's editor. Give every section an
  id from `SECTION_ID`, and include the **First impression** section per §0.
  The editor takes `part: EditorPart` and renders each section in exactly
  one half: `structure` (template, photographs, the blocks that show them)
  and `words` (name, headline, letter, closing) — the two groups the
  dashboard draws around it.
  Keep template-specific sections out of the shared editors: only one
  template's editor renders at a time, so ids never collide between them —
  `hero` is the standard form's First impression and the modern one's.

## 5. Jumps

- `src/components/dashboard/jumpTarget.ts`
  - New section → new `SECTION_ID` entry (with a comment naming the section
    as the form shows it).
  - Every config path your template owns → a `SECTION_BY_PATH` prefix entry,
    including `<name>.*` paths, or the outline's "edit →" and What's Left?
    buttons point at nothing.
- Ids are matched, never titles — section headings grow counts and change
  wording, which is exactly how the old title-matching version stopped
  working without throwing.

## 6. Colours

- `src/lib/site/themes.ts` — add the id to `THEMED_TEMPLATES` **only** if the
  template renders from the shared presets. A template with its own palette
  stays out, and `templateUsesThemes` then tells the picker to say "This
  template has its own fixed colours" instead of offering presets that do
  nothing.

## 7. Photographs

One list, always: `home.moments`, read through a mapper in
`src/lib/site/derive.ts` (`modernMemories`, `scrapbookMemories`,
`editorialMoments`). A moment's fields are reinterpreted per template —
caption becomes a story headline, date a dateline — never copied. A second
upload list means uploading each photo twice and two lists free to disagree,
and a template switch that strands the author's work.

## 8. Outline and visibility

If the template introduces blocks the author can empty out, extend
`visibleBlocks` and `siteOutline` in `derive.ts` so the outline greys the row
when the block will not render. Every outline row's `path` must be a path a
section in *some* editor owns (§5), otherwise the row is a button that does
nothing — the failure the jump-mapping rewrite exists to prevent.

## 9. Tests

- `src/lib/site/__tests__/site.test.ts` — the `templates` describe: the id
  parses, an unknown id falls back, switching `template` does not lose the
  other template's copy.
- `src/components/dashboard/__tests__/jumpTarget.test.ts` — `sectionIdFor`
  for each path your template owns.
- `src/lib/site/__tests__/derive.test.ts` — your memories/moments mapper.

Then: `npm run typecheck`, `npm run lint`, `npm test`.

## 10. Manual check before shipping

1. Pick the template in the dashboard. The editor switches to *your* fields.
2. Type in **First impression** → the heading changes in the preview, live.
3. Switch to another template and back → nothing you typed is lost.
4. Reload the preview frame → still your draft (it round-trips through
   `sessionStorage` and `siteSchema`).
5. Click the outline row for the heading → the form scrolls to the field.
6. Click every button that opens something — a note, a panel, a photograph,
   an expanded row — on the home page and the gallery. Each reveal comes
   into view (§0b).
7. Type a name and a monogram (`O + Y`) → both appear where §0c promises:
   the greeting in the copy and the mark in the top bar or masthead. Clear
   them → the template's own mark comes back, never an empty corner.
8. Publish, open `/s/:slug` → the published page matches the preview.
