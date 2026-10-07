import { useCallback, useEffect, useRef, useState } from "react";

import { MSG_PREVIEW_CONFIG, MSG_PREVIEW_READY } from "../../lib/site/brand";
import type { Site } from "../../lib/site/schema";

/**
 * Live preview.
 *
 * An iframe running the real site, not the components rendered inline. That is
 * deliberate: the point of a live preview is that it cannot lie. An inline copy
 * would need animations, scroll-snap and the 3D ornaments switched off to
 * survive a nested scroller — and every one of those switches is a way for the
 * preview to drift away from what visitors actually see.
 *
 * The draft is posted in after a pause, so typing does not thrash a page that is
 * reloading and re-animating on every keystroke.
 */


const PREVIEW_PATH = "/preview";

type Incoming = { type: typeof MSG_PREVIEW_READY };
type Outgoing = { type: typeof MSG_PREVIEW_CONFIG; config: Site };

const DEVICE_WIDTH = { desktop: "100%", phone: "390px" } as const;
type Device = keyof typeof DEVICE_WIDTH;

export default function PreviewPane({
  site,
  basePath,
  device,
  onDeviceChange,
}: {
  site: Site;
  /** Where the preview reads the config from, e.g. "/preview". */
  basePath: string;
  device: Device;
  onDeviceChange: (device: Device) => void;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  // Written in an effect rather than during render: the message listener below
  // is subscribed once, and needs to reach the newest config without being
  // re-subscribed on every keystroke.
  const latest = useRef<Site | null>(null);
  useEffect(() => {
    latest.current = site;
  }, [site]);

  const post = useCallback((config: Site) => {
    frameRef.current?.contentWindow?.postMessage(
      { type: MSG_PREVIEW_CONFIG, config } satisfies Outgoing,
      window.location.origin,
    );
  }, []);

  // Listen for the preview announcing it has mounted. Without this the first
  // config change arrives before the listener exists and is silently dropped,
  // leaving a blank frame until the next keystroke.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as Partial<Incoming>;
      if (data?.type === MSG_PREVIEW_READY) {
        setReady(true);
        if (latest.current) post(latest.current);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [post]);

  useEffect(() => {
    if (!ready) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => post(site), 400);
    return () => window.clearTimeout(timer.current);
  }, [ready, site, post]);

  // Switching devices remounts the frame, so wait to be told it is ready again.
  const reload = () => setReady(false);

  return (
    <div className="preview">
      <div className="preview-bar">
        <span className="field-label" style={{ margin: 0 }}>
          Preview
        </span>
        <span className="btn-row">
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
            aria-pressed={device === "phone"}
            onClick={() => onDeviceChange("phone")}
          >
            Phone
          </button>
          <button type="button" className="btn btn-icon" onClick={() => { reload(); frameRef.current?.contentWindow?.location.reload(); }}>
            Reload
          </button>
        </span>
        {!ready && <span className="badge">Loading…</span>}
      </div>

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