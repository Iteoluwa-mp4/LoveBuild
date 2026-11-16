import { Link } from "react-router-dom";

import { FilmIllustration } from "../auth/AuthScreen";
import { CONTACT } from "../../lib/contact";

/**
 * Contact the developer — the front door's second page.
 *
 * Built on the auth screen's own shell (`auth-shell` + the illustration +
 * the form panel) so it reads as the same building rather than a bare
 * utility page: whoever follows the footer's "contact" link lands somewhere
 * that looks like the place they left. Importing `FilmIllustration` through
 * AuthScreen is also what guarantees `auth-screen.css` is in the bundle on a
 * direct hit at `/contact`.
 *
 * Public, like `/login` — a visitor who cannot sign in still has to be able
 * to reach a human.
 */
export default function ContactPage() {
  return (
    <main className="auth-screen">
      <section className="auth-shell">
        <FilmIllustration />
        <div className="auth-form-panel">
          <header className="auth-header">
            <span className="auth-brand">
              LoveBuilds<span>.</span>
            </span>
            <span className="auth-issue">stories, kept</span>
          </header>

          <div className="auth-content">
            <p className="auth-eyebrow">Contact the developer</p>
            <h1>
              Say hello. <em>I read everything.</em>
            </h1>
            <p className="auth-description">
              Bugs, feature ideas, questions about your site — or a note that it worked. Whichever
              is easiest; they all reach the same person.
            </p>

            <div className="contact-list">
              <div className="contact-block">
                <p className="contact-label">Email</p>
                <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
              </div>

              <div className="contact-block">
                <p className="contact-label">WhatsApp</p>
                {CONTACT.whatsapp.map((channel) => (
                  <a
                    key={channel.href}
                    href={channel.href}
                    target="_blank"
                    rel="noreferrer"
                    title="Chat on WhatsApp"
                  >
                    {channel.display}
                  </a>
                ))}
              </div>
            </div>
          </div>

          <footer className="auth-footer">
            <span>made for the soft-hearted</span>
            <Link className="auth-privacy-link" to="/login">
              back to sign in
            </Link>
            <span>© 2026 LoveBuilds</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
