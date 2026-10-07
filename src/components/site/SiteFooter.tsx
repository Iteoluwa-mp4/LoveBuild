import { Link } from "react-router-dom";

import { useSession } from "../../hooks/useSession";
import { buildSitemap, editUrl } from "../../lib/site/sitemap";
import type { Site } from "../../lib/site/schema";

/**
 * The site footer: navigation, not content.
 *
 * Deliberately separate from the closing section, which is the author's own
 * copy and hides itself when empty. This one is chrome and is always there —
 * a site with nothing written in it still needs a way to get somewhere.
 *
 * The owner link is the awkward part. It is shown whenever the editor is
 * unlocked, and a visitor — who is, in this build, always locked out — sees
 * "Sign in" instead. That framing is deliberate: it is the only route from a
 * published site back to the editor, so hiding it entirely would leave the owner
 * no way in and there would be nothing to show a visitor anyway.
 */
export default function SiteFooter({ site, basePath }: { site: Site; basePath: string }) {
  const session = useSession();
  const sitemap = buildSitemap(site, basePath);

  const signedIn = session.status === "signed-in";

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
            <a
              className="site-footer-brand"
              href={signedIn ? editUrl(site.slug) : "/dashboard"}
            >
              LoveBuilds
            </a>
          </span>

          {/*
            Owner-facing, and always present — this is the only route back from
            a published site to the editor for someone who is not signed in yet.
            Framed as "sign in" rather than as an admin control, because that is
            what it actually is.
          */}
          {signedIn ? (
            <a className="site-footer-owner" href={editUrl(site.slug)}>
              Edit this site →
            </a>
          ) : (
            <a className="site-footer-owner" href="/login">
              Owner sign in →
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}