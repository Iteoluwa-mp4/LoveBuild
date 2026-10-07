import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";

import type { Media } from "../../lib/site/schema";

/**
 * File picker for photos and videos.
 *
 * In Step 4a this does NOT upload. Reading a 12MB photo into localStorage would
 * blow the quota in one file, so instead the file is measured, previewed from a
 * blob URL for this session, and left marked as un-uploaded. Real persistence
 * arrives with Cloudinary in Step 5b, behind the same `onChange` call — the form
 * code will not change when it does.
 *
 * The consequence is stated plainly in the UI rather than hidden: a blob URL dies
 * with the page, so these previews disappear on reload. The text and structure
 * survive; the pictures do not.
 */

const MAX_BYTES = 100 * 1024 * 1024;

type Probe =
  | { state: "reading"; name: string }
  | { state: "ready"; name: string; bytes: number; url: string; width: number | null; height: number | null; kind: "image" | "video" }
  | { state: "too-big"; name: string; bytes: number }
  | { state: "failed"; message: string };

function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Reads intrinsic dimensions without keeping the bytes anywhere. */
function probeFile(
  file: File,
  onDone: (probe: Probe) => void,
): () => void {
  const kind: "image" | "video" = file.type.startsWith("video") ? "video" : "image";
  const url = URL.createObjectURL(file);
  const element = kind === "image" ? new Image() : document.createElement("video");

  let settled = false;
  const finish = (probe: Probe) => {
    if (settled) return;
    settled = true;
    onDone(probe);
  };

  const timeout = window.setTimeout(() => {
    finish({
      state: "ready",
      name: file.name,
      bytes: file.size,
      url,
      // Dimensions unavailable, but the file is still usable.
      width: null,
      height: null,
      kind,
    });
  }, 4000);

  element.onload = () => {
    window.clearTimeout(timeout);
    const width = (element as HTMLImageElement).naturalWidth ?? null;
    const height = (element as HTMLImageElement).naturalHeight ?? null;
    finish({ state: "ready", name: file.name, bytes: file.size, url, width, height, kind });
  };

  element.onerror = () => {
    window.clearTimeout(timeout);
    URL.revokeObjectURL(url);
    finish({ state: "failed", message: `Could not read ${file.name}.` });
  };

  element.src = url;
  if (kind === "video") (element as HTMLVideoElement).preload = "metadata";

  return () => window.clearTimeout(timeout);
}

export default function MediaUploader({
  label,
  media,
  accept,
  onChange,
  onClear,
}: {
  label: string;
  media: Media;
  /** e.g. "image/*" or "video/*". */
  accept: string;
  onChange: (next: Media) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [probe, setProbe] = useState<Probe | null>(null);

  // Revoke the previous blob URL so repeated picking does not leak memory.
  const previousUrl = useRef<string | null>(null);
  useEffect(() => {
    return () => {
      if (previousUrl.current) URL.revokeObjectURL(previousUrl.current);
    };
  }, []);

  const pick = (file: File | undefined) => {
    if (!file) return;

    if (file.size > MAX_BYTES) {
      setProbe({ state: "too-big", name: file.name, bytes: file.size });
      return;
    }

    setProbe({ state: "reading", name: file.name });
    const cancel = probeFile(file, (result) => {
      if (result.state === "ready") {
        if (previousUrl.current) URL.revokeObjectURL(previousUrl.current);
        previousUrl.current = result.url;

        onChange({
          ...media,
          url: result.url,
          publicId: null,
          width: result.width,
          height: result.height,
          alt: media.alt || (result.kind === "image" ? file.name.replace(/\.[^.]+$/, "") : ""),
        });
      }
      setProbe(result);
    });

    return cancel;
  };

  const previewSrc = probe?.state === "ready" ? probe.url : media.url;

  return (
    <div className="field">
      <span className="field-label">{label}</span>

      <div className="uploader">
        {previewSrc ? (
          probe?.state === "ready" && probe.kind === "image" ? (
            <img className="uploader-preview" src={previewSrc} alt="" />
          ) : probe?.state === "ready" && probe.kind === "video" ? (
            <video className="uploader-preview" src={previewSrc} controls preload="metadata" />
          ) : (
            <p className="uploader-meta">From the original site: {media.url}</p>
          )
        ) : (
          <div className="uploader-empty" aria-hidden="true">
            <span className="uploader-empty-mark">
              <Plus />
            </span>
            <span className="uploader-empty-text">
              {accept.startsWith("video") ? "Add a video" : "Add a picture"}
            </span>
          </div>
        )}

        <div className="btn-row">
          <button
            type="button"
            className="btn"
            onClick={() => inputRef.current?.click()}
            disabled={probe?.state === "reading"}
          >
            {probe?.state === "reading" ? "Reading…" : previewSrc ? "Replace file" : "Choose file"}
          </button>

          {media.url && (
            <button type="button" className="btn btn-danger" onClick={onClear}>
              Remove
            </button>
          )}

          {probe?.state === "ready" && (
            <span className="badge badge-warn">Not uploaded</span>
          )}
          {media.publicId && <span className="badge badge-good">Uploaded</span>}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => {
            pick(e.target.files?.[0]);
            // Allow re-picking the same file after a removal.
            e.target.value = "";
          }}
        />

        {probe?.state === "ready" && (
          <p className="uploader-meta">
            {probe.name} · {megabytes(probe.bytes)}
            {probe.width ? ` · ${probe.width}×${probe.height}` : ""} — preview only, gone on
            reload. Real uploads come with the next step.
          </p>
        )}
        {probe?.state === "too-big" && (
          <p className="field-warn">
            {probe.name} is {megabytes(probe.bytes)}. Keep it under 100 MB.
          </p>
        )}
        {probe?.state === "failed" && <p className="field-warn">{probe.message}</p>}

        {media.url && !media.publicId && (
          <p className="field-hint">
            This is a session-only preview. Saving the text works now; the file itself needs the
            upload step.
          </p>
        )}
      </div>

      <TextLikeAlt value={media.alt} onChange={(alt) => onChange({ ...media, alt })} />
    </div>
  );
}

function TextLikeAlt({ value, onChange }: { value: string; onChange: (alt: string) => void }) {
  return (
    <div className="field">
      <label className="field-label">Describe this (for screen readers)</label>
      <input
        type="text"
        value={value}
        placeholder="e.g. the two of you on the beach"
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="field-hint">Left blank, the caption is used instead.</p>
    </div>
  );
}