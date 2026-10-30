/**
 * The upload ring.
 *
 * A circle that fills as the site's photographs and clips arrive, with the
 * percentage in the middle.
 *
 * ## Why a ring and not a bar
 *
 * A bar's length is read by comparing it to a track of unknown width, which
 * means the number has to be somewhere else — and the number was the thing
 * people actually looked at. A ring puts the number inside the thing it
 * measures, so there is one object to look at rather than a shape and a number
 * that have to be correlated.
 *
 * ## What it counts
 *
 * Uploads and the words that belong to them, and nothing else. A heading is
 * not a task, so writing one does not move this. See `uploadProgress` in
 * `derive.ts`.
 *
 * ## Why it is in the corner
 *
 * Because it is a summary, not a control, and a summary in the flow of the form
 * is a thing the author scrolls past. In the corner it is always in the same
 * place, always the same size, and never in the way of the fields.
 *
 * It sits directly above the publish dock rather than at a guessed offset, and
 * its left edge lines up with the dock's, so it reads as part of the bottom of
 * the form instead of a stray dial floating near it.
 */
export default function ProgressRing({
  percent,
  done,
  total,
  complete,
}: {
  /** 0–100. */
  percent: number;
  done: number;
  total: number;
  complete: boolean;
}) {
  /*
    The circle's geometry, in SVG user units.

    `r` and the viewBox are chosen together: the stroke is drawn on the centre
    line of the path, so a 2-unit stroke on a 20-unit radius needs 2 units of
    room outside it, which is why the viewBox is 4 units larger than the
    diameter.
  */
  const radius = 26;
  const stroke = 3.5;
  const circumference = 2 * Math.PI * radius;

  /* Clamped, because a percentage outside 0–100 would draw a negative length of
     dash and the ring would run backwards. */
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference * (1 - clamped / 100);

  const label = complete
    ? "Everything uploaded"
    : `${done} of ${total} uploads and their captions done`;

  return (
    <div className="dash-ring" data-complete={String(complete)}>
      <div
        className="dash-ring__dial"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        title={label}
      >
        <svg className="dash-ring__svg" viewBox="0 0 60 60" aria-hidden="true">
          {/* The track: where the fill will be, so the ring reads as a dial
              rather than as a shape floating in space. */}
          <circle
            className="dash-ring__track"
            cx="30"
            cy="30"
            r={radius}
            fill="none"
            strokeWidth={stroke}
          />
          <circle
            className="dash-ring__fill"
            cx="30"
            cy="30"
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            /* Start at twelve o'clock rather than at three. */
            transform="rotate(-90 30 30)"
          />
        </svg>

        <span className="dash-ring__value">
          {clamped}
          <span className="dash-ring__unit">%</span>
        </span>
      </div>
    </div>
  );
}
