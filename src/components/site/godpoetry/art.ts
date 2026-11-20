/**
 * The two generated landscapes the God Poetry design ships with.
 *
 * They stand in when a photograph has not been uploaded yet, and behind the
 * cover and poem spread when the shared `home.moments` list has no usable
 * image. Kept in the template's own folder rather than exported from the page
 * component so the page file stays a components-only module, and so the gallery
 * can use the same art without importing the whole blessing.
 */
export const FALLBACK_ART = [
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 900 1100'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop stop-color='%231f3740'/%3E%3Cstop offset='.5' stop-color='%2387a08d'/%3E%3Cstop offset='1' stop-color='%23d7b886'/%3E%3C/linearGradient%3E%3Cfilter id='b'%3E%3CfeGaussianBlur stdDeviation='28'/%3E%3C/filter%3E%3C/defs%3E%3Crect width='900' height='1100' fill='url(%23g)'/%3E%3Ccircle cx='690' cy='230' r='180' fill='%23fff5c7' opacity='.65' filter='url(%23b)'/%3E%3Cpath d='M0 800Q160 620 340 760T900 650V1100H0Z' fill='%231e3a3c' opacity='.7'/%3E%3Cpath d='M160 1050Q310 700 470 770T760 1060' fill='none' stroke='%23e5c778' stroke-width='3' opacity='.8'/%3E%3C/svg%3E",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 750'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='1' x2='1' y2='0'%3E%3Cstop stop-color='%23e4cba4'/%3E%3Cstop offset='.48' stop-color='%23d6b7a4'/%3E%3Cstop offset='1' stop-color='%235b7580'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='1000' height='750' fill='url(%23g)'/%3E%3Cpath d='M0 590Q220 380 450 560T1000 470V750H0Z' fill='%23233c42' opacity='.78'/%3E%3Ccircle cx='160' cy='130' r='100' fill='%23fff4cc' opacity='.5'/%3E%3Cpath d='M630 140v390M560 240h140' stroke='%23f8e2a8' stroke-width='3' opacity='.55'/%3E%3C/svg%3E",
] as const;
