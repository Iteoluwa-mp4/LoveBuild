import { Link } from "react-router-dom";

import { buildSitemap } from "../../../lib/site/sitemap";
import type { Site } from "../../../lib/site/schema";

/**
 * The site footer: navigation, not content.
 *
 * Deliberately separate from the closing section, which is the author's own
 * copy and hides itself when empty. This one is chrome and is always there —
 * a site with nothing written in it still needs a way to get somewhere.
 *
 * **A published gift carries no auth surface at all.** An earlier version
 * showed "Owner sign in →" to signed-out visitors, which put a login door on
 * every site that was sent; a later one showed "Edit this site" to a signed-in
 * author, which still made the recipient's page ask Firebase who was looking.
 * The recipient's page is the artifact, so this component reads no session and
 * imports no auth code: the author reaches the editor at `/dashboard`, and a
 * visitor sees only the site and the credit.
 *
 * The "Made with LoveBuilds" credit stays because the brand does. It is plain
 * text rather than a link, because every route back into the tool is behind the
 * login that a visitor must never be asked to use.
 */
export default function SiteFooter({ site, basePath }: { site: Site; basePath: string }) {
  const sitemap = buildSitemap(site, basePath);
  const name = site.identity.name.trim();

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <nav className="site-footer-cols" aria-label="Site">
          <div>
            <h2 className="site-footer-heading">The site</h2>
            <ul className="site-footer-list">
              {sitemap.pages.map((link) => (
                <li key={link.to}>
                  <Link to={link.to}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {sitemap.chapters.length > 0 && (
            <div>
              <h2 className="site-footer-heading">The gallery</h2>
              <ul className="site-footer-list">
                {sitemap.chapters.map((link) => (
                  <li key={link.to}>
                    {/*
                      A plain anchor, not `<Link>`. React Router does not scroll
                      when only the fragment changes, so a `<Link>` to another
                      spot on the page you are already on updates the URL and
                      leaves you exactly where you were — a link that looks like
                      it worked and did not. The browser handles fragments
                      natively, scrolling included.
                    */}
                    <a href={link.to}>{link.label}</a>
                  </li>
                ))}
                {sitemap.chaptersTruncated && (
                  <li className="site-footer-more">
                    <Link to={sitemap.pages[1]?.to ?? basePath}>All chapters →</Link>
                  </li>
                )}
              </ul>
            </div>
          )}
        </nav>

        <div className="site-footer-credit">
          <span>
            {name && <span className="site-footer-name">{name} · </span>}
            <span className="site-footer-made">Made with </span>
            <span className="site-footer-brand">LoveBuilds</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
