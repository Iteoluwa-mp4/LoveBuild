import { useMemo } from "react";

import GodPoetryTemplate from "../../GodPoetryTemplate";
import type { Site } from "../../../lib/site/schema";
import { godPoetryPaths } from "./paths";

/**
 * The God Poetry template, rendered from a saved site.
 *
 * The long-form blessing itself is presentational — see
 * `GodPoetryTemplate.tsx` — so this wrapper is the whole mapping between the
 * shared config and the props that page understands:
 *
 *   - `identity.name` is the name the copy addresses. A blank value falls back
 *     to the recipient the design was made for, never to an empty greeting.
 *   - `identity.initials` is the mark in the top bar. Blank restores the
 *     template's own wordmark.
 *   - `godpoetry.hero.lines` is the cover title, and
 *     `godpoetry.hero.dedication` is the italic line under it.
 *   - `home.moments` is the one photograph list every template shares. The
 *     first uploaded image becomes the cover art, the second the poem spread,
 *     and the gallery shows all of them.
 *
 * Only moments with a real URL are used for the two large images; an unuploaded
 * slot is not a photograph and would render as a broken frame. The gallery
 * still shows those slots, with a generated placeholder, so an author midway
 * through uploading sees where each picture will land.
 */
export default function GodPoetryHomePage({
  site,
  basePath,
}: {
  site: Site;
  basePath: string;
}) {
  const paths = useMemo(() => godPoetryPaths(basePath), [basePath]);

  const photos = useMemo(
    () =>
      site.home.moments
        .map((moment) => ({
          url: moment.image.url.trim(),
          alt: moment.image.alt.trim() || moment.caption.trim(),
        }))
        .filter((photo) => photo.url.length > 0),
    [site.home.moments],
  );

  const lines = useMemo(
    () => site.godpoetry.hero.lines.map((line) => line.trim()).filter(Boolean),
    [site.godpoetry.hero.lines],
  );

  const name = site.identity.name.trim() || "Cristian";
  const initials = site.identity.initials.trim();
  const dedication = site.godpoetry.hero.dedication.trim();

  const hero = photos[0];
  const poem = photos[1];

  return (
    <GodPoetryTemplate
      friendName={name}
      lines={lines.length > 0 ? lines : undefined}
      dedication={dedication || undefined}
      initials={initials || undefined}
      heroImage={hero?.url}
      heroImageAlt={hero ? hero.alt || `${name}, a photograph` : undefined}
      poemImage={poem?.url}
      poemImageAlt={poem ? poem.alt || `${name}, a photograph` : undefined}
      galleryHref={paths.gallery}
      homeHref={paths.home}
    />
  );
}
