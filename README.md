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
│  template: "modern"       │        │                          │
└───────────────────────────┘        └──────────────────────────┘
```

A component may never contain a sentence, a colour, or a photo path. If you find
one, it belongs in the box. That is the whole architecture, and everything below
is a consequence of it.

## Current state

Done:

- **Schema** — `src/lib/site/schema.ts`. The single source of truth. Zod, so the
  form, the database column and the components all agree.
- **Themes** — `src/lib/site/themes.ts`. Five presets as pure data, used by the
  modern template and applied to `<html>` so the whole document follows.
- **Derivation** — `src/lib/site/derive.ts`. Computed values and visibility rules.
- **Template** — `src/components/site/`. Both pages render entirely from config.
- **Three templates** — `site.template` picks the layout (`editorial`, `modern`
  or `scrapbook`). `theme` picks the colours for `modern`; `editorial` and
  `scrapbook` carry their own palettes. All three read the same `home.moments`
  for their photographs, so switching keeps every upload.
- **Uploads** — `src/lib/site/cloudinary.ts`. Photos and videos go straight from
  the browser to Cloudinary and survive a reload. See *Uploads* below.
- **Repository seam** — `src/lib/site/repository.ts`. One interface;
  `FirestoreSiteRepository` implements it when Firebase is configured;
  `LocalSiteRepository` is the no-project fallback.
- **Auth** — `src/lib/site/auth.ts`. Firebase Authentication: email/password and
  Google, with a local open mode in development when no project is configured.
  A production build fails closed to the login screen. See below.
- **Path editing** — `src/lib/site/path.ts`. Immutable get/set/splice/move by
  dotted path, so every input binds without knowing where it lives.
- **Dashboard** — `/dashboard/:slug`. Form, live preview, outline, autosave.
- **Shelf** — `/profile`. Every site the author has made, newest first, with
  edit/view links and a "New site" button. It is the first signed-in screen; an
  empty shelf offers "Make the first one". `/new` is the create form on its own
  route so "make another" never has to reopen the newest site first.
- **Tests** — 275 passing. `npm test`

Still to do: transformed (`f_auto,q_auto`) delivery URLs and scoping the
editorial stylesheet's document-level font and body rules.

## Storage, auth and publishing

With Firebase configured, sites are stored in Firestore and follow the account.
With no `.env.local`, `npm run dev` runs in a local open mode and stores them in
this browser's localStorage — that is the development path, not a second product.
A production build without Firebase fails closed to the login screen. The
one external dependency for media is Cloudinary: it holds the bytes, Firestore
holds the words and structure, and localStorage holds both in local mode.

### Authentication is real, and so is the lock

`/login` is Firebase Authentication: email and password, or Google. The root path
sends a signed-out visitor there; an existing session forwards on to the shelf.
The dashboard is unreachable without a session. Google supplies a display name
and photo; password accounts derive a readable name from the email rather than
asking for one. Verification is a notice in the dashboard, not a gate, and
password resets are genuine because Firebase has a server to send them.

Sites are owner-scoped now. A Firestore document carries `ownerId`, and the
security rules in `firestore.rules` make drafts readable only by that uid.
Published sites are readable by anyone with the link. The editor's write paths
are owner-only, so signing in is no longer a gate in front of browser-local data;
it is the key.

With no Firebase settings in `.env.local`, `npm run dev` runs in a local open
mode with no login screen. That is the development behaviour, and it is why a
fresh clone works with no project. A production build without them fails closed
to the login screen with a configuration message instead of creating an
anonymous local workspace. A deployment meant to be shared must set the four
`VITE_FIREBASE_*` variables and create the Firestore database; see
`.env.example` and *Firestore setup* below.

`useSession` still reports three states (`checking`, `signed-out`, `signed-in`)
and `RequireAuth` still owns the gate, so swapping the provider did not touch the
routes. The login page keeps sign-in and create-account as two modes rather than
one auto-creating form: Firebase's email-enumeration protection returns the same
error for a wrong password and an unknown address, so "create it if it is not
there" cannot be told apart from "you mistyped your password".

### Firestore setup

One-time, in the Firebase Console for the project named in `.env.local`:

1. **Firestore Database → Create database**, Native mode, pick a region.
2. **Rules** tab → paste `firestore.rules` → Publish. The CLI route works too:
   ```bash
   firebase deploy --only firestore:rules
   ```
   `firebase.json` and `.firebaserc` are in the repo for it.

The repository chooses itself: when the four `VITE_FIREBASE_*` values are present,
`getRepository()` returns the Firestore implementation. There is no separate
"use remote" switch to forget, and a fresh clone with no `.env.local` still uses
localStorage.

Existing browser-local sites are neither deleted nor uploaded silently. `/profile`
shows a one-time **Import** card when it finds local sites that are not yet in the
account. Import copies each one, keeps a published site published, and appends the
usual random suffix if an address is already taken. The record of what has been
imported is per account, so signing into a different account does not inherit it.

If the editor says *"Check that Firestore is set up and the security rules are
published"*, that is the honest cause of six consecutive permission denials: the
database does not exist yet, or the rules were never published. It is not the
site's name.

### Deploying

The app is a client-side SPA. The host must send every unknown path to
`index.html`, because `/dashboard/:slug`, `/profile`, `/new`, `/preview/` and
`/s/:slug` are all handled by the router rather than by files on disk. Without
that fallback the dashboard can look fine after a client-side navigation while
the preview iframe and a hard refresh show the host's 404 page.

`vercel.json` in the repository does this for Vercel, and pins the build command
and output directory so the framework preset cannot disagree:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Redeploy after adding it. The same rewrite is needed on any other static host
(Netlify `_redirects`, Firebase Hosting `rewrites`, and so on).

Two settings live outside the repository:

1. **Build-time variables.** Set the four `VITE_FIREBASE_*` values and the two
   `VITE_CLOUDINARY_*` values in the host's environment settings. They are
   compiled into the bundle, so changing them requires a new deployment. Without
   the Firebase values the deployed build shows the login screen with a
   configuration error. It does not create an anonymous local workspace; set
   them before deploying.
2. **Firebase Auth authorized domains.** Add the production hostname (and any
   Vercel preview hostname you actually use) under **Authentication → Settings →
   Authorized domains**. Email/password works without this, but Google sign-in
   fails with `auth/unauthorized-domain` until the host is listed.

Firestore rules still deploy separately with
`firebase deploy --only firestore:rules`.

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

Photos and videos go straight from the picker to Cloudinary (`auto/upload`, an
unsigned preset named in `.env.example`) and the delivered URL is written back
into the config, so a photograph survives a reload, a different browser and a
different machine reading the same config.

The `cloudinary.ts` module enforces one rule: **persist nothing that does not
resolve.** `isEphemeralUrl` flags `blob:` URLs — the only kind, on purpose: a
`data:` URL carries its own bytes and resolves fine, so flagging it would report
a working image as broken. Anything ephemeral found in the config is shown by
the uploader as a dead file worth re-picking.

Two honest limits, stated rather than hidden:

- **No `.env` → preview only.** Without `VITE_CLOUDINARY_CLOUD_NAME` and
  `VITE_CLOUDINARY_UPLOAD_PRESET`, an upload cannot be kept; the file previews
  from a blob URL and the dashboard says so in as many words, before anyone
  finds out at the worst moment.
- **The delivered URL is the original.** `f_auto,q_auto` (plus a width cap)
  would turn a 12 MB phone photograph into something her phone can actually
  load — and it decides whether a video streams instead of downloading whole.
  That transform is the next small change with the largest visible payoff.

An unsigned preset's name is public by necessity — it ships to the browser — so
the preset must be locked down on the Cloudinary side: pin a folder, allow only
image and video formats, cap the file size. `CLOUDINARY_API_KEY` and
`CLOUDINARY_API_SECRET` are deliberately *unprefixed* so nothing compiles them
into the bundle; they exist for the day uploads are signed.

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
| `/dashboard` | redirects to the newest site, or shows the create form when there are none |
| `/dashboard/:slug` | the editor |
| `/profile` | the author's shelf — account, every site, and "New site" |
| `/new` | the create form as its own route, so "make another" does not reopen the newest site |
| `/s/:slug` | the public site — home page |
| `/s/:slug/gallery` | the public site — gallery |
| `/preview`, `/preview/gallery` | the frame the editor previews in. Deliberately **not** under `/s/`, so it can never be a link someone shares |
| `/templates/modern`, `/templates/modern/gallery` | the modern template against the seed config. A development surface — `template` is in the schema, so `/s/:slug` serves whichever one a config selects |
| `/templates/scrapbook`, `/templates/scrapbook/gallery` | the scrapbook template, same arrangement |
| `/dev/themes`, `/dev/blocks`, `/dev/outline` | dev screens, deleted once the backend lands |
| `/dev/editorial` | an experimental editorial (magazine) template, self-contained and not yet config-driven. Unregistered and unpublished by design |

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
  parseSite.ts       validate a config before write / after read
  firestoreRepository.ts Firestore implementation — owner-scoped documents
  localRepository.ts localStorage implementation (no-project fallback)
  getRepository.ts   Firestore when configured, local otherwise
  auth.ts            Firebase sign-in, sessions and sign-out
  authMessage.ts     Firebase error → plain sentence; name fallback
  firebase.ts        Firebase app/auth/Firestore initialisation, or null
  cloudinary.ts      browser → Cloudinary uploads; never persist a dead URL
  default.ts         sample copy + placeholder detection + createDraft
  load.ts            public site lookup by slug
  brand.ts           storage prefixes + preview message names

src/hooks/
  useDraftSite.ts    the editor's single source of truth
  useSession.ts      who is signed in
  useReveal.ts       scroll-triggered reveal
  useScrollReveal.ts JS-classed reveals with a failsafe (see "Scroll reveals")

src/components/site/
  shared/              used by every template
    SiteShell          theme tokens onto <html>
    EditableText       click-to-edit, inert unless an EditingProvider says otherwise
    MediaPlaceholder   every empty media slot, one component
  classic/             the original template — config in, no content
    HomePage           the moments strip lives here
    GalleryPage
    SiteNav  SiteFooter  ScrollToTop  primitives
    FilmFrame  GlossyButton  PixelTransition
    ornaments/themeColor  CSS colour -> three.js number, shared with modern
  modern/              the orbit template — site.template === "modern"
    HomePage           config-driven; takes `site` + `basePath`
    GalleryPage        same, for /gallery
    paths.ts           modernPaths(basePath) — no template hardcodes its routes
    shared.tsx         tokens, starfield, wordmark — both pages
    PhotoStrip.tsx     the advancing row of slices
    strip-css.ts       its styles
    Both pages take their photographs from `home.moments` via `modernMemories`
    in lib/site/derive.ts, which is what makes switching `template` in the
    dashboard non-destructive: one list of uploads, two arrangements of it.
  scrapbook/           the paper template
    HomePage           route: /templates/scrapbook
    GalleryPage        route: /templates/scrapbook/gallery
    paths.ts           SCRAPBOOK_BASE
    shared.tsx         paper ground, tape, brads, handwriting, memory data
  EditorialTemplate.tsx  a magazine-style template with its own copy and an
                         inline stylesheet — a design exploration, not yet in
                         the schema, mounted only at /dev/editorial
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

It renders the real template, not a copy. An inline preview would need animations
and scroll-snap switched off to survive a nested scroller — and every one of
those switches is a way for the preview to drift from what visitors actually see. The draft is posted in over `postMessage` after a 400ms pause, and
the frame announces itself on mount so the first update is not lost.

## Scroll reveals

Content below the hero fades up as you scroll it into view.

It is **IntersectionObserver**, not GSAP ScrollTrigger, and that is not a
preference. ScrollTrigger built valid triggers with sensible start and end
positions and never fired — progress stayed at zero at every scroll offset. Because
``fromTo`` still applies its "from" state, every revealed block sat at
``autoAlpha: 0`` and stayed there. The moments, the closing section and its clip
cards were all present in the DOM and invisible, on the published site, with
nothing in the console. Three fixes did not change it (consistent imports, a Vite
dedupe, removing ``gsap.context``) and a bare ``ScrollTrigger.create`` in the same
page tracked the scroll perfectly, which is what localised it.

Three properties matter more than the animation:

- **Nothing is hidden unless JavaScript says so.** The hidden state is a class
  added by ``useScrollReveal``. No class, no rule, so no JavaScript means visible
  content.
- **A broken observer cannot hide the page.** After ``REVEAL_FAILSAFE_MS`` (1.2s),
  anything still pending is revealed regardless. Measured, not assumed: in a
  headless browser IntersectionObserver callbacks did not fire at all — a control
  observer created in the page stayed silent too — and CSS transitions sat frozen
  at ``currentTime: 0``. With the old arrangement that is a page where the content
  of someone's gift is invisible. The worst case is now bounded and small.
- **One decision, one place.** There is deliberately no
  ``prefers-reduced-motion`` override in the CSS. There was one, and it
  disagreed with the hook — the browser reported no-preference while the override
  applied anyway, leaving elements marked pending and yet fully visible.

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

## Things this build still cannot do

**`createDraft()` starts new sites from the seed.** Right, because the question
this prototype exists to answer is whether *editing* existing copy feels
manageable, and that cannot be judged from a blank form. The seed is now
instructional placeholder copy rather than one person's words, and every untouched
field is flagged until it is replaced — but a genuine blank option is still worth
having alongside it.

**Storage setup is still manual.** Firestore is implemented and the rules are in
the repo, but creating the database and publishing `firestore.rules` are console
steps. The app deploys as a static SPA (see *Deploying*), but there is no Firebase
Hosting pipeline and no App Check — so the project relies on authorized domains,
security rules and quota for now.

**Browser-local sites are imported by hand.** The `/profile` card copies them into
the signed-in account, but there is no automatic migration, no export, and no
"delete the local copy" step. That is deliberate: copy first, keep the original
until the copy is seen working.

**The editorial stylesheet still writes document-level globals.** Both editorial
pages now use `useScrollReveal`, so the failsafe covers them. What remains is
`editorial/css.ts`: it imports Google Fonts and sets `:root`/`body` rules inside a
component mounted in `SiteShell`, so it wins over the theme tokens by setting its
own `--editorial-*` variables and `color` on the template root. Scoping those
globals is the remaining cleanup.

**Delivery URLs are not transformed yet.** Photographs are stored in Cloudinary
but served at their original size — see *Uploads*.

## Still queued on the dashboard

A contents strip, so the sections stop looking interchangeable. Reordering
sections by importance rather than page order. Two-up field pairs. A uploader that
collapses to a thumbnail once a file is chosen. Character counters only when a
field is nearly full. A collapsible theme picker.

(The publish dock, the upload-progress ring and the pressed states for toggle
buttons shipped — and a "3 things left" chip was deliberately *removed* rather
than built: two progress readouts in different units answered one question twice,
so the ring measures progress and the dock only ever says whether the site is
published.)

## Next up

**Transformed delivery URLs.** The upload works; the bytes served do not. Swap the
stored `secure_url` for a delivery URL carrying `f_auto,q_auto` and a width cap —
composed in one place rather than sprinkled through the templates, because the
transform is a property of *how Cloudinary serves*, not of any one `<img>`. This
is the change that decides whether her phone downloads a 4K video.

**The editorial stylesheet, scoped.** The template itself is in: schema-backed,
registered in `TEMPLATE_IDS`, editable from the dashboard, and its reveals now use
`useScrollReveal`. The last piece is its stylesheet, which still imports Google
Fonts and writes `:root`/`body` rules from inside the component. Moving those to a
scoped wrapper or into `themes.ts` finishes the job.

**App Check.** Firestore is live and owner-scoped, but nothing yet attests that
requests come from this app rather than a script holding the public project
config. App Check with reCAPTCHA Enterprise is the next hardening step; until
then the security rules are the wall, and they are the right wall, but quotas are
the only defence against abuse.

**A real export.** The import path proves the data can move; the reverse does not
exist. A "download everything" button would make the account portable and make
"keep a copy" a promise the product can keep.

**A decision, not a task.** The SQL option stays open on paper: `repository.ts`
keeps the choice cheap, and Firestore's document model is a good fit for a config
that is read and written whole. Relational queries would only matter if the next
version asks questions across sites, which the shelf does not.
