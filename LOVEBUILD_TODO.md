# LoveBuild: Things That Need Work

Priority order. Tick items off as you go.

## 1. Must fix before the uncle uses it for real

- [ ] **Hosted storage.** Sites live in localStorage, so the link only works on the machine that made it. Needs a hosted backend (or somewhere to publish the data) so the recipient can open it.
- [ ] **Persistent uploads.** Photos and videos are blob URLs and disappear on reload. Move them to Cloudinary (or similar). This is the most important fix.
- [ ] **Real auth.** The local passcode gates the editor but doesn't protect the data. Fine for now, not once it's hosted.

## 2. Dashboard UI

- [ ] **Active state for toggle buttons.** `aria-pressed` is only styled for `.theme-card`. Front page / Gallery, the device switcher and "Edit on page" show no selected state. Fix:
  ```css
  .btn[aria-pressed="true"] {
    background: color-mix(in srgb, var(--dash-accent) 18%, var(--dash-panel-2));
    border-color: var(--dash-accent);
    color: #fff;
  }
  ```
- [ ] **Clearer hierarchy.** Make **Publish** a primary button in the top bar (it's buried in the banner and scrolls away). Make "Save now" a quiet text button. Group View site and Gallery.
- [ ] **Fewer boxes inside boxes.** Section, item and item-head all have borders and backgrounds. Remove borders on `.item` and `.item-head`, and separate with spacing and tone instead.
- [ ] **Bigger, roomier text.** Base font to about 15px, hints around 0.78rem, inputs around 0.92rem with more padding, and larger gaps in `.dash-form` and `.dash-side`.
- [ ] **Warmer look.** The cold blue on near-black reads as a generic admin panel. Try a soft rose or gold accent, or pull the accent from the chosen theme tokens.
- [x] **Progress indicator.** A circular upload dial in the bottom-left corner, with the percentage in the middle. It counts uploads and the words that belong to them — photographs, clips, and their captions or titles — and nothing else, so typing a heading does not move it. The publish dock keeps the full completeness check, because "is this worth sharing" is a different question from "how much of it is here".
- [ ] **Preview polish.** Replace the checkerboard preview background with a calm dark tone and a soft shadow on the phone frame. Restyle the `go` buttons in the issues lists as inline links. Add short transitions on section open and button hover.

## 3. Lighter uploads and downloads (without cutting quality or size limits)

The idea: keep the original at full quality in storage, and only optimize what gets delivered. Do the first two items and you get roughly 80% of the benefit.

**Do first**
- [ ] **Upload straight from the browser to Cloudinary** (signed or unsigned upload) so big files never bottleneck on your own server.
- [ ] **Add `f_auto,q_auto` to every displayed image URL.** Cloudinary then serves AVIF or WebP at a smart quality per device.

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
