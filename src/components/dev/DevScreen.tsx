import { useMemo, useState } from "react";

import { siteOutline, visibleBlocks } from "../../lib/site/derive";
import { SEED_SLUG, defaultSite, emptySite } from "../../lib/site/default";
import { resolveTheme, themeIds, themes } from "../../lib/site/themes";

/**
 * TEMPORARY — Step 2 dev screens. Deleted in Step 3.
 *
 * Three things Step 2 built are hard to check from the site itself, because the
 * site only ever shows one theme and one config:
 *
 *   themes  — all five presets side by side, to eyeball contrast
 *   blocks  — one config per visibility combination, to prove empty regions
 *             really are suppressed
 *   outline — what the dashboard will show its author
 */

const SCREENS = [
  { kind: "themes", label: "Themes" },
  { kind: "blocks", label: "Visibility" },
  { kind: "outline", label: "Outline" },
] as const;

export default function DevScreen({ kind }: { kind: (typeof SCREENS)[number]["kind"] }) {
  return (
    <div className="dev-screen">
      <p className="dev-eyebrow">Step 2 · dev</p>
      <h1 className="dev-title">{SCREENS.find((s) => s.kind === kind)?.label}</h1>

      <nav className="dev-nav">
        {SCREENS.map((s) => (
          <a key={s.kind} href={`/dev/${s.kind}`}>
            {s.label}
          </a>
        ))}
        <a href={`/s/${SEED_SLUG}`}>Home</a>
        <a href={`/s/${SEED_SLUG}/gallery`}>Gallery</a>
      </nav>

      {kind === "themes" && <Themes />}
      {kind === "blocks" && <Blocks />}
      {kind === "outline" && <Outline />}
    </div>
  );
}

function Themes() {
  const [active, setActive] = useState<string>(defaultSite().theme);
  const theme = resolveTheme(active);
  const keys = Object.keys(theme.tokens);

  return (
    <>
      <p className="dev-note">
        Every preset declares the same {keys.length} keys, produced by one{" "}
        <code>buildTokens</code> function — so a missing colour is a compile error rather
        than a visual bug. Palette swatches first, then every token including gradients.
      </p>

      <div className="dev-grid">
        {themeIds.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setActive(id)}
            className="dev-card text-left"
            data-theme={id}
            style={themes[id].tokens}
            aria-pressed={active === id}
          >
            <h2>{themes[id].label}</h2>
            <p>{id}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {Object.entries(themes[id].palette).map(([name, value]) => (
                <span
                  key={name}
                  title={`${name} ${value}`}
                  style={{ background: value }}
                  className="dev-swatch !h-6 !mt-0 !rounded"
                />
              ))}
            </div>
          </button>
        ))}
      </div>

      <div className="dev-card mt-8" data-theme={active} style={theme.tokens}>
        <h2>{theme.label} — all tokens</h2>
        {keys.map((key) => (
          <div key={key} className="dev-token">
            <span>{key.replace("--theme-", "")}</span>
            <span>{theme.tokens[key]}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function Blocks() {
  const base = defaultSite();
  /** All quote fields at their schema defaults — nothing filled in. */
  const emptyQuote = () => emptySite("x").home.quote;

  const cases: { label: string; mutate: (s: typeof base) => void }[] = [
    { label: "Seeded site", mutate: () => {} },
    { label: "Quote letter cleared", mutate: (s) => void (s.home.quote.truth = "") },
    // A genuinely empty quote, not the seeded one — assigning `base.home.quote`
    // here would silently restore the content and hide the real behaviour.
    { label: "Whole quote cleared", mutate: (s) => void (s.home.quote = emptyQuote()) },
    {
      label: "Closing section cleared",
      mutate: (s) => {
        s.home.footer.heading = "";
        s.home.footer.subline = "";
      },
    },
    { label: "All moments removed", mutate: (s) => void (s.home.moments = []) },
    {
      label: "Second chapter emptied",
      mutate: (s) => {
        s.gallery.chapters[1].films = [];
        s.gallery.chapters[1].stills = [];
      },
    },
  ];

  return (
    <>
      <p className="dev-note">
        Each row is a separate config. <strong>false</strong> means the region will not
        render at all — that is the point: an author who skips the quote letter gets a
        shorter page, not an empty panel with a button that opens onto nothing.
      </p>

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-widest text-lavender">
            <th className="py-2">Region</th>
            {cases.map((c) => (
              <th key={c.label} className="py-2">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(Object.keys(visibleBlocks(base)) as (keyof ReturnType<typeof visibleBlocks>)[]).map(
            (region) => (
              <tr key={region} className="border-t border-lavender/15">
                <td className="py-1.5 font-mono">{region}</td>
                {cases.map((c) => {
                  const site = structuredClone(base);
                  c.mutate(site);
                  const on = visibleBlocks(site)[region];
                  return (
                    <td key={c.label} className="py-1.5">
                      <span style={{ color: on ? "var(--theme-gold-bright)" : "var(--theme-lavender)" }}>
                        {String(on)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ),
          )}
        </tbody>
      </table>
    </>
  );
}

function Outline() {
  const [stripped, setStripped] = useState(false);

  // Same config either way — this only exists to show the outline reacting.
  const site = useMemo(() => {
    const s = defaultSite();
    if (stripped) {
      s.home.quote.truth = "";
      s.gallery.chapters[1].films = [];
      s.gallery.chapters[1].stills = [];
    }
    return s;
  }, [stripped]);

  return (
    <>
      <p className="dev-note">
        This is what the dashboard will show beside the form, so its author can see what will
        actually appear and watch a section grey out as they clear it. Dashed rows will not
        render.
      </p>

      <button type="button" className="dev-nav" onClick={() => setStripped((b) => !b)}>
        <span
          className="rounded-full px-4 py-2 text-sm font-semibold"
          style={{ background: "var(--theme-grad-gold-btn)", color: "var(--theme-on-gold)" }}
        >
          {stripped ? "Restore the letter and chapter 2" : "Clear the letter and chapter 2"}
        </span>
      </button>

      <div className="outline">
        {siteOutline(site).map((entry, i) => (
          <div key={entry.path ?? i} className="outline-row" data-shown={String(entry.shown)}>
            <span className="outline-dot" />
            <span className="outline-label">{entry.label}</span>
            {entry.detail && <span className="outline-detail">{entry.detail}</span>}
            {entry.advanced && <span className="outline-badge">advanced</span>}
          </div>
        ))}
      </div>
    </>
  );
}