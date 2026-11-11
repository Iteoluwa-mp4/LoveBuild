# to-do.md — things yet to come

Carried over from `LOVEBUILD_TODO.md` and pruned against the code as of today:
uploads now work (Cloudinary, 276 tests passing), the upload ring and publish
dock are built, auth is real, and Firestore storage is implemented. What is left,
in the order it is worth doing.

## 1. Storage is built; finish turning it on

- [x] **Where do sites live?** Firestore. `FirestoreSiteRepository` stores one
      owner-scoped document per slug, `firestore.rules` keeps drafts private and
      published sites public, and `getRepository()` chooses it whenever Firebase
      is configured. The local implementation remains the fresh-clone fallback.
- [x] **Create the database and publish the rules.** The Firestore database
      exists for `lovebuilds-582dd`, and `firestore.rules` is deployed via
      `firebase deploy --only firestore:rules`. Re-run that command after
      changing the rules.
- [ ] **Import the browser's existing sites.** Sign in, open `/profile`, and use
      the one-time import card. It preserves published status, suffixes on a slug
      collision, and records what it copied per account.
- [ ] **App Check.** The web config is public by design; attestation is what
      stops a script from using it. Add reCAPTCHA Enterprise once the database is
      live.
- [ ] **A real export.** The import path proves data can move; the reverse does
      not exist yet. A download-everything button would make "keep a copy" true.
- [x] **Real auth.** Firebase Authentication replaced the local passcode:
      email/password plus Google, password reset, and a uid that now owns hosted
      sites.

## 2. Small change, largest payoff

- [ ] **Transformed delivery URLs.** Uploads store the raw `secure_url`. Swap
      the composed URL to `f_auto,q_auto` plus a width cap, in one place
      (`cloudinary.ts` or a new `delivery.ts`), so every template benefits and
      her phone stops downloading a 4K video. Also consider `srcset`/`sizes`
      and `loading="lazy"` below the fold while in there.
- [ ] **Delete the "Not uploaded"-era residue** that no longer applies once
      delivery is transformed: re-check the dashboard copy still reads true.

## 3. The editorial template

It is a registered template now: `"editorial"` is in `TEMPLATE_IDS`, its copy
lives in `site.editorial` and is editable from the dashboard, and it renders at
`/s/:slug` like the other two. What remains:

- [ ] Retune its reveals off `gsap ScrollTrigger` onto `useScrollReveal`. The
      ScrollTrigger failure documented in README ("content sat at autoAlpha:0,
      invisible on the published page, with nothing in the console") applies to
      `editorial/HomePage.tsx` and `editorial/GalleryPage.tsx` verbatim — they
      register `ScrollTrigger` and use `autoAlpha` with no failsafe.
- [ ] Its stylesheet in `editorial/css.ts` still imports Google Fonts and sets
      `:root`/`body` styles. It is mounted inside `SiteShell`, so those globals
      fight the theme tokens; the template currently wins by setting
      `color: var(--editorial-ink)` on its own root. Decide whether the fonts and
      body background move to a scoped wrapper or into `themes.ts`.
- [ ] Decide: is the SVG fallback data-URI cover art an acceptable placeholder
      pattern (like the scrapbook's), or does it become a `findSampleIssues`
      item? No real photograph should ship with it.

## 4. Dashboard UI (from the old list, still open)

- [ ] **Clearer hierarchy already partly done** (publish dock). Remaining:
      make "Save now" a quiet text button; group View site / Gallery.
- [ ] **Fewer boxes inside boxes.** Section, item and item-head all have
      borders and backgrounds. Drop borders on `.item`/`.item-head`, separate
      by tone and spacing instead.
- [ ] **Bigger, roomier text**: base ~15px, hints ~0.78rem, inputs ~0.92rem
      with more padding, larger gaps in `.dash-form` and `.dash-side`.
- [ ] **Warmer look.** Cold blue on near-black reads as a generic admin panel;
      try a rose or gold accent, or derive it from the chosen theme tokens.
- [ ] **Preview polish.** Replace the checkerboard preview background with a
      calm dark tone, soft shadow on the phone frame, inline-link styled `go`
      buttons, short transitions on section open.
- [ ] Uploader collapses to a thumbnail once a file is chosen.
- [ ] Character counters only when a field is nearly full.
- [ ] A contents strip so the sections stop looking interchangeable; reorder
      sections by importance rather than page order; two-up field pairs;
      collapsible theme picker.

## 5. Code cleanups

- [ ] **Hardcoded string.** "A few of the moments" in `classic/HomePage.tsx`
      still has no config field behind it. Add one.
- [ ] **Brittle jump-to.** `jumpTo` finds sections by matching their title
      text; renaming a section silently breaks it. Use section ids.
- [ ] **Repo tidiness.** `components/site/nostalgic/ScrapBookTemplate.tsx` may
      predate and overlap `components/site/scrapbook/` — verify, and delete the
      dead one if so. Decide whether `.impeccable/` mocks belong in the repo.
- [ ] **Bundle check.** Make sure `sphere-gallery-3d` and the three.js
      ornaments stay lazy-loaded (not shipped to every visitor), and decide
      whether the editorial template's Google Fonts `@import` should be
      preloaded or dropped.

## 6. Later, when the pain is felt

- [ ] Resize and re-encode in the browser before upload (WebP ~80–85%).
- [ ] Chunked/resumable uploads for video on bad connections.
- [ ] Adaptive streaming (HLS) instead of one-file video delivery.
- [ ] Background uploads with an out-of-form progress surface.
- [ ] A genuine blank-start option beside the seeded `createDraft()`.
- [ ] A scheduled task: rotating signed-delivery rules or max-size caps into
      the Cloudinary preset once uploads are signed.

## Suggested order

1. `f_auto,q_auto` delivery — a one-file change with the largest visible
   improvement after uploads landed.
2. Import the local shelf, add App Check, and run the storage smoke test against
   the real project when a browser is connected.
3. Editorial template promotion (schema → TEMPLATE_IDS → reveals → styles).
4. Dashboard UI pass (§4 items are independent, quick wins included).
5. Cleanup as each file is touched — the "A few of the moments" one first, it
   is untruthful to the stated rule.
6. Test with the uncle, collect his feedback, and let that reorder §6.
