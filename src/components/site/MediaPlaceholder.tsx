import { Plus } from "lucide-react";

/**
 * What an empty media slot looks like.
 *
 * Every place a photo or a clip can go uses this, so the rule is stated once:
 * no file means a visible, honest gap — never a broken image icon, never an
 * empty frame that could be mistaken for a rendering fault.
 *
 * Deliberately not clickable. It appears on the public site, where there is no
 * dashboard to send you to and a button that does nothing is worse than a label.
 */

export default function MediaPlaceholder({
  kind,
  className = "",
  /** Replaces the default wording when a shorter label reads better. */
  label,
}: {
  kind: "image" | "video";
  className?: string;
  label?: string;
}) {
  const text = label ?? (kind === "video" ? "Add a video" : "Add a picture");

  return (
    <div
      className={`media-placeholder ${className}`}
      data-kind={kind}
      role="img"
      aria-label={`${text} — nothing here yet`}
    >
      <span className="media-placeholder-mark" aria-hidden="true">
        <Plus />
      </span>
      <span className="media-placeholder-text">{text}</span>
    </div>
  );
}