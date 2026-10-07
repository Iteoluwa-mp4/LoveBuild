/**
 * Small display helpers.
 *
 * Separate from `primitives.tsx` because that file holds only React components —
 * mixing plain functions in breaks fast refresh.
 */

/** "1 film" / "2 films". */
export function countLabel(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}