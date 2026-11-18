/**
 * Making a phone photo small enough to upload.
 *
 * Cloudinary's Free plan caps an image at 10 MB and 25 megapixels. A modern
 * phone can produce both a 15 MB file and a 48 MP frame, so sending the
 * original means the upload is rejected after the person has already waited
 * for it to travel. Re-encoding in the browser keeps the bytes that actually
 * move small, and every image the browser can display can be prepared without
 * a server round trip.
 *
 * The cap is on the longest edge rather than a fixed width: a portrait phone
 * photo and a landscape one should both keep their shape. 2560px is enough
 * for a full-width image on a retina laptop and leaves room for the templates'
 * largest slot.
 */

/** The longest edge of the uploaded copy. Never upscales. */
export const IMAGE_MAX_EDGE = 2560;

/** Good enough for photographs, small enough to be worth doing. */
const IMAGE_QUALITY = 0.85;

/** An image we are willing to touch. GIF and SVG are left exactly as picked. */
const SKIPPED_IMAGE_TYPES = new Set(["image/gif", "image/svg+xml"]);

export type PreparedImage = {
  /** The file to upload. It has the same pixels, at a smaller size. */
  file: File;
  width: number;
  height: number;
  /** Bytes the person picked, so the saving can be shown. */
  originalBytes: number;
  /** Bytes that will actually be sent. */
  bytes: number;
};

/**
 * The dimensions after fitting the longest edge inside `maxEdge`.
 *
 * Returns `{ width: 0, height: 0 }` for dimensions the browser could not
 * report, which the caller treats as "leave the file alone".
 */
export function scaledSize(
  width: number,
  height: number,
  maxEdge = IMAGE_MAX_EDGE,
): { width: number; height: number } {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !Number.isFinite(maxEdge) ||
    width <= 0 ||
    height <= 0 ||
    maxEdge <= 0
  ) {
    return { width: 0, height: 0 };
  }

  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** The output filename, with the extension matching the encoded type. */
export function outputName(name: string, type: string): string {
  const base = name.replace(/\.[^./\\]+$/, "").trim();
  const extension =
    type === "image/webp" ? "webp" : type === "image/png" ? "png" : "jpg";
  return `${base || "photo"}.${extension}`;
}

/** True for still images this module is allowed to decode and re-encode. */
export function isReencodableImage(file: File): boolean {
  return file.type.startsWith("image/") && !SKIPPED_IMAGE_TYPES.has(file.type);
}

/**
 * Whether the browser can read an animated image.
 *
 * An animated GIF, APNG or WebP would be flattened to its first frame by a
 * canvas. They are rare in a photo album, but silently losing every other
 * frame is worse than uploading the original, so they are left alone.
 */
async function isAnimated(file: File): Promise<boolean> {
  if (file.type === "image/gif") return true;
  if (file.type !== "image/png" && file.type !== "image/webp") return false;

  try {
    const bytes = new Uint8Array(await file.slice(0, 64).arrayBuffer());
    const header = ascii(bytes);

    if (file.type === "image/png") {
      // APNG's acTL chunk must precede IDAT, so it is inside this window.
      return header.includes("acTL");
    }

    // Animated WebP: RIFF....WEBP VP8X, with the animation bit set in the
    // first flags byte. A still WebP starts with VP8 or VP8L instead.
    return (
      header.slice(12, 16) === "VP8X" &&
      (bytes[20] & 0x02) !== 0
    );
  } catch {
    return false;
  }
}

function ascii(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return text;
}

type Decoded = {
  source: CanvasImageSource;
  width: number;
  height: number;
  /** Releases the decoded image or the object URL that backs it. */
  close: () => void;
};

/**
 * Decodes a local file without keeping the original bytes around.
 *
 * `createImageBitmap` is the fast path and understands EXIF orientation. The
 * `<img>` fallback exists because some browsers can display a format through
 * an element that they refuse through `createImageBitmap`.
 */
async function decodeImage(file: File): Promise<Decoded | null> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      /* Fall through to the element path. */
    }
  }

  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The image could not be decoded."));
      image.src = url;
    });

    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
}

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type AnyContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function createCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function canvasContext(canvas: AnyCanvas): AnyContext | null {
  return canvas.getContext("2d") as AnyContext | null;
}

function toBlob(
  canvas: AnyCanvas,
  type: string,
  quality?: number,
): Promise<Blob | null> {
  if ("convertToBlob" in canvas) {
    const options = quality === undefined ? { type } : { type, quality };
    return canvas.convertToBlob(options).catch(() => null);
  }

  return new Promise((resolve) => {
    (canvas as HTMLCanvasElement).toBlob(
      (blob) => resolve(blob),
      type,
      quality,
    );
  });
}

/**
 * Encodes the canvas, preferring WebP because it is usually the smallest
 * browser-readable format for a photograph.
 *
 * A browser that ignores WebP hands back a PNG instead. For an opaque photo
 * that PNG is thrown away in favour of JPEG; for a source that may have
 * transparency, PNG is the safe fallback because JPEG would turn the empty
 * pixels black.
 */
async function encodeCanvas(
  canvas: AnyCanvas,
  context: AnyContext,
  file: File,
  width: number,
  height: number,
): Promise<Blob | null> {
  const mayHaveAlpha =
    file.type === "image/png" ||
    file.type === "image/webp" ||
    file.type === "image/avif";

  const webp = await toBlob(canvas, "image/webp", IMAGE_QUALITY);
  if (webp?.type === "image/webp") return webp;

  if (mayHaveAlpha) {
    return (await toBlob(canvas, "image/png")) ?? webp;
  }

  // JPEG has no alpha channel, so paint white behind the pixels rather than
  // letting a transparent source become black.
  context.save();
  context.globalCompositeOperation = "destination-over";
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.restore();

  return (await toBlob(canvas, "image/jpeg", IMAGE_QUALITY)) ?? webp;
}

/**
 * Re-encodes one still image for upload.
 *
 * Returns `null` when there is nothing worth doing: a video, an animated
 * image, a format the browser cannot decode, or a file that is already small
 * enough that the re-encode came out larger. The caller then uploads the
 * original, so this function can never make an upload fail on its own.
 */
export async function prepareImage(file: File): Promise<PreparedImage | null> {
  if (!isReencodableImage(file)) return null;
  if (await isAnimated(file)) return null;

  const decoded = await decodeImage(file);
  if (!decoded) return null;

  try {
    const size = scaledSize(decoded.width, decoded.height);
    if (size.width <= 0 || size.height <= 0) return null;

    const canvas = createCanvas(size.width, size.height);
    const context = canvasContext(canvas);
    if (!context) return null;

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(decoded.source, 0, 0, size.width, size.height);

    const blob = await encodeCanvas(
      canvas,
      context,
      file,
      size.width,
      size.height,
    );
    if (!blob || blob.size === 0) return null;

    const overEdge =
      decoded.width > IMAGE_MAX_EDGE || decoded.height > IMAGE_MAX_EDGE;
    // A HEIC that this browser managed to decode must become WebP/JPEG or it
    // will be broken in a browser that cannot display HEIC at all.
    const mustConvert = file.type === "image/heic" || file.type === "image/heif";

    if (!overEdge && !mustConvert && blob.size >= file.size) return null;

    return {
      file: new File([blob], outputName(file.name, blob.type), {
        type: blob.type,
        lastModified: file.lastModified,
      }),
      width: size.width,
      height: size.height,
      originalBytes: file.size,
      bytes: blob.size,
    };
  } catch {
    return null;
  } finally {
    decoded.close();
  }
}
