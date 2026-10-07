/**
 * One place for the product's storage keys and cross-frame message types.
 *
 * Renaming the product meant renaming these too, and scattering the prefix
 * through four files is how half of them get missed. They were the last place
 * still saying "gift-site".
 *
 * Note this invalidates any previously saved draft: localStorage keys changed,
 * so old entries are simply not found. That is fine while the only stored data
 * is a seeded prototype, and it would not be acceptable once a real customer's
 * work is on the server — so the switch has to happen before Step 4b.
 */
export const STORAGE_PREFIX = "lovebuilds:";

/**
 * Message names for the dashboard's preview handshake.
 *
 * `postMessage` has no type-safety at runtime, and the frame checks that an
 * arriving message is one it recognises before reading its payload.
 *
 * Both names live here, not in the two files that use them. An earlier version
 * hardcoded the same string in four places across the pane and the page; renaming
 * the product updated some of them and not others, and the handshake only kept
 * working because the half that was missed still matched the other half. That is
 * exactly the kind of coincidence a single source removes.
 */
export const MESSAGES = `${STORAGE_PREFIX}preview-`;

/** Parent to frame: the config to render. */
export const MSG_PREVIEW_CONFIG = `${MESSAGES}config`;

/** Frame to parent: "I am listening, send the config". */
export const MSG_PREVIEW_READY = `${MESSAGES}ready`;