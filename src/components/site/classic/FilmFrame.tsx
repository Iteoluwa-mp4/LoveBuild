import { useEffect, useRef, useState } from "react";

import MediaPlaceholder from "../shared/MediaPlaceholder";

/**
 * The widest frame we'll open the portrait layout to. A clip that's squarer or
 * wider than this is letterboxed rather than cropped — losing the edges of a
 * memory is worse than a pair of dark bars.
 */
const MAX_RATIO = 0.8;

/**
 * A clip, framed and played.
 *
 * The frame takes its proportions from the file itself, measured on
 * `loadedmetadata`, so a differently shaped clip needs no data change. Height
 * drives the size and the width follows, because these clips are portrait and
 * only 480–720px wide — sizing by width would upscale them.
 *
 * Plays quietly on its own once properly on screen and pauses when it leaves,
 * so the clips introduce themselves but never talk over each other. Muted is
 * not a stylistic choice: it is the only autoplay browsers permit without a
 * gesture, and the native controls let her unmute any of them.
 *
 * Deliberately no transform, no parallax, no scroll-scrubbed rotation. A film
 * should sit still and be watched.
 */
export default function FilmFrame({
  src,
  title,
  className = "",
}: {
  src: string;
  title: string;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ratio, setRatio] = useState<number | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Set on the element, not just the JSX attribute, so the autoplay policy
    // sees it as muted at the moment play() is called
    video.muted = true;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
          void video.play().catch(() => {
            /* autoplay refused — the native controls are still there */
          });
        } else {
          video.pause();
        }
      },
      { threshold: [0, 0.6, 1] },
    );

    io.observe(video);
    return () => io.disconnect();
  }, [src]);

  return (
    <div
      style={{ aspectRatio: String(ratio ? Math.min(ratio, MAX_RATIO) : 9 / 16) }}
      className={`mx-auto h-[min(70svh,34rem)] max-w-full overflow-hidden border border-gold/22 bg-card-deep shadow-frame ${className}`}
    >
      {/* No clip yet: render the frame empty rather than a `<video src="">`,
          which the browser would treat as a request for the current page. */}
      {src ? (
        <video
          ref={videoRef}
          src={src}
          controls
          playsInline
          muted
          preload="metadata"
          aria-label={title}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            if (v.videoWidth && v.videoHeight) setRatio(v.videoWidth / v.videoHeight);
          }}
          className="h-full w-full object-contain"
        />
      ) : (
        <MediaPlaceholder kind="video" className="rounded-none border-0 !min-h-0" />
      )}
    </div>
  );
}
