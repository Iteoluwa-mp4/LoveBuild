import { Link } from "react-router-dom";

import { sitePaths } from "../../../lib/site/paths";
import { blockySm, monogramGradient } from "../../../lib/shape";

/**
 * Site nav.
 *
 * Takes one `basePath` and derives both destinations from it. It used to accept
 * `homePath` and `galleryPath` as separate props, which let the gallery page
 * pass the same value twice and have "The gallery" quietly link back to the home
 * page. One input, one source of truth.
 *
 * The only content here is the site name — the two link labels are chrome,
 * identical on every site, so they belong to the component and not the config.
 */
export default function SiteNav({ name, basePath }: { name: string; basePath: string }) {
  const paths = sitePaths(basePath);

  return (
    <header className="absolute top-0 inset-x-0 z-30">
      <div className="max-w-6xl mx-auto px-6 sm:px-10 flex items-center justify-between py-7">
        <Link to={paths.home} className="flex items-center gap-3">
          <span
            className={`h-9 w-9 ${blockySm} ${monogramGradient} shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]`}
          />
          <span className="font-display text-lg tracking-wide text-content">{name}</span>
        </Link>

        <nav className="flex items-center gap-8 text-sm font-medium text-lavender/70">
          <Link to={paths.home} className="hover:text-content transition-colors">
            Home
          </Link>
          <Link to={paths.gallery} className="hover:text-content transition-colors">
            The gallery
          </Link>
        </nav>
      </div>
    </header>
  );
}