# LoveBuild: Things That Need Work

> **Live list moved to `to-do.md`.** This file's done items are ticked below.
> New work goes in `to-do.md` first; sync anything still open here.

Priority order. Tick items off as you go.

## 1. Must fix before the uncle uses it for real

- [x] **Hosted storage.** Sites live in Neon Postgres behind the `/api` route, so a link works on any machine and follows the account. *(Media is in Cloudinary; the config with the words is in Neon.)*
- [x] **Persistent uploads.** Photos and videos now go straight from the browser to Cloudinary (`src/lib/site/cloudinary.ts`), URL written back, dead `blob:` URLs flagged. Superseded continuation: transformed delivery URLs (`f_auto,q_auto`) — see `to-do.md`.
- [x] **Real auth.** Firebase Authentication (email/password and Google) now
  gates the editor, and the API verifies the ID token before any owner query.
  Ownership is the Firebase uid in `sites.owner_id` — see the Neon step in
  `to-do.md`.

## 2. Dashboard UI

- [x] **Active state for toggle buttons.** Done in `dashboard.css` (`.btn[aria-pressed="true"]`, `.btn-icon`).
- [x] **Clearer hierarchy.** Publish became the one primary action in a bottom-anchored `PublishDock` with a two-step confirm; the "3 things left" chip was deliberately removed rather than built (the progress ring owns progress now). Remaining polish lives in `to-do.md`.
- [ ] **Fewer boxes inside boxes.** Section, item and item-head all have borders and backgrounds. Remove borders on `.item` and `.item-head`, and separate with spacing and tone instead.
- [ ] **Bigger, roomier text.** Base font to about 15px, hints around 0.78rem, inputs around 0.92rem with more padding, and larger gaps in `.dash-form` and `.dash-side`.
- [ ] **Warmer look.** The cold blue on near-black reads as a generic admin panel. Try a soft rose or gold accent, or pull the accent from the chosen theme tokens.
- [x] **Progress indicator.** A circular upload dial in the bottom-left corner, with the percentage in the middle. It counts uploads and the words that belong to them — photographs, clips, and their captions or titles — and nothing else, so typing a heading does not move it. The publish dock keeps the full completeness check, because "is this worth sharing" is a different question from "how much of it is here".
- [ ] **Preview polish.** Replace the checkerboard preview background with a calm dark tone and a soft shadow on the phone frame. Restyle the `go` buttons in the issues lists as inline links. Add short transitions on section open and button hover.

## 3. Lighter uploads and downloads (without cutting quality or size limits)

The idea: keep the original at full quality in storage, and only optimize what gets delivered. Do the first two items and you get roughly 80% of the benefit.

**Do first**
- [x] **Upload straight from the browser to Cloudinary** — done via server-signed, authenticated uploads in `cloudinary.ts`; delivery URLs are signed per asset and require a signed-in account to create.
- [ ] **Generate and deliver a smaller web derivative.** Authenticated Cloudinary assets cannot transform on the fly, so upload an optimized copy beside the protected original and store both URLs. *(Not done — the app delivers the original bytes today.)*

**Do later, when you feel the pain**
- [ ] **Resize and re-encode in the browser before upload.** Shrink 4000px+ phone photos to about 2000px and encode as WebP at around 80 to 85% quality (typically 70 to 90% smaller, no visible loss).
- [ ] **Responsive image sizes.** Use `srcset` and `sizes` so phones get an ~800px image instead of the full original.
- [ ] **Lazy-load media below the fold**, and lazy-load the 3D gallery.
- [ ] **Chunked or resumable uploads for videos**, so a bad connection doesn't restart the upload.
- [ ] **Upload progress UI** and background uploads, so it feels lighter even when the bytes are the same.
- [ ] **Stream video** (HLS or Cloudinary adaptive streaming) instead of sending one big file, and prefer H.264/H.265 or AV1 over raw phone footage.
- [ ] **Serve through a CDN** (Cloudinary includes one).

## 4. Code cleanups

- [ ] **Hardcoded string.** "A few of the moments" in `classic/HomePage.tsx` breaks the config-purity rule (already noted in PRODUCT.md). Add a config field for it.
- [ ] **Brittle jump-to.** `jumpTo` finds sections by matching their title text, so renaming a section silently breaks it. Use section ids instead.
- [ ] **Repo tidiness.** Check whether the `.impeccable/` mocks folder belongs in the repo. `components/site/nostalgic/` and `components/site/scrapbook/` may overlap (not verified, so check before merging anything).
- [ ] **Bundle size (verify).** `sphere-gallery-3d.tsx` is around 50KB of source plus three.js. Make sure it is lazy-loaded so it isn't shipped to every visitor.

## Suggested order

1. Uploads (Cloudinary) and hosted storage
2. `f_auto,q_auto` on image URLs (quick win, right after Cloudinary is in)
3. Quick UI wins: active states, Publish in the top bar, fewer borders, bigger text
4. Auth once it's hosted
5. Remaining media optimizations as needed
6. Code cleanups as you touch each file
7. Test with the uncle and collect his feedback
