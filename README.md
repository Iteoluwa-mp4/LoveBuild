# LoveBuilds

A dashboard where someone fills in a form, and a site renders what they submitted.

The name is from *Lovebirds*. Someone builds a site; love builds.

Built on a config-driven template: all content lives in one typed object, and no
component may hardcode a string, a colour, or an image path. That single rule is
what makes one codebase able to serve many sites.

## The one idea

```
┌───────────────────────────┐        ┌──────────────────────────┐
│  ONE BOX OF DATA          │  ───►  │  THE MACHINE             │
│  title: "Happy Birthday…" │        │  reads the box, draws it │
│  photos: [...]            │        │                          │
│  theme: "rose"            │        │  never changes           │
└───────────────────────────┘        └──────────────────────────┘
```

A component may never contain a sentence, a colour, or a photo path. If you find
one, it belongs in the box. That is the whole architecture, and everything below
is a consequence of it.

## Current state — Step 4b of 7

Done:

- **Schema** — `src/lib/site/schema.ts`. The single source of truth. Zod, so the
  form, the database column and the components all agree.
- **Themes** — `src/lib/site/themes.ts`. Five presets as pure data, applied to
  `<html>` so the whole document follows, not just a nested div.
- **Derivation** — `src/lib/site/derive.ts`. Computed values and visibility rules.
- **Template** — `src/components/site/`. Both pages render entirely from config.
- **Repository seam** — `src/lib/site/repository.ts`. One interface;
  `LocalSiteRepository` implements it today.
- **Auth** — `src/lib/site/auth.ts`. A local passcode. See below for what it is.
- **Path editing** — `src/lib/site/path.ts`. Immutable get/set/splice/move by
  dotted path, so every input binds without knowing where it lives.
- **Dashboard** — `/dashboard/:slug`. Form, live preview, outline, autosave.
- **Tests** — 187 passing. `npm test`

Cloudinary uploads are still to do.

## Storage, auth and publishing

Everything is stored in this browser's localStorage, and the app runs with no
`.env`, no account and no server. That is the design, not a prototype stage.

### The passcode is a gate, not a lock

`/login` asks for a passcode, and the dashboard is unreachable without one. Be
clear about what that buys: **nothing to read.** The sites, the config and the
photos are all already in localStorage, and any script on the origin can read the
same keys. The passcode exists so the editor — where someone writes a love letter —
is not one stray keystroke away, not to protect data.

It is salted SHA-256 in `auth.ts`. The salt is not defence against anything real;
it is there so two people choosing the same passcode do not store the same string.

`useSession` keeps its three states (`checking`, `signed-out`, `signed-in`) and
`RequireAuth` keeps its call sites, so a real backend later is a change to
`auth.ts` and one subscription — not a rebuild of the gate.

### Publishing

New sites are drafts, and a draft is invisible: the shared link returns nothing.
**Publish site** in the dashboard flips it, behind a confirm that names how many
fields are still missing or placeholder.

Publishing flushes first. `flush()` resolves false if anything is unsaved, and
keeps re-saving until what is on screen is what is on disk — so you cannot publish
an older version while newer edits sit in a debounce timer.

After that first flip, every save goes live immediately, without asking. That is
the trade for not building a review gate: **once published, he can break the live
site himself.** Unpublish hides it again.

### Uploads

Photos and videos are measured and previewed from a blob URL, then marked
"Not uploaded". A blob URL dies with the page, so previews disappear on reload
while the text and structure survive. The dashboard says so in as many words
rather than letting someone find out at the worst moment.
## Commands

```bash
npm run dev         # dev server
npm run build       # typecheck, then production build
npm run typecheck   # tsc only
npm test            # vitest, single run
npm run lint
```

## Routes

`/` is the dashboard, not a published site. LoveBuilds is a tool someone sits down
at; the site is the thing it produces.

| Route | What it is |
|---|---|
| `/` | redirects to the dashboard |
| `/dashboard` | redirects to the site being edited |
| `/dashboard/:slug` | the editor |
| `/s/:slug` | the public site — home page |
| `/s/:slug/gallery` | the public site — gallery |
| `/preview`, `/preview/gallery` | the frame the editor previews in. Deliberately **not** under `/s/`, so it can never be a link someone shares |
| `/dev/themes`, `/dev/blocks`, `/dev/outline` | dev screens, deleted once the backend lands |

`SEED_SLUG` in `src/lib/site/default.ts` is the demo site. It is called `hers`
because that is what the seeded copy is — one person's birthday site. The service
is LoveBuilds; that is the first thing built with it. One constant, so the routes,
dashboard and loader cannot drift apart.

## Site map

### The two halves

```
PUBLIC                          DASHBOARD
/s/:slug            ←──── link ────→  /dashboard/:slug
/s/:slug/gallery                     /login
/preview  (iframe only)
```

```
src/lib/site/
  schema.ts          the shape of a site — everything derives from this
  themes.ts          5 presets, 36 CSS custom properties each
  derive.ts          computed values + which regions are visible
  sitemap.ts         the footer sitemap, derived from the site
  slug.ts            "For Sarah" → for-sarah
  paths.ts           a site's routes, in one place
  path.ts            immutable edits by dotted config path
  repository.ts      the storage interface
  localRepository.ts localStorage implementation
  getRepository.ts   returns the local one; a second backend slots in here
  auth.ts            the local passcode — a gate, not a lock
  default.ts         sample copy + placeholder detection + createDraft
  load.ts            public site lookup by slug
  brand.ts           storage prefixes + preview message names

src/hooks/
  useDraftSite.ts    the editor's single source of truth
  useSession.ts      who is signed in
  useReveal.ts       scroll-triggered reveal

src/components/site/          THE TEMPLATE — config in, no content
  HomePage  GalleryPage  SiteShell  SiteNav  SiteFooter
  MomentCard-in-HomePage     the moments strip
  MediaPlaceholder            every empty media slot, one component
  FilmFrame  GlossyButton  PixelTransition  ScrollToTop  primitives
  ornaments/                  three.js, lazily loaded
src/components/dashboard/     THE EDITOR
  Dashboard  CreateSite  OutlinePanel  PreviewPane  MediaUploader
  PreviewPage  editors.tsx  fields.tsx  StatusBanner
src/components/auth/          LoginPage  RequireAuth
src/components/dev/           dev screens
```

### Where to change what

| To change | Edit |
|---|---|
| What fields a site has | `siteSchema` in `schema.ts` |
| A colour | `buildTokens` in `themes.ts` — never a hex in a component |
| Whether a section shows | `visibleBlocks` in `derive.ts` |
| Footer links | `buildSitemap` in `sitemap.ts` |
| Where the buttons go | `sitePaths` in `paths.ts` |
| Whether the editor is locked | `auth.ts`, and `RequireAuth` for the gate |

## Dashboard layout

Two panes, each scrolling on its own, and the page itself locked to the viewport.

```
┌──────────────────────────────────────────────┐
│ bar — name · save state · save/view buttons  │  fixed, does not scroll
├───────────────────────────┬──────────────────┤
│ form (scrolls)            │ outline          │
│                           ├──────────────────┤
│                           │ page switch      │
│                           ├──────────────────┤
│                           │ preview (iframe) │
└───────────────────────────┴──────────────────┘
```

Four things make this work, and three of them are invisible until they are wrong:

- **`min-height: 0` on the grid and its columns.** Grid and flex children
  default to `min-height: auto` and refuse to shrink below their content. Without
  it the columns grow past the viewport and `overflow-y: auto` never engages —
  you get the old layout back with no obvious cause.
- **`flex: 0 0 auto` on the children of each pane.** Flex items also shrink by
  default, so in a fixed-height column the sections were silently compressed to
  fit instead of overflowing. `scrollHeight` equalled `clientHeight`, nothing
  scrolled, and content was squeezed. This was the hardest bug in the pass to
  spot, because it looks like "already scrolled to the bottom".
- **`overscroll-behavior: contain` on both panes.** Stop dead rather than chain to
  the page. Also suppresses rubber-banding and the mobile swipe-back gesture.
- **A `wheel` listener inside the preview iframe.** An iframe is a separate
  scrolling document: wheel events over it scroll the frame and never reach the
  parent. At the frame's own limit the event is swallowed there — and it must be
  registered `passive: false`, or `preventDefault()` is ignored and the browser
  scrolls regardless.

**The outline sits above the preview.** Anything placed after the iframe can only
be reached by finding the strip of pane beside it, because the wheel over the
frame belongs to the frame. Status before pixels is also the right order.

Below 1100px the columns stack and all of this is undone — mutual exclusion is
meaningless when the panes are one above the other.

## Collapsed lists

Moments, chapters, films and photographs all start closed, showing a one-line
summary with their count and any missing-file warning. Reorder and delete stay
reachable without opening anything.

A newly added item opens itself. Otherwise "Add a moment" appears to do nothing,
which reads as a broken button rather than a collapsed panel.

Open state is held in the editor components, not in the draft — "which panels are
open" is not part of the site, and putting it in the config would mean saving it,
diffing it and listing it in the outline.

## Why the preview is an iframe

It renders the real template, not a copy. An inline preview would need animations,
scroll-snap and the 3D ornaments switched off to survive a nested scroller — and
every one of those switches is a way for the preview to drift from what visitors
actually see. The draft is posted in over `postMessage` after a 400ms pause, and
the frame announces itself on mount so the first update is not lost.

## Editing on the page

**Edit on page** in the preview bar. Click any text on the page, type, click away.
No form.

The design rests on three things:

- **One path into the config.** An edit made on the page and one typed into a
  field are the same `draft.set` call. `EditableText` reports up through
  `postMessage`; `PreviewPane` forwards to `draft.set`. There is no second
  code path that could treat them differently.
- **Commit on blur.** A controlled `contentEditable` moves the cursor to the end
  on every keystroke, which makes writing a sentence impossible. The browser owns
  the node while it is focused and the result is read afterwards. Enter commits,
  Escape reverts.
- **The DOM is synced back.** Being uncontrolled means being able to drift: an
  early version reported edits but never rewrote the node, so a later commit sent
  stale browser text into the config and overwrote a field nobody had touched.
  `EditableText` now has a ref and an effect that reconciles the DOM with the
  config whenever they disagree and the element is not focused.

**Deliberately not editable this way:** buttons and links, and anything the design
splits across elements. Clicking a button to place a caret in it is ambiguous with
clicking it to use it, and `"Open the gallery"` has an obvious home in the form.
The quote panel highlights its last sentence, so its stored string spans three
nodes and a caret cannot cross the tag boundary. Those stay in the form — editing
on the page is a way *in*, not the only way.

Structure always stays in the form. On-page editing cannot invent a moment that
does not exist, and a mechanism that tried would be far more machinery than the
idea is worth.

A published site is unaffected: `EditableText` renders inert unless an
`EditingProvider` is mounted, and only `/preview` mounts one. `/s/:slug` renders
zero `[contenteditable]` nodes — worth keeping true.

## Navigation

The footer is **chrome** — it is always there, even on a site with nothing in
it. It is deliberately separate from the closing section, which is the author's
own copy and hides itself when empty.

Its sitemap is derived, not written: Home, The gallery, then every chapter as an
anchor into the gallery, capped at 8 so a long gallery does not turn the footer
into a wall.

**The edit link carries the slug** — `/dashboard/their-name`, not `/dashboard`.
This is what makes more than one client work. `/dashboard` opens whichever site
was edited most recently, so without it, Uncle A clicking "Edit" from his site
lands in Uncle B's dashboard, which looks like data belonging to a stranger.

Chapter links are plain `<a>`, not `<Link>`. React Router does not scroll when
only the fragment changes, so a `<Link>` to another spot on the page you are
already on updates the URL and leaves you exactly where you were.

## Placeholder copy, and how it cannot ship

A new site starts **populated**, not empty. Asking someone to write a letter
before they have seen the shape of the thing is how you get a blank form and a
disappointed user — so `createDraft` seeds the instructional sample from
`default.ts`, and the first edit is "change her name" rather than "begin".

Two things about that sample matter:

- **It is instructional, not personal.** Every line says what belongs in that slot.
  The original content was one person's site; putting equivalent wording back
  would defeat the point.
- **No media ships with it.** Every photo and video slot is empty, so the
  placeholders show. That is the assertion worth keeping in
  `site.test.ts` — a real photograph creeping into the template would be
  republished as this project's demo.

Placeholder text is invisible to a completeness check, because a field holding it
is *filled in*. So `findIssues` in `derive.ts` also reports
`findSampleIssues` — one issue per untouched field, labelled with where it is
("Moment 2 Caption", not "2"), shown as its own warning with a `go` button to
jump to the field. `getSampleIndex()` walks the sample config rather than a
hand-kept list, so a new sample field is flagged without touching the check.

## Media sections and text sections behave differently

A site with nothing in it should not render as a blank page — that reads as
broken. So the two kinds of region are handled differently on purpose:

| | Empty behaviour |
|---|---|
| **Media** — moments, chapters | Section always renders, showing empty slots: a dashed box, a circled plus, "Add a picture" |
| **Text** — quote, closing section, outro | Section hides entirely |

The reasoning: an empty photo slot is *already* an honest, useful gap, so hiding
the section would throw away the structure for no gain. An empty quote panel is a
hollow glass box with nothing in it, which is worse than no panel at all.

This is `visibleBlocks` in `src/lib/site/derive.ts`, and it is what the outline
panel reports too, so the two never disagree.

## Three rules that are easy to break

**A value that can be derived must not be stored.** Moment tags, chapter numbers
and button targets are all position counted differently; storing them lets them
disagree. `momentTag`, `chapterLabel` and `ctaTarget` compute them instead. A test
asserts the seed stores none of them.

**A region with no content must not render.** A draft may be unfinished, so an
author who skips the quote letter gets a shorter page rather than an empty panel
with a button that opens onto nothing. `visibleBlocks` derives this — a stored
`showQuote` flag can drift out of sync with the quote it guards. Note that
`quoteTruth` is a separate flag from `quote` for exactly this reason.

**Never prefix a secret with `VITE_`.** Anything with that prefix is compiled
into the public bundle. See `.env.example`.

## Traps already paid for

Autosave silently never fired: the `beforeunload` effect listed `saveState.phase`
in its dependency array and cleared the debounce timer in its cleanup, so the
instant the phase became `"dirty"` that cleanup cancelled the timer that had just
been scheduled. Both effects now read a ref.

`body { background: var(--theme-void) }` never resolved, because tokens were
published on a nested div, so `body` fell back to a hardcoded midnight and left a
midnight strip behind on every other theme. `SiteShell` now sets them on `<html>`.

`shadow-[var(--theme-shadow-card)]` silently produces a **transparent shadow**.
Tailwind v4 composes `box-shadow` from five custom-property slots and an arbitrary
value that is itself a `var()` lands in the slot without the composed value
picking it up. Plain `.shadow-card` / `.shadow-panel` / `.shadow-frame` /
`.shadow-btn` classes live in `index.css` instead.

ScrollTrigger measures once, at init. Photographs load after that and push
everything down, so every trigger sat at the wrong offset and content stayed at
`autoAlpha: 0` — in the DOM, invisible on screen. `remeasureOnImageLoad()`
re-measures.

`.prefault()` is not `.default()`. Zod 4's `.default({})` returns the object
literally without parsing it, so nested defaults never fire.

An empty `src` (`<img src="" />`) makes the browser request the current page. The
template now omits the element entirely for media with no URL.

Every gallery link pointed at a bare `/gallery`, so the gallery was unreachable by
clicking — only by typing the URL. `ctaTarget` accepted a `basePath` and then
ignored it for the gallery case; correct when sites lived at the root, wrong once
they moved to `/s/:slug`, and it failed by rendering the not-found screen rather
than by complaining. Routes now come from `paths.ts`, and `ctaTarget` has no
default so a caller cannot omit the argument. The old test asserted the broken
behaviour, which is why it survived.

The preview's inert navigation did nothing on the first attempt. React Router
listens on the app's root element, which is *inside* `document`, so a bubbling
listener there runs after the navigation is already scheduled. It has to be the
capture phase.

## Two things the prototype cannot do yet

**Uploads are session-only.** The picker measures the file and previews it from a
blob URL, but a blob URL dies with the page. localStorage holds text perfectly and
bytes not at all — one 12MB photo would blow the quota. The dashboard counts them
and says so. Cloudinary lands in Step 4b behind the same `onChange`.

**`createDraft()` starts new sites from the seed.** Right, because the question
this prototype exists to answer is whether *editing* existing copy feels
manageable, and that cannot be judged from a blank form. The seed is now
instructional placeholder copy rather than one person's words, and every untouched
field is flagged until it is replaced — but a genuine blank option is still worth
having alongside it.

## Still queued on the dashboard

A contents strip, so the sections stop looking interchangeable. A "3 things left"
chip in the bar, so "Ready to share?" is not buried at the bottom. Reordering
sections by importance rather than page order. Two-up field pairs. A uploader that
collapses to a thumbnail once a file is chosen. Character counters only when a
field is nearly full. A collapsible theme picker.

## Next up

**Cloudinary uploads.** The only piece left of the storage story. An unsigned
preset under `lovebuilds/`, an upload with progress, `publicId` written back, and
a *transformed* delivery URL (`f_auto,q_auto` plus a width cap) rather than the raw
one — that last detail decides whether her phone downloads a 4K video. Then the
"Not uploaded" badge and its two paragraphs of caveat can go.

**Edit on the page.** Currently an 833-line form beside an iframe. The change that
would matter most is `contenteditable` in the preview: click her name, type, see it
update. `draft.set` already takes a dotted path and the template is already pure,
so the foundation is there. Two things will cost real time — React fights
`contenteditable` unless you commit on blur, and `useInertNavigation` in
`PreviewPage.tsx` deliberately swallows clicks in the capture phase, so an editing
layer has to be threaded through that rather than fighting it.

**A decision, not a task.** Where storage goes next. Local storage is per-browser,
which is fine for one uncle and wrong the moment this is a product someone signs
up for. `repository.ts` and `auth.ts` are both drawn so a hosted backend is a new
implementation and a new file rather than a rewrite — worth keeping that property
when the choice is made.






"# LoveBuild" 
