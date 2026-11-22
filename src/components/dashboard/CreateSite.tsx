import { type FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { FiPlusCircle } from "react-icons/fi";

import { EmptyNote, TextField } from "./fields";
import { getRepository } from "../../lib/site/getRepository";
import { SaveError } from "../../lib/site/repository";
import { checkSlug, publicUrl, slugify } from "../../lib/site/slug";
import { createDraft, SEED_SLUG } from "../../lib/site/default";

/**
 * The create form, reached from the shelf's "Make the first one" action.
 *
 * One question, answered once. Everything after this is editing.
 *
 * It seeds from the existing copy on purpose. Asking someone to write a love
 * letter before they have seen the shape of the thing is how you get an empty
 * site and a disappointed user; starting from something real means the first
 * edit is "change her name", not "begin".
 *
 * Site creation is currently free for every signed-in account. If a limit or
 * payment step comes back, enforce it on the server first; this form should not
 * become the only gate again.
 */
export default function CreateSite({ onDone }: { onDone: (slug: string) => void }) {
  const [name, setName] = useState("");
  const [slugOverride, setSlugOverride] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The derived address, shown live so the link is never a surprise. An
  // override is offered because "For Sarah" becoming `for-sarah` is usually
  // right but occasionally not what they wanted.
  const suggested = useMemo(() => slugify(slugOverride || name), [name, slugOverride]);
  const check = useMemo(() => checkSlug(suggested), [suggested]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!check.ok) {
      setError(check.reason);
      return;
    }

    setBusy(true);

    try {
      const repo = getRepository();

      // `create` owns the address rule: every new site gets a private tail,
      // and another if that whole address is taken. Navigate to what was
      // actually stored, never to what was typed.
      const created = await repo.create(createDraft(check.slug));
      onDone(created.slug);
    } catch (cause) {
      if (cause instanceof SaveError) {
        setError(cause.message);
      } else {
        setError("Could not create the site. Try again.");
      }
      setBusy(false);
    }
  };

  return (
    <div className="dash">
      <div className="dash-form" style={{ margin: "0 auto", paddingTop: "4rem" }}>
        <Link className="btn" to="/profile" style={{ alignSelf: "flex-start" }}>
          <ArrowLeft size={14} />
          Your sites
        </Link>

        <div className="dash-section">
          <div className="dash-section-head" style={{ cursor: "default" }}>
            <span className="dash-section-icon" aria-hidden="true">
              <FiPlusCircle />
            </span>
            <span className="dash-section-title">Create your site</span>
          </div>
          <div className="dash-section-body">
            <p className="field-hint" style={{ marginTop: 0 }}>
              Give it a name. You can change everything else afterwards — this just
              decides your web address.
            </p>

            <form
              onSubmit={submit}
              style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}
            >
              <TextField
                label="What is it called?"
                value={name}
                onChange={(v) => {
                  setName(v);
                  // Clear the override when the name changes, so the derived
                  // slug follows the name until they deliberately override it.
                  setSlugOverride("");
                  setError(null);
                }}
                placeholder="For Sarah"
                maxLength={120}
              />

              {slugOverride !== "" && (
                <TextField
                  label="Web address"
                  value={slugOverride}
                  onChange={setSlugOverride}
                  placeholder={slugify(name)}
                  maxLength={60}
                />
              )}

              <p className="field-hint">
                {check.ok ? (
                  <>
                    Your site will live at{" "}
                    <code style={{ color: "var(--dash-pink-deep)" }}>{publicUrl(check.slug)}</code> plus
                    a short private code, so the link can&rsquo;t be guessed. You&rsquo;ll see the full
                    address after it&rsquo;s made.
                  </>
                ) : (
                  <span className="field-warn">{check.reason}</span>
                )}
              </p>

              {!check.ok && name.trim() && (
                <button type="button" className="btn" style={{ alignSelf: "flex-start" }} onClick={() => setSlugOverride(suggested)}>
                  Use &ldquo;{suggested}&rdquo; anyway
                </button>
              )}

              {error && (
                <p className="notice notice-bad" role="alert">
                  {error}
                </p>
              )}

              <div className="btn-row">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!check.ok || busy || !name.trim()}
                >
                  {busy ? "Creating…" : "Create site"}
                </button>
              </div>
            </form>

            {SEED_SLUG && (
              <>
                <EmptyNote>
                  New sites start with the sample content already filled in, so you can edit
                  rather than begin. Everything in it can be replaced.
                </EmptyNote>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
