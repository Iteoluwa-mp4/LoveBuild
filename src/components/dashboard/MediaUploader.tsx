import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";

import type { Media, MediaKind } from "../../lib/site/schema";
import { prepareImage } from "../../lib/site/imagePrep";
import {
  UPLOAD_LIMITS,
  formatBytes,
  formatPixels,
} from "../../lib/site/uploadLimits";
import {
  UPLOAD_NOT_CONFIGURED,
  UploadError,
  isRetryable,
  needsReupload,
  uploadAsset,
  uploadConfigured,
  type UploadFailureKind,
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
 * So the flow is now three halves:
 *
 *   1. **Preview** from a blob, immediately. Nobody should wait on a round trip
 *      to see the picture they just picked.
 *   2. **Prepare** still photos in the browser. A 48 MP phone picture becomes
 *      a ~1 MB WebP, which is both more likely to survive the upload and much
 *      cheaper to load once it is on the site.
 *   3. **Persist** only what Cloudinary returns. The blob never reaches
 *      `onChange`.
 *
 * If Cloudinary is not configured, step 3 does not happen and the slot is left
 * empty rather than filled with a lie — empty is detectable, is already
 * reported by the dashboard's to-do list, and reads honestly as "What's Left?".
 *
 * A failed upload keeps the file and shows a reason plus a retry action. The
 * file picker is not the only way out of a bad connection.
 */

/** A picked file and the facts needed to preview, retry, and describe it. */
type Picked = {
  name: string;
  /** Bytes actually sent: the smaller re-encoded size for an optimized photo. */
  bytes: number;
  /** Bytes the person picked, so the saving can be shown. */
  originalBytes: number;
  /** Intrinsic size of the file being uploaded. */
  width: number | null;
  height: number | null;
  kind: MediaKind;
  /** A blob URL, for the preview in this tab only. Never saved. */
  previewUrl: string;
  /** The exact file to send: a re-encoded copy when one was made. */
  file: File;
  /** True when `file` is the smaller re-encoded copy. */
  optimized: boolean;
};

type Failure = {
  kind: UploadFailureKind;
  message: string;
  retryable: boolean;
};

type Probe =
  | { state: "reading"; name: string }
  | ({ state: "preparing" } & Picked)
  | ({ state: "uploading" } & Picked)
  | ({ state: "uploaded" } & Picked)
  | ({ state: "unconfigured" } & Picked)
  | ({ state: "upload-failed"; failure: Failure } & Picked)
  | ({ state: "too-big"; reason: "bytes" | "pixels" } & Picked)
  /** Could not read the file at all. */
  | { state: "failed"; name: string; message: string; file: File };

/** What `probeFile` reports once: either the file's facts, or why it has none. */
type ProbeResult =
  | { ok: true; picked: Picked }
  | { ok: false; message: string; file: File };

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
  const kind: MediaKind = file.type.startsWith("video") ? "video" : "image";
  const previewUrl = URL.createObjectURL(file);
  const element = kind === "image" ? new Image() : document.createElement("video");

  const picked: Picked = {
    name: file.name,
    bytes: file.size,
    originalBytes: file.size,
    kind,
    previewUrl,
    width: null,
    height: null,
    file,
    optimized: false,
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
    const width =
      kind === "image"
        ? (element as HTMLImageElement).naturalWidth
        : (element as HTMLVideoElement).videoWidth;
    const height =
      kind === "image"
        ? (element as HTMLImageElement).naturalHeight
        : (element as HTMLVideoElement).videoHeight;

    finish({
      ok: true,
      picked: {
        ...picked,
        width: width || null,
        height: height || null,
      },
    });
  };

  element.onerror = () => {
    window.clearTimeout(timeout);
    URL.revokeObjectURL(previewUrl);
    finish({ ok: false, message: `Could not read ${file.name}.`, file });
  };

  element.src = previewUrl;
  if (kind === "video") (element as HTMLVideoElement).preload = "metadata";

  return () => {
    window.clearTimeout(timeout);
    // Only an unfinished probe still owns the URL. Once a result has been
    // handed back, `startUpload` keeps the preview on screen.
    if (!settled) {
      settled = true;
      URL.revokeObjectURL(previewUrl);
    }
  };
}

/** Turns any thrown value into the reason the field can explain. */
function failureFor(error: unknown): Failure {
  if (error instanceof UploadError) {
    return {
      kind: error.kind,
      message: error.message,
      retryable: isRetryable(error.kind),
    };
  }

  return {
    kind: "unknown",
    message:
      error instanceof Error && error.message
        ? error.message
        : "The upload failed for an unknown reason.",
    retryable: true,
  };
}

/** The human sentence for each failure kind. The raw message stays in detail. */
function failureCopy(failure: Failure): {
  title: string;
  message: string;
  detail: string | null;
} {
  switch (failure.kind) {
    case "too-large":
      return {
        title: "File too large.",
        message: failure.message,
        detail: null,
      };
    case "network":
      return {
        title: "Upload interrupted.",
        message:
          "The file did not finish uploading. Check your connection and try again.",
        detail: null,
      };
    case "auth":
      return {
        title: "Upload permission expired.",
        message:
          "Try again to get a fresh permission. If that still fails, sign in again.",
        detail: failure.message,
      };
    case "rate-limit":
      return {
        title: "Uploads are paused.",
        message:
          "Cloudinary is limiting uploads right now. Wait a minute, then try again.",
        detail: null,
      };
    case "format":
      return {
        title: "That format could not be read.",
        message: "Try a JPEG, PNG or WebP.",
        detail: failure.message,
      };
    case "server":
      return {
        title: "Cloudinary had a problem.",
        message: "The file could not be processed. Try again.",
        detail: failure.message,
      };
    case "unconfigured":
      return {
        title: "Uploads are not configured.",
        message: failure.message,
        detail: null,
      };
    default:
      return {
        title: "The upload failed.",
        message: "The reason is unknown. Try again, or replace the file.",
        detail: failure.message,
      };
  }
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
  /** Cancels a probe that is still reading, which also releases its preview. */
  const pendingProbe = useRef<(() => void) | null>(null);
  useEffect(() => {
    return () => {
      pendingProbe.current?.();
      pendingProbe.current = null;
      if (previousUrl.current) URL.revokeObjectURL(previousUrl.current);
      // Invalidates any upload still in flight, so its callback finds a
      // mismatched sequence and stops instead of calling setState on a
      // component that has already gone.
      pickSeq.current += 1;
    };
  }, []);

  const startUpload = (
    source: File,
    picked: Picked,
    seq: number,
    alreadyPrepared = false,
  ) => {
    /**
     * Clear the slot when the upload is actually about to start.
     *
     * Empty rather than the blob: a dead URL *looks* finished, while an empty
     * slot is reported by the dashboard's to-do list and cannot be mistaken for
     * a working image. Doing it here rather than on pick means a file rejected
     * by the local size check leaves the existing picture in place.
     */
    const clearSlot = (width: number | null, height: number | null) => {
      const latest = mediaRef.current;
      onChange({
        ...latest,
        url: "",
        publicId: null,
        width,
        height,
        alt:
          latest.alt ||
          (picked.kind === "image" ? source.name.replace(/\.[^.]+$/, "") : ""),
      });
    };

    if (!uploadConfigured()) {
      clearSlot(picked.width, picked.height);
      setProbe({ state: "unconfigured", ...picked, file: source });
      return;
    }

    const run = async () => {
      let ready: Picked = { ...picked, file: source };

      if (!alreadyPrepared && picked.kind === "image") {
        setProbe({ state: "preparing", ...ready });
        const prepared = await prepareImage(source);
        if (pickSeq.current !== seq) return;

        if (prepared) {
          ready = {
            ...ready,
            file: prepared.file,
            bytes: prepared.bytes,
            width: prepared.width,
            height: prepared.height,
            optimized: true,
          };
        }
      }

      if (pickSeq.current !== seq) return;

      const limit = UPLOAD_LIMITS[ready.kind];
      const pixels =
        ready.width && ready.height ? ready.width * ready.height : null;

      // A file that cannot fit the limit never reaches Cloudinary, so the
      // existing picture is deliberately left untouched.
      if (ready.bytes > limit.bytes) {
        setProbe({ state: "too-big", reason: "bytes", ...ready });
        return;
      }

      if (limit.pixels !== null && pixels !== null && pixels > limit.pixels) {
        setProbe({ state: "too-big", reason: "pixels", ...ready });
        return;
      }

      clearSlot(ready.width, ready.height);
      setProbe({ state: "uploading", ...ready });

      void uploadAsset(ready.file, ready.kind)
        .then((uploaded) => {
          if (pickSeq.current !== seq) return; // superseded by a later pick
          // Spread over `mediaRef.current`, not the cleared slot: the author
          // can edit the alt text while this is in flight, and the cleared
          // object would write that edit back out from under them.
          const latest = mediaRef.current;
          onChange({
            ...latest,
            ...uploaded,
            // Cloudinary always returns dimensions for the asset it created;
            // keep the prepared ones only if it somehow did not.
            width: uploaded.width ?? latest.width,
            height: uploaded.height ?? latest.height,
          });
          setProbe({ state: "uploaded", ...ready });
        })
        .catch((error: unknown) => {
          if (pickSeq.current !== seq) return;
          setProbe({
            state: "upload-failed",
            ...ready,
            failure: failureFor(error),
          });
        });
    };

    void run();
  };

  const pick = (file: File | undefined) => {
    if (!file) return;

    // A previous probe still decoding would otherwise keep its blob URL alive
    // even though its result can no longer be used.
    pendingProbe.current?.();
    pendingProbe.current = null;

    const seq = ++pickSeq.current;
    setProbe({ state: "reading", name: file.name });

    const cancel = probeFile(file, (result) => {
      // The probe can outlive the field it was started from — collapsing the
      // editor section, or unmounting, both end this component while a local
      // decode is still running. `onChange` would then write to a draft path
      // nobody is looking at any more.
      if (pickSeq.current !== seq) return;
      pendingProbe.current = null;

      if (!result.ok) {
        setProbe({
          state: "failed",
          name: file.name,
          message: result.message,
          file: result.file,
        });
        return;
      }

      const { picked } = result;
      if (previousUrl.current) URL.revokeObjectURL(previousUrl.current);
      previousUrl.current = picked.previewUrl;

      startUpload(file, picked, seq);
    });

    pendingProbe.current = cancel;
  };

  /**
   * Runs the failed step again with the file already in hand.
   *
   * A prepared photo is reused as-is: encoding it a second time would waste
   * time and could change the quality for no reason. The signature is new on
   * every attempt, so a retry after an expired permission slip is a real retry.
   */
  const retry = () => {
    if (!probe) return;

    if (probe.state === "failed") {
      pick(probe.file);
      return;
    }

    if (probe.state !== "upload-failed") return;

    const seq = ++pickSeq.current;
    startUpload(probe.file, probe, seq, probe.optimized);
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
    pendingProbe.current?.();
    pendingProbe.current = null;
    setProbe(null);
    if (previousUrl.current) {
      URL.revokeObjectURL(previousUrl.current);
      previousUrl.current = null;
    }
    onClear();
  };

  /**
   * The picked file while it is being prepared or uploaded, the stored URL
   * otherwise.
   *
   * A file that was rejected before sending (too big) deliberately falls back
   * to `media.url`: nothing was replaced, so the old picture is still what the
   * site will show. Once an upload starts the slot is cleared, and a failure
   * leaves the local preview as the only picture available.
   */
  const previewFromPick = probe && "previewUrl" in probe ? probe.previewUrl : "";
  const previewingPick =
    probe?.state === "preparing" || probe?.state === "uploading";
  const previewSrc = previewingPick ? previewFromPick : media.url || previewFromPick;

  const probeKind: MediaKind | null =
    probe && "kind" in probe ? probe.kind : null;
  const previewKind: MediaKind =
    (previewingPick || !media.url) && probeKind
      ? probeKind
      : accept.startsWith("video")
        ? "video"
        : "image";
  const isVideo = previewKind === "video";

  const busy =
    probe?.state === "reading" ||
    probe?.state === "preparing" ||
    probe?.state === "uploading";

  const canRetry =
    probe?.state === "upload-failed" || probe?.state === "failed";

  const failure = probe?.state === "upload-failed" ? failureCopy(probe.failure) : null;

  /**
   * A stored blob URL from an earlier build, with no local preview to show
   * instead.
   *
   * Its file only ever existed in the tab that made it, so there is nothing
   * here to re-send — the panel has to say so rather than render a broken
   * image, which reads as the site being broken rather than one missing file.
   */
  const showDeadFile = needsReupload(media) && !previewingPick;

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
              : probe?.state === "preparing"
                ? "Optimizing…"
                : probe?.state === "uploading"
                  ? "Uploading…"
                  : // Judged on what is *stored*, not on what is visible. After a
                    // failed or unconfigured pick there is a picture on screen but
                    // nothing behind it, and the word has to be "choose".
                    media.url
                    ? "Replace file"
                    : "Choose file"}
          </button>

          {canRetry && (
            <button type="button" className="btn" onClick={retry} disabled={busy}>
              Try again
            </button>
          )}

          {(media.url || previewSrc) && (
            <button type="button" className="btn btn-danger" onClick={clear}>
              Remove
            </button>
          )}

          {probe?.state === "preparing" && <span className="badge badge-warn">Optimizing…</span>}
          {probe?.state === "uploading" && <span className="badge badge-warn">Uploading…</span>}
          {probe?.state === "unconfigured" && (
            <span className="badge badge-warn">Not kept</span>
          )}
          {probe?.state === "upload-failed" && <span className="badge badge-warn">Upload failed</span>}
          {probe?.state === "too-big" && <span className="badge badge-warn">Too large</span>}
          {probe?.state === "failed" && <span className="badge badge-warn">Could not read</span>}
          {media.publicId && (!probe || probe.state === "uploaded") && (
            <span className="badge badge-good">Uploaded</span>
          )}
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

        {(probe?.state === "preparing" ||
          probe?.state === "uploading" ||
          probe?.state === "uploaded") && (
          <p className="uploader-meta">
            {probe.name} ·{" "}
            {probe.optimized
              ? `${formatBytes(probe.originalBytes)} → ${formatBytes(probe.bytes)}`
              : formatBytes(probe.bytes)}
            {probe.width ? ` · ${probe.width}×${probe.height}` : ""}
            {probe.state === "preparing"
              ? " — optimizing, keep this open."
              : probe.state === "uploading"
                ? " — uploading, keep this open."
                : ""}
          </p>
        )}

        {probe?.state === "unconfigured" && <p className="field-warn">{UPLOAD_NOT_CONFIGURED}</p>}

        {probe?.state === "upload-failed" && failure && (
          <div className="field-warn" role="alert">
            <strong>{failure.title}</strong> {failure.message}
            {failure.detail && failure.detail !== failure.message && (
              <details className="uploader-details">
                <summary>Technical details</summary>
                <code>{failure.detail}</code>
              </details>
            )}
            {probe.failure.kind === "auth" && (
              <span className="uploader-meta">
                {" "}
                Sign in again before retrying.
              </span>
            )}
            {!probe.failure.retryable &&
              probe.failure.kind !== "auth" &&
              probe.failure.kind !== "unconfigured" && (
                <span className="uploader-meta">
                  {" "}
                  Retrying is unlikely to help; replacing the file is the surest fix.
                </span>
              )}
          </div>
        )}

        {probe?.state === "too-big" && (
          <p className="field-warn">
            {probe.reason === "bytes" ? (
              <>
                {probe.name} is {formatBytes(probe.bytes)}. The upload limit is{" "}
                {formatBytes(UPLOAD_LIMITS[probe.kind].bytes)}.
              </>
            ) : (
              <>
                {probe.name} is{" "}
                {formatPixels((probe.width ?? 0) * (probe.height ?? 0))}. The limit is{" "}
                {formatPixels(UPLOAD_LIMITS[probe.kind].pixels ?? 0)}.
              </>
            )}{" "}
            {probe.kind === "video" ? "Choose a shorter video." : "Choose a smaller image."}
          </p>
        )}

        {probe?.state === "failed" && (
          <p className="field-warn">
            {probe.message} Try another file, or the same one again.
          </p>
        )}
      </div>

      <AltField value={media.alt} onChange={(alt) => onChange({ ...media, alt })} />
    </div>
  );
}

function AltField({ value, onChange }: { value: string; onChange: (alt: string) => void }) {
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
