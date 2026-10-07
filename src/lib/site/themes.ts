/**
 * Theme presets.
 *
 * A preset is data, not CSS. Switching themes swaps these values on a single
 * element and re-renders; there is no stylesheet swap and no rebuild.
 *
 * Every preset declares the same token keys because `buildTokens` is the only
 * thing that produces them — a missing colour is a compile-time error, not a
 * visual bug. `__tests__/site.test.ts` asserts this too.
 *
 * `midnight` is the original palette, taken from the 92 hardcoded values in the
 * source template. The other four are starting points, not finished art —
 * check contrast against `--theme-void` before showing one to anyone.
 */

/* ------------------------------------------------------------------ *
 * PALETTE
 * ------------------------------------------------------------------ */

/**
 * The sixteen colours the design actually uses. Names describe role, so a
 * preset can repoint "gold" at rose or slate without touching any component.
 */
export interface ThemePalette {
  /** Page background. */
  void: string;
  /** Backdrop behind photo frames. */
  cardDeep: string;
  /** Mid background, and glass panel base. */
  ink: string;
  /** Raised background. */
  ink2: string;
  /** Purple accent. */
  purple: string;
  /** Deeper purple, used behind photos. */
  purpleDeep: string;
  /** Violet, top stop of the hero wash. */
  violet: string;
  /** Bright purple highlight. */
  purpleBright: string;
  /** Lavender, secondary text on dark. */
  lavender: string;
  /** Accent. */
  gold: string;
  goldBright: string;
  /** Pale accent, top stop of the quote gradient. */
  goldPale: string;
  goldMid: string;
  goldDeep: string;
  /** Text on an accent-filled surface. */
  onGold: string;
  /** Body text on dark. */
  text: string;
}

/** `#RRGGBB` to `rgba(...)`, so translucency can be derived from a token. */
function rgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export type ThemeTokens = Readonly<Record<string, string>>;

/**
 * Turns a palette into the full token set.
 *
 * Gradients are whole values rather than something assembled from flat tokens:
 * a gradient needs its own stop positions, so piecing it together at the call
 * site would leak layout decisions back into the components.
 */
function buildTokens(p: ThemePalette): ThemeTokens {
  return Object.freeze({
    /* --- flat --- */
    "--theme-void": p.void,
    "--theme-card-deep": p.cardDeep,
    "--theme-ink": p.ink,
    "--theme-ink2": p.ink2,
    "--theme-purple": p.purple,
    "--theme-purple-deep": p.purpleDeep,
    "--theme-violet": p.violet,
    "--theme-purple-bright": p.purpleBright,
    "--theme-lavender": p.lavender,
    "--theme-gold": p.gold,
    "--theme-gold-bright": p.goldBright,
    "--theme-gold-pale": p.goldPale,
    "--theme-gold-mid": p.goldMid,
    "--theme-gold-deep": p.goldDeep,
    "--theme-on-gold": p.onGold,
    "--theme-text": p.text,
    "--theme-dim": rgba(p.text, 0.75),

    /* --- gradients --- */
    "--theme-grad-hero-bg": `radial-gradient(120% 100% at 20% 0%, ${p.violet} 0%, ${p.ink} 50%, ${p.cardDeep} 100%)`,
    "--theme-grad-hero-glow": `radial-gradient(70% 60% at 85% 85%, ${rgba(p.gold, 0.18)}, transparent 70%)`,
    "--theme-grad-title": `linear-gradient(120deg, ${p.goldBright}, ${p.gold}, ${p.lavender})`,
    "--theme-grad-quote-text": `linear-gradient(120deg, ${p.goldBright} 0%, ${p.gold} 45%, ${p.goldPale} 85%)`,
    "--theme-grad-gold-btn": `linear-gradient(155deg, ${p.goldBright} 0%, ${p.gold} 38%, ${p.goldMid} 60%, ${p.goldDeep} 100%)`,
    "--theme-grad-glass": `linear-gradient(155deg, ${rgba(p.purple, 0.55)}, ${rgba(p.ink, 0.75)})`,
    "--theme-grad-card-front": `radial-gradient(120% 100% at 30% 20%, ${p.purpleDeep} 0%, ${p.ink} 70%)`,
    "--theme-grad-card-back": `radial-gradient(120% 100% at 70% 80%, ${p.ink2} 0%, ${p.cardDeep} 100%)`,
    "--theme-grad-shine": `linear-gradient(110deg, transparent 30%, ${rgba(p.goldBright, 0.35)} 50%, transparent 70%)`,
    "--theme-grad-footer": `linear-gradient(180deg, ${rgba(p.cardDeep, 0.96)} 0%, ${p.ink2} 45%, ${p.void} 100%)`,
    "--theme-grad-panel": `linear-gradient(135deg, ${rgba(p.ink, 0.65)} 0%, ${rgba(p.cardDeep, 0.85)} 100%)`,
    "--theme-grad-ring": `linear-gradient(135deg, ${p.goldBright}, ${p.goldDeep})`,

    /* --- scrims: translucent against an unknown photo, so per-theme --- */
    "--theme-scrim-mobile": `linear-gradient(180deg, ${rgba(p.cardDeep, 0.78)} 0%, ${rgba(p.cardDeep, 0.62)} 42%, ${rgba(p.cardDeep, 0.34)} 72%, ${rgba(p.cardDeep, 0.12)} 100%)`,
    "--theme-scrim-card": `linear-gradient(180deg, ${rgba(p.cardDeep, 0.72)} 0%, ${rgba(p.cardDeep, 0.25)} 45%, ${rgba(p.cardDeep, 0.8)} 100%)`,

    /* --- glows and shadows --- */
    "--theme-glow-gold": `0 0 18px ${rgba(p.gold, 0.2)}`,
    "--theme-shadow-btn": `inset 0 1px 0 rgba(255, 255, 255, 0.65), inset 0 -6px 10px ${rgba(p.goldDeep, 0.45)}, 0 10px 24px -8px ${rgba(p.goldDeep, 0.55)}`,
    "--theme-shadow-card": `0 20px 40px -15px ${rgba(p.cardDeep, 0.75)}`,
    "--theme-shadow-panel": `0 30px 70px -20px ${rgba(p.cardDeep, 0.9)}, inset 0 1px 0 ${rgba(p.goldBright, 0.25)}`,
    "--theme-shadow-frame": `0 36px 70px -28px ${rgba(p.cardDeep, 0.95)}`,
  });
}

/* ------------------------------------------------------------------ *
 * PRESETS
 * ------------------------------------------------------------------ */

export interface ThemeFonts {
  display: string;
  sans: string;
}

export interface Theme {
  readonly label: string;
  readonly fonts: ThemeFonts;
  readonly palette: ThemePalette;
  readonly tokens: ThemeTokens;
}

const DISPLAY = '"Playfair Display", Georgia, serif';
const SANS = '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

function theme(label: string, palette: ThemePalette, fonts?: Partial<ThemeFonts>): Theme {
  return Object.freeze({
    label,
    fonts: { display: fonts?.display ?? DISPLAY, sans: fonts?.sans ?? SANS },
    palette,
    tokens: buildTokens(palette),
  });
}

/** The original purple-and-gold palette, verbatim. */
const midnight = theme("Midnight", {
  void: "#150A22",
  cardDeep: "#0E0518",
  ink: "#1F0F33",
  ink2: "#2B1547",
  purple: "#5B2A86",
  purpleDeep: "#4B1F73",
  violet: "#3A1B5C",
  purpleBright: "#8347BE",
  lavender: "#C9A6E8",
  gold: "#D9A94E",
  goldBright: "#F4D98A",
  goldPale: "#FCE7A6",
  goldMid: "#B4842E",
  goldDeep: "#8A6417",
  onGold: "#3A2408",
  text: "#EFE3FA",
});

const rose = theme("Rose", {
  void: "#2A1220",
  cardDeep: "#1B0A14",
  ink: "#3A1A2C",
  ink2: "#4E2340",
  purple: "#8E3A63",
  purpleDeep: "#7A2E53",
  violet: "#5C2444",
  purpleBright: "#C4718F",
  lavender: "#F0B9C9",
  gold: "#E08C9B",
  goldBright: "#F7C6CE",
  goldPale: "#FDE4E8",
  goldMid: "#C56A7C",
  goldDeep: "#8E4457",
  onGold: "#3A1220",
  text: "#FBEEF2",
});

const garden = theme("Garden", {
  void: "#0F1F17",
  cardDeep: "#081510",
  ink: "#163025",
  ink2: "#1E4034",
  purple: "#2F6B4F",
  purpleDeep: "#285C43",
  violet: "#1D4736",
  purpleBright: "#5AA77F",
  lavender: "#BFE0CB",
  gold: "#C9A227",
  goldBright: "#EBD07A",
  goldPale: "#F7EBBF",
  goldMid: "#A8831B",
  goldDeep: "#755B10",
  onGold: "#1B2A10",
  text: "#EDF5EF",
});

const sunset = theme("Sunset", {
  void: "#2B1410",
  cardDeep: "#1A0A08",
  ink: "#3F1D18",
  ink2: "#55291F",
  purple: "#9C4326",
  purpleDeep: "#86381F",
  violet: "#6B2A18",
  purpleBright: "#D9713F",
  lavender: "#F3B48C",
  gold: "#F0813C",
  goldBright: "#FFB067",
  goldPale: "#FFE0BC",
  goldMid: "#C25F26",
  goldDeep: "#8A3F15",
  onGold: "#33130A",
  text: "#FDEEE6",
});

const mono = theme("Mono", {
  void: "#111113",
  cardDeep: "#0A0A0B",
  ink: "#1C1C1F",
  ink2: "#2A2A2E",
  purple: "#4A4A52",
  purpleDeep: "#3D3D44",
  violet: "#333338",
  purpleBright: "#7C7C86",
  lavender: "#C4C4CC",
  gold: "#D4D4D8",
  goldBright: "#F0F0F2",
  goldPale: "#FAFAFB",
  goldMid: "#A1A1AA",
  goldDeep: "#71717A",
  onGold: "#1A1A1C",
  text: "#F4F4F5",
});

export const themes = {
  midnight,
  rose,
  garden,
  sunset,
  mono,
} as const;

export type ThemeId = keyof typeof themes;

export const themeIds = Object.keys(themes) as ThemeId[];

export const defaultThemeId: ThemeId = "midnight";

/**
 * Looks a theme up by id, falling back to the default.
 *
 * Config stores the id as a plain string so that adding a preset can never
 * invalidate a saved config. An unknown id renders as the default rather than
 * throwing and blanking the page.
 */
export function resolveTheme(id: string | undefined | null): Theme {
  if (id && id in themes) return themes[id as ThemeId];
  return themes[defaultThemeId];
}

export function isThemeId(id: string): id is ThemeId {
  return id in themes;
}

/**
 * The `style` prop for a themed element. Every site component roots itself with
 * this, and the tokens cascade from there.
 */
export function themeStyle(id: string | undefined | null): Record<string, string> {
  return { ...resolveTheme(id).tokens };
}