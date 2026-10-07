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
  `LocalSiteRepository` implements it today, Supabase arrives in Step 4b.
- **Path editing** — `src/lib/site/path.ts`. Immutable get/set/splice/move by
  dotted path, so every input binds without knowing where it lives.
- **Dashboard** — `/dashboard/:slug`. Form, live preview, outline, autosave.
- **Tests** — 106 passing. `npm test`

Also built: the Supabase backend and login, ready for keys. Cloudinary uploads are
still to do.

## Running the backend

Three steps, none of which can be done from here.

1. **Create a project** at supabase.com — free, about 15 minutes.
2. **Run `supabase/migrations/001_init.sql`** in Dashboard > SQL Editor. It is
   idempotent, so re-running it is safe.
3. **Copy the Project URL and anon key** from Settings > API into `.env`, then
   create the uncle's account under Authentication > Users > Add user. Email
   anything like `uncle@placeholder.local`, tick **Auto Confirm User**, and set a
   password you will send him.

The account is created in the dashboard rather than in code on purpose: doing it
in code needs the **service_role** key, which bypasses row level security. Creating
it here means that key never touches this machine.

With no keys the app runs entirely on localStorage and everything still works.
`getRepository()` picks the backend; `repositoryKind()` reports which.

### Publishing is a manual step

New sites are `draft`, and a draft is invisible to the public — the shared link
returns nothing. To publish:

```sql
update sites set status = 'published' where slug = 'their-name';
```

After that first flip his edits go live immediately, without asking anyone. That
is the trade for not building a review gate: **once published, he can break the
live site himself.**

### What is not verified

Nothing in the Supabase path has been run. It was written before the project
existed. Specifically untested: the policies, the anon key reading a draft, and
sign-in. The local backend models the draft/published split on purpose so the
dashboard's states can be developed against, but that is a simulation, not the
real thing.

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
  supabaseRepository.ts  the real one (unverified — see below)
  getRepository.ts   picks a backend by env
  default.ts         blank seed + SEED_SLUG
  load.ts            public site lookup by slug
  brand.ts           storage prefixes + preview message names

src/lib/supabase.ts    client, and whether a project is configured

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

supabase/migrations/001_init.sql   tables, RLS policies, triggers
```

### Where to change what

| To change | Edit |
|---|---|
| What fields a site has | `siteSchema` in `schema.ts` |
| A colour | `buildTokens` in `themes.ts` — never a hex in a component |
| Whether a section shows | `visibleBlocks` in `derive.ts` |
| Footer links | `buildSitemap` in `sitemap.ts` |
| Where the buttons go | `sitePaths` in `paths.ts` |
| Database or who can read it | `supabase/migrations/001_init.sql` |

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
manageable, and that cannot be judged from a blank form. Step 4b must replace it
with a template picker or a genuinely blank site — the seed contains one person's
words and the next customer should not inherit them.

## Still queued on the dashboard

A contents strip, so the sections stop looking interchangeable. A "3 things left"
chip in the bar, so "Ready to share?" is not buried at the bottom. Reordering
sections by importance rather than page order. Two-up field pairs. A uploader that
collapses to a thumbnail once a file is chosen. Character counters only when a
field is nearly full. A collapsible theme picker.

## Next up

Step 4b: Supabase project, `owner_id` on `sites`, RLS policies, the uncle's
account, a login gate, and `SupabaseSiteRepository` behind the existing
interface. Nothing above that seam changes.






"# LoveBuild" 
