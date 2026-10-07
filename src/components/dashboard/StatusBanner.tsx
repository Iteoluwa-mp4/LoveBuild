import { publicUrl } from "../../lib/site/slug";
import type { SiteStatus } from "../../lib/site/schema";

/**
 * Says out loud whether anyone can see this yet.
 *
 * Publishing is a deliberate, manual step, which means a draft is genuinely
 * invisible to the world. Someone can save everything, share the link and have
 * nobody see it — so this cannot live in a corner of the screen. It sits at the
 * top of the form, and it changes what the share button says.
 */
export default function StatusBanner({
  status,
  slug,
  local,
}: {
  status: SiteStatus | null;
  slug: string;
  /** True while running on localStorage, where nothing is really published. */
  local: boolean;
}) {
  if (local) {
    return (
      <p className="notice notice-warn">
        <strong>Saved in this browser only.</strong> Nothing is on a server yet and nobody
        else can see it.
      </p>
    );
  }

  if (status === null) return null;

  if (status !== "published") {
    return (
      <p className="notice notice-warn">
        <strong>Nobody can see this yet.</strong> It is saved, but it is not published — the
        link stays blank for everyone but you until it is.
      </p>
    );
  }

  return (
    <p className="notice notice-live">
      <strong>Live.</strong> Anyone with this link can see it:{" "}
      <a href={publicUrl(slug)} target="_blank" rel="noreferrer" className="notice-link">
        {publicUrl(slug)}
      </a>
    </p>
  );
}