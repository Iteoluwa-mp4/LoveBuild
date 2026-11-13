import { useCallback, useEffect, useRef, useState } from "react";

import {
  MSG_PREVIEW_CONFIG,
  MSG_PREVIEW_EDIT,
  MSG_PREVIEW_EDITING,
  MSG_PREVIEW_READY,
} from "../../lib/site/brand";
import type { Site } from "../../lib/site/schema";

/**
 * Live preview.
 *
 * An iframe running the real site, not the components rendered inline. That is
 * deliberate: the point of a live preview is that it cannot lie. An inline copy
 * would need animations and scroll-snap switched off to survive a nested
 * scroller — and every one of those switches is a way for the preview to drift
 * away from what visitors actually see.
 *
 * The draft is posted in after a pause, so typing does not thrash a page that is
 * reloading and re-animating on every keystroke.
 *
 * ## Editing on the page
 *
 * The frame is bidirectional. Config flows down; single-field edits come back up.
 * `onEdit` is deliberately the *same* `draft.set` the form uses, so an edit typed
 * on the page and a character typed into a field are the same event from the
 * draft's point of view — there is no second code path that could treat them
 * differently.
 */

const PREVIEW_PATH = "/preview";

type Incoming = { type: typeof MSG_PREVIEW_READY };
type EditMessage = { type: typeof MSG_PREVIEW_EDIT; path: string; value: string };
type EditingMessage = { type: typeof MSG_PREVIEW_EDITING; editing: boolean };

const DEVICE_WIDTH = { desktop: "100%", tablet: "768px", phone: "390px" } as const;
type Device = keyof typeof DEVICE_WIDTH;

export default function PreviewPane({
  site,
  basePath,
  device,
  onDeviceChange,
  onEdit,
  editing,
  onEditingChange,
}: {
  site: Site;
  /** Where the preview reads the config from, e.g. "/preview". */
  basePath: string;
  device: Device;
  onDeviceChange: (device: Device) => void;
  /** One field changed on the page. */
  onEdit: (path: string, value: string) => void;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  // Written in an effect rather than during render: the message listener below is
  // subscribed once, and needs to reach the newest config without being
  // re-subscribed on every keystroke.
  const latest = useRef<Site | null>(null);
  useEffect(() => {
    latest.current = site;
  }, [site]);

  // The same reason, for the edit and editing handlers: subscribed once, so they
  // must read the newest closure rather than being dependencies of the listener.
  const editRef = useRef(onEdit);
  useEffect(() => {
    editRef.current = onEdit;
  }, [onEdit]);

  const editingRef = useRef(editing);
  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);

  const post = useCallback((config: Site) => {
    frameRef.current?.contentWindow?.postMessage(
      { type: MSG_PREVIEW_CONFIG, config } satisfies { type: typeof MSG_PREVIEW_CONFIG; config: Site },
      window.location.origin,
    );
  }, []);

  const postEditing = useCallback((next: boolean) => {
    frameRef.current?.contentWindow?.postMessage(
      { type: MSG_PREVIEW_EDITING, editing: next } satisfies EditingMessage,
      window.location.origin,
    );
  }, []);

  // Listen for the preview announcing it has mounted. Without this the first
  // config change arrives before the listener exists and is silently dropped,
  // leaving a blank frame until the next keystroke.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      // A union, not an intersection. `Partial<Incoming & EditMessage>` would type
// `type` as the *intersection* of two distinct string literals, which is `never`,
// so every comparison below would be a type error rather than a narrowing.
const data = event.data as Partial<Incoming> | Partial<EditMessage>;

      if (data?.type === MSG_PREVIEW_READY) {
        setReady(true);
        if (latest.current) post(latest.current);
        // Re-assert the mode on every mount. Switching device replaces the iframe
        // outright, and a frame that came up in read-only mode would silently
        // swallow the next click.
        postEditing(editingRef.current);
        return;
      }

      if (data?.type === MSG_PREVIEW_EDIT) {
        if (typeof data.path !== "string" || typeof data.value !== "string") return;
        editRef.current(data.path, data.value);
        return;
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [post, postEditing]);

  useEffect(() => {
    if (!ready) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => post(site), 400);
    return () => window.clearTimeout(timer.current);
  }, [ready, site, post]);

  // Toggling the mode posts immediately rather than waiting for the debounce,
  // since it is a change of mode and not of content.
  const toggleEditing = () => {
    const next = !editing;
    onEditingChange(next);
    postEditing(next);
  };

  // Switching devices remounts the frame, so wait to be told it is ready again.
  const reload = () => setReady(false);

  return (
    <div className="preview">
      <div className="preview-bar">
        <span className="field-label" style={{ margin: 0 }}>
          Preview
        </span>
        <div className="segmented">
          <button
            type="button"
            className="btn btn-icon"
            aria-pressed={device === "desktop"}
            onClick={() => onDeviceChange("desktop")}
          >
            Wide
          </button>
          <button
            type="button"
            className="btn btn-icon"
            aria-pressed={device === "tablet"}
            onClick={() => onDeviceChange("tablet")}
          >
            Tablet
          </button>
          <button
            type="button"
            className="btn btn-icon"
            aria-pressed={device === "phone"}
            onClick={() => onDeviceChange("phone")}
          >
            Phone
          </button>
        </div>
        <span className="dash-spacer" />
        <button
          type="button"
          className={`btn ${editing ? "btn-primary" : ""}`}
          aria-pressed={editing}
          onClick={toggleEditing}
          title="Click any text on the page to change it"
        >
          {editing ? "Editing…" : "Edit on page"}
        </button>
        <button
          type="button"
          className="btn btn-icon"
          onClick={() => {
            reload();
            frameRef.current?.contentWindow?.location.reload();
          }}
          title="Reload preview"
        >
          Reload
        </button>
        {!ready && <span className="badge badge-warn">Loading…</span>}
      </div>

      {editing && (
        <p className="preview-hint">
          Click any text on the page to change it. Enter or click away to save,
          Escape to undo.
        </p>
      )}

      <div className="preview-stage">
        <iframe
          ref={frameRef}
          key={device}
          className="preview-frame"
          data-device={device}
          style={{ width: DEVICE_WIDTH[device] }}
          src={`${basePath}`}
          title="Live preview"
          onLoad={reload}
        />
      </div>
    </div>
  );
}

export { PREVIEW_PATH };