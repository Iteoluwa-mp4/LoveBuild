# Product

<!-- impeccable:product-schema 1 -->

> **Provenance note.** This record was written without a live interview: the
> question round was dismissed and returned no answer. Every fact below is taken
> from `README.md`, `package.json` and the source, and each section marks which
> facts are *inferred* rather than confirmed. Nothing here is a visual decision.
> Revisit any inferred line before building on it.

## Platform

web

*(Inferred. Confirmed by the build: Vite + React 19, react-router, Firebase Auth, a Neon-backed Hono API with a localStorage fallback, no native shell, `.env.example` in the repo root.)*

## Stack

Vite 8 + React 19 + TypeScript + Tailwind v4 + react-router-dom 7, GSAP 3, three.js 0.185, lucide-react, zod 4, vitest. *(Inferred from `package.json`; the existing codebase answers this, so it was not put to the user.)*

## Users

Two audiences, and they are not the same person.

- **The author.** Someone — in the seeded demo, an uncle — who sits down at a
  desktop and builds a small site for one other person. They are not a designer
  and they are not writing a blog; they are making a single, finite present.
  Their job is to get the words and the photographs in, see what the recipient
  will see, and share one link. *(Inferred from `README.md`, the seed slug
  `hers`, and the whole shape of the dashboard.)*
- **The visitor.** One person, opening one link, usually on a phone, usually
  once. They are not choosing between products, they have no task to complete,
  and there is nothing to decide. Their job is to read what was written to them.
  *(Inferred from the route table: `/s/:slug` is reached by link, and `/` is the
  dashboard rather than a site.)*

## Product Purpose

One person fills in a typed config object; the app renders a personal site from
it. The product makes it possible for a non-designer to assemble photographs,
short captions, a longer letter, a quote and a video gallery into something
that reads as a finished gift, without touching code or layout.

Success means the recipient opens the link and reads to the end. Success for the
author means publishing is a single irreversible action they do not regret.
*(Inferred from `README.md`: "someone fills in a form, and a site renders what
they submitted"; the `visibleBlocks` media-vs-text rule; the publish confirm that
names how many fields are still placeholder.)*

## Positioning

The mechanism is config-driven purity: **all content lives in one typed Zod
object, and no component may hardcode a string, a colour, or an image path.**
That single rule is what lets one codebase serve many sites, and it is why
switching `template` is non-destructive — both templates read the same
`home.moments` list, so switching never strands an upload.

A neighbouring product could not copy this without rebuilding its renderer
around a config schema, an immutable dotted-path edit layer, and a template
registry that consumes the same tokens. *(Inferred from `README.md` §"The one
idea" and `src/lib/site/schema.ts`, `path.ts`, `App.tsx#SitePages`.)*

## Operating Context

- **Editor.** `/dashboard/:slug` — two independently scrolling panes, page
  locked to the viewport. Form on the left; outline, page switch and an iframe
  preview on the right. Autosave on a debounce.
- **Shelf.** `/profile` — the account card plus every site, newest first, with
  Edit and (for live sites) View. The editor header carries an avatar button to
  it, and `/new` is the create form on its own route. The list comes from
  `SiteRepository.list()`: per-account in Neon, per-browser on a fresh
  clone. A one-time import card copies local sites into the signed-in account.
- **Preview is a real page.** `/preview` renders the actual template in an
  iframe and receives the draft by `postMessage`. It is deliberately *not* under
  `/s/`, so it can never be a link someone shares.
- **Edit on the page.** Inside the preview only, `EditableText` makes each text
  run clickable and editable; edits post back up to the same `draft.set` the form
  uses. A published site at `/s/:slug` renders zero `[contenteditable]` nodes.
- **Structure stays in the form.** On-page editing cannot add a moment, reorder a
  chapter, or swap a photo.
- **Publishing.** Drafts are invisible. Publishing flushes pending saves first,
  confirms by naming how many fields are missing or still placeholder, then every
  later save goes live immediately without asking.
- **Auth.** Firebase Authentication at `/login`: email/password or Google. The
  dashboard is gated; a published gift page is not, and carries no auth UI at
  all. Sessions are real, and the data is owner-scoped in Neon: the API verifies
  the Firebase ID token and scopes every query to its uid, while published sites
  stay public through one unauthenticated route. *(Confirmed — `auth.ts`,
  `useSession`, `RequireAuth`, `SiteFooter`, `apiRepository.ts`,
  `server/app.ts`, `server/auth.ts`, `server/store.ts`.)*
- **Uploads persist to Cloudinary through signed, authenticated requests.**
  `src/lib/site/cloudinary.ts` asks the API for a one-hour signature, posts the
  file to Cloudinary with `type=authenticated`, then stores a signed delivery
  URL. The API secret never reaches the browser, and uploads require a signed-in
  account. The module's rule is **persist nothing that does not resolve**: a
  `blob:` URL is never written to the config, and one already saved from the old
  blob-percance era is flagged by `needsReupload` and shown as a dead file.
  Without server Cloudinary settings, files remain preview-only and the
  dashboard says so in words. *(Confirmed — `cloudinary.ts`, `apiClient.ts`,
  `mediaSigner.ts`, `server/app.ts`, `MediaUploader.tsx`,
  `cloudinary.test.ts`, `mediaSigner.test.ts`, `.env.example`.)*
- **Delivery uses a long-lived signed URL.** The stored URL is a bearer link:
  it cannot be guessed, but anyone given it can load the asset, and rotating the
  Cloudinary secret invalidates every stored URL. Authenticated assets cannot
  use on-the-fly transforms, so the original bytes are delivered; a smaller
  derivative is future work.
- **Dev commands.** `npm run dev` (Vite + API), `npm run build`,
  `npm run typecheck`, `npm test`, `npm run lint`, and the `db:*` migration
  scripts. *(Confirmed from `package.json`.)*

## Capabilities and Constraints

Confirmed architectural constraints, all stated in `README.md` and enforced in
code:

- **Config purity.** No hardcoded strings, colours or image paths in components.
  Chrome (nav labels, aria strings, button labels) is the stated exception.
  *Open issue found in the incumbent:* the moments section heading
  "A few of the moments" is hardcoded in `classic/HomePage.tsx` and has no config
  field behind it.
- **Derive, never store.** Anything computable from position must not be a
  field — moment tags, chapter labels, CTA targets, quote emphasis.
- **Media regions always render; text regions hide when empty.**
  `visibleBlocks` in `src/lib/site/derive.ts` is the single decision, and the
  outline panel reports from the same function so the two cannot disagree.
- **Scroll reveals are JS-classed.** The hidden state lives entirely in
  `.js-reveal-pending`, added by `useScrollReveal`. No class, no rule, so no
  JavaScript means visible content. A 1.2s `REVEAL_FAILSAFE_MS` reveals anything
  still pending. There is deliberately no `prefers-reduced-motion` override in
  the CSS, because it would be a second source of truth that can disagree.
- **No ScrollTrigger.** IntersectionObserver only. The README records that
  ScrollTrigger silently failed and left real content invisible on published
  pages.
- **Never prefix a secret with `VITE_`.** It is compiled into the public bundle.
- **285 tests pass** (`npm test`), including an assertion that no real photograph
  ships with the sample config, that derived values are not stored, that uploads
  only ever persist a URL that resolves, and that a create collision suffixes the
  address instead of overwriting the first site.

Open product decisions, deliberately undecided:

- Whether a review gate is ever wanted before publish (`submitted` status exists
  but is unused).
- Whether the browser-local fallback stays forever as a no-account mode, or is
  removed once Neon is the only deployment story. It is deliberately still
  there for a fresh clone and offline development.
- When App Check and a real export arrive. Both are hardening, not features; the
  token check and owner-scoped queries already decide who can read a draft.

A remaining exemption on record: the editorial template's stylesheet imports
Google Fonts and writes `:root`/`body` rules from inside the component, so those
document-level globals still win over the theme tokens. The template itself is
otherwise fully integrated: schema-backed, in `TEMPLATE_IDS`, reachable at
`/s/:slug`, and its reveals now use the shared failsafe.

## Brand Commitments

- **Name:** LoveBuilds. From *Lovebirds* — "someone builds a site; love builds."
  *(Confirmed, `README.md` and `src/lib/site/brand.ts`.)*
- **Wordmark:** "LoveBuilds" appears in the site footer, credited as the tool,
  beside the site's own name.
- **Voice:** warm, dry, second-person, addressed to one named person. The seed
  copy is the reference: affectionate understatement over sentimentality —
  "Most of what I love about you is nothing happening." The seed is written as
  *instructional* placeholder prose, not as anyone's real words, and
  `findSampleIssues` flags every untouched field so it cannot ship.
- **Tone of the product chrome:** plain and unhurried. The README's own prose is
  the house style — explanatory, unsentimental, and willing to state a hard
  trade-off.
- **No personal words ship.** An earlier revision carried one person's real
  birthday copy and it was removed. *(Confirmed, `src/lib/site/default.ts`.)*

## Evidence on Hand

- **Real, complete, instructional copy.** `sample()` in
  `src/lib/site/default.ts` holds a full three-chapter gallery, four moments, a
  quote, a multi-paragraph letter, a closing section and three closing cards,
  written at production quality. It is the best available content for judging a
  layout, and it ships.
- **No photography or video at all.** Every media slot in the sample is empty
  (`emptyMedia()`), and `site.test.ts` asserts that stays true. The scrapbook
  template generates placeholder photographs as warm SVG data-URIs
  (`src/components/site/scrapbook/shared.tsx`) — an existing, sanctioned pattern
  for synthetic image material.
- **Seed slug** is `hers`, one constant in `default.ts`.
- **285 passing tests** as the behavioural safety net.
- Absences future work must not fabricate: no customer testimonials, no named
  clients, no pricing, no usage benchmarks, no performance claims.

## Product Principles

1. **The box is the product.** Content enters as one typed object and leaves as
   a page. Nothing in the renderer is allowed to hold a fact that lives
   somewhere else.
2. **An honest gap beats a broken frame.** An empty photo slot is a useful,
   visible invitation. An empty quote panel is a lie. Treat the two differently,
   from one function.
3. **The visitor's page is the artifact; the tool is the instrument.** `/` is the
   dashboard, not a site. Everything on the published route should feel like it
   was made for one person, and the editor should stay backstage.
4. **Failure modes must be bounded and visible.** Where something can fail
   silently — a reveal, an autosave, an upload, a schema change — the worst case
   is small, the user is told in words, and the failure never costs them the
   content of someone's gift.
5. **Say the trade.** Publishing without a review gate means *he can break the
   live site himself*; the passcode protects nothing. This codebase states its own
   costs plainly, and any surface it produces should read the same way.

## Accessibility & Inclusion

- **No product-specific requirement was established by the author.** *(Inferred —
   no accessibility commitment is stated in `README.md` or the source.)*
- Existing, preserved behaviour: `prefers-reduced-motion` is honoured where it
  disables scroll-snap, the drifting cue line, video autoplay and reveal
  transitions; every transition carries a `motion-reduce:` variant; reveal
  animations never hide content from a visitor without JavaScript.
- The published site's primary audience is one person on a phone, so touch
  targets, tap-triggered reveals and legible type over photographs are
  correctness here rather than a compliance extra.