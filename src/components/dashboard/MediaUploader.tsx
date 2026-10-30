import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";

import type { Media } from "../../lib/site/schema";
import {
  UPLOAD_NOT_CONFIGURED,
  uploadAsset,
  uploadConfigured,
  needsReupload,
} from "../../lib/site/cloudinary";

/**
 * File picker for photos and videos.
 *
 * ## The rule: never persist a URL that cannot resolve
 *
 * This used to hand a `blob:` URL straight to `onChange`, which meant it was
 * saved into the config — where it was already dead, because a blob URL belongs
 * to the tab that made it. The picture looked right until a reload, and then
 * every photograph on the site was broken with nothing in the UI to say why.
 *
 * So the flow is now two halves:
 *
 *   1. **Preview** from a blob, immediately. Nobody should wait on a round trip
 *      to see the picture they just picked.
 *   2. **Persist** only what Cloudinary returns. The blob never reaches
 *      `onChange`.
 *
 * If Cloudinary is not configured, step 2 does not happen and the slot is left
 * empty rather than filled with a lie — empty is detectable, is already
 * reported by the dashboard's to-do list, and reads honestly as "still to do".
 *
 * Everything below is `onChange` of a `Media`; the form does not care where the
 * URL came from, which is why this can change without touching the editors.
 */

const MAX_BYTES = 100 * 1024 * 1024;

/** The facts about a picked file, gathered once by `probeFile`. */
type Picked = {
  name: string;
  bytes: number;
  /** Intrinsic size, used to reserve layout space and avoid layout shift. */
  width: number | null;
  height: number | null;
  kind: "image" | "video";
  /** A blob URL, for the preview in this tab only. Never saved. */
  previewUrl: string;
};

type Probe =
  | { state: "reading"; name: string }
  | ({ state: "uploading" } & Picked)
  /** Cloudinary has it. `media.publicId` is set, so the badge reads Uploaded. */
  | ({ state: "uploaded" } & Picked)
  /** Picked, previewed, but nothing will keep it. */
  | ({ state: "unconfigured" } & Picked)
  | ({ state: "upload-failed"; message: string } & Picked)
  | { state: "too-big"; name: string; bytes: number }
  /** Could not read the file at all. */
  | { state: "failed"; message: string };

/** What `probeFile` reports once: either the file's facts, or why it has none. */
type ProbeResult = { ok: true; picked: Picked } | { ok: false; message: string };

function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Reads a file's dimensions from its own blob, without keeping the bytes.
 *
 * The blob URL this creates is the preview. It is passed along in `Picked` and
 * revoked when the next file is chosen or the component goes away — the one
 * place it is allowed to live, and never the config.
 *
 * Returns a `ProbeResult` rather than a `Probe` so that "this finished" is a
 * different type from "this is in progress". Encoding completion as another
 * `Probe` state would have meant `reading` meaning both at once.
 */
function probeFile(file: File, onDone: (result: ProbeResult) => void): () => void {
  const kind: "image" | "video" = file.type.startsWith("video") ? "video" : "image";
  const previewUrl = URL.createObjectURL(file);
  const element = kind === "image" ? new Image() : document.createElement("video");

  const picked: Picked = {
    name: file.name,
    bytes: file.size,
    kind,
    previewUrl,
    width: null,
    height: null,
  };

  let settled = false;
  const finish = (result: ProbeResult) => {
    if (settled) return;
    settled = true;
    onDone(result);
  };

  // Four seconds, because the file is local and this is decoding bytes already
  // on the machine. Past that the dimensions are given up on rather than the
  // file: a preview with `width: null` still lays out, it just cannot reserve
  // the space in advance.
  const timeout = window.setTimeout(() => {
    finish({ ok: true, picked });
  }, 4000);

  element.onload = () => {
    window.clearTimeout(timeout);
    finish({
      ok: true,
      picked: {
        ...picked,
        width: (element as HTMLImageElement).naturalWidth ?? null,
        height: (element as HTMLImageElement).naturalHeight ?? null,
      },
    });
  };

  element.onerror = () => {
    window.clearTimeout(timeout);
    URL.revokeObjectURL(previewUrl);
    finish({ ok: false, message: `Could not read ${file.name}.` });
  };

  element.src = previewUrl;
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

  /**
   * The current `media`, readable from an async callback.
   *
   * An upload outlives the render it started in, and the author can edit the
   * alt text while it is in flight. Closing over the prop would write that
   * object's state back on completion and quietly drop the edit.
   */
  const mediaRef = useRef(media);
  /*
    Kept in sync from an effect, not assigned during render. Writing a ref
    mid-render races with React's own rendering and is unreliable under
    concurrent rendering — the linter flags it as a warning for exactly that
    reason. Nothing reads it before the upload's response arrives, and the
    effect has certainly run by then, so nothing here depends on the timing.
  */
  useEffect(() => {
    mediaRef.current = media;
  }, [media]);

  /**
   * Which pick is current.
   *
   * Choosing a second file while the first is still uploading makes both
   * promises settle, and without this the slower one wins — the author picks a
   * photo, changes their mind, and ends up with the first one again.
   */
  const pickSeq = useRef(0);

  // Revoke the previous blob URL so repeated picking does not leak memory.
  const previousUrl = useRef<string | null>(null);
  useEffect(() => {
    return () => {
      if (previousUrl.current) URL.revokeObjectURL(previousUrl.current);
      // Invalidates any upload still in flight, so its callback finds a
      // mismatched sequence and stops instead of calling setState on a
      // component that has already gone.
      pickSeq.current += 1;
    };
  }, []);

  const startUpload = (file: File, picked: Picked, seq: number, initial: Media) => {
    /**
     * Clear the slot before anything else.
     *
     * Empty rather than the blob: a dead URL *looks* finished, while an empty
     * slot is reported by the dashboard's to-do list and cannot be mistaken for
     * a working image. This runs whether or not an upload follows, so a file
     * that never leaves this tab is never recorded as though it had.
     */
    const cleared: Media = {
      ...initial,
      url: "",
      publicId: null,
      width: picked.width,
      height: picked.height,
      alt:
        initial.alt || (picked.kind === "image" ? file.name.replace(/\.[^.]+$/, "") : ""),
    };
    onChange(cleared);

    if (!uploadConfigured()) {
      setProbe({ state: "unconfigured", ...picked });
      return;
    }

    setProbe({ state: "uploading", ...picked });

    void uploadAsset(file)
      .then((uploaded) => {
        if (pickSeq.current !== seq) return; // superseded by a later pick
        // Spread over `mediaRef.current`, not `cleared`: the author can edit
        // the alt text while this is in flight, and `cleared` would write that
        // edit back out from under them.
        const latest = mediaRef.current;
        onChange({
          ...latest,
          ...uploaded,
          // Cloudinary always returns dimensions for the asset it created;
          // keep the probed ones only if it somehow did not.
          width: uploaded.width ?? latest.width,
          height: uploaded.height ?? latest.height,
        });
        setProbe({ state: "uploaded", ...picked });
      })
      .catch((error: unknown) => {
        if (pickSeq.current !== seq) return;
        const message =
          error instanceof Error && error.message
            ? error.message
            : "The upload failed for an unknown reason.";
        setProbe({ state: "upload-failed", message, ...picked });
      });
  };

  const pick = (file: File | undefined) => {
    if (!file) return;

    if (file.size > MAX_BYTES) {
      setProbe({ state: "too-big", name: file.name, bytes: file.size });
      return;
    }

    const seq = ++pickSeq.current;
    setProbe({ state: "reading", name: file.name });

    const cancel = probeFile(file, (result) => {
      // The probe can outlive the field it was started from — collapsing the
      // editor section, or unmounting, both end this component while a local
      // decode is still running. `onChange` would then write to a draft path
      // nobody is looking at any more.
      if (pickSeq.current !== seq) return;

      if (!result.ok) {
        setProbe({ state: "failed", message: result.message });
        return;
      }

      const { picked } = result;
      if (previousUrl.current) URL.revokeObjectURL(previousUrl.current);
      previousUrl.current = picked.previewUrl;

      startUpload(file, picked, seq, mediaRef.current);
    });

    return cancel;
  };

  /**
   * Removes the file, abandoning anything in flight at the same time.
   *
   * Without the sequence bump an upload still running would land *after* the
   * removal and put the picture straight back — the author takes it out and it
   * quietly returns a second later. `probe` is reset too, because it holds the
   * blob URL and `previewSrc` would keep showing the picture from it even
   * though `media.url` is now empty.
   */
  const clear = () => {
    pickSeq.current += 1;
    setProbe(null);
    onClear();
  };

  /**
   * The blob while this tab owns one, the stored URL otherwise.
   *
   * `media.publicId` wins deliberately once an upload has landed: the whole
   * point of uploading is a URL that outlives the tab, so the preview should be
   * showing that one. Otherwise a failed upload would still look perfect from a
   * local copy that nobody else can load.
   */
  const previewSrc = media.publicId
    ? media.url
    : probe && "previewUrl" in probe
      ? probe.previewUrl
      : media.url;

  /** The uploader's own `accept` says which it is; the probe says it sooner. */
  const isVideo = probe && "kind" in probe ? probe.kind === "video" : accept.startsWith("video");

  const busy = probe?.state === "reading" || probe?.state === "uploading";

  /**
   * A stored blob URL from an earlier build, with no local preview to show
   * instead.
   *
   * Its file only ever existed in the tab that made it, so there is nothing
   * here to re-send — the panel has to say so rather than render a broken
   * image, which reads as the site being broken rather than one missing file.
   */
  const showDeadFile = needsReupload(media) && !(probe && "previewUrl" in probe);

  return (
    <div className="field">
      <span className="field-label">{label}</span>

      <div className="uploader">
        {/* One chain, in order of which case is most urgent to explain. */}
        {probe?.state === "reading" ? (
          <p className="uploader-meta">Reading {probe.name}…</p>
        ) : showDeadFile ? (
          <p className="field-warn">
            The file behind this picture did not survive a reload, so nobody else can load it.
            Choose it again to upload it.
          </p>
        ) : previewSrc ? (
          isVideo ? (
            <video className="uploader-preview" src={previewSrc} controls preload="metadata" />
          ) : (
            <img className="uploader-preview" src={previewSrc} alt="" />
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
            disabled={busy}
          >
            {probe?.state === "reading"
              ? "Reading…"
              : probe?.state === "uploading"
                ? "Uploading…"
                : // Judged on what is *stored*, not on what is visible. After a
                  // failed or unconfigured pick there is a picture on screen but
                  // nothing behind it, and the word has to be "choose".
                  media.url
                  ? "Replace file"
                  : "Choose file"}
          </button>

          {(media.url || previewSrc) && (
            <button type="button" className="btn btn-danger" onClick={clear}>
              Remove
            </button>
          )}

          {probe?.state === "uploading" && <span className="badge badge-warn">Uploading…</span>}
          {probe?.state === "unconfigured" && (
            <span className="badge badge-warn">Not kept</span>
          )}
          {probe?.state === "upload-failed" && <span className="badge badge-warn">Upload failed</span>}
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

        {(probe?.state === "uploading" || probe?.state === "uploaded") && (
          <p className="uploader-meta">
            {probe.name} · {megabytes(probe.bytes)}
            {probe.width ? ` · ${probe.width}×${probe.height}` : ""}
            {probe.state === "uploading" ? " — uploading, keep this open." : ""}
          </p>
        )}
        {probe?.state === "unconfigured" && <p className="field-warn">{UPLOAD_NOT_CONFIGURED}</p>}
        {probe?.state === "upload-failed" && (
          <p className="field-warn">
            {probe.message} The preview above is local to this tab and will not survive a reload.
          </p>
        )}
        {probe?.state === "too-big" && (
          <p className="field-warn">
            {probe.name} is {megabytes(probe.bytes)}. Keep it under 100 MB.
          </p>
        )}
        {probe?.state === "failed" && <p className="field-warn">{probe.message}</p>}
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
