/**
 * Compares two dotted version strings (e.g. "1.2.10" vs "1.3.0") numerically per segment,
 * not lexicographically — "1.10.0" is greater than "1.2.0". Missing trailing segments are
 * treated as 0, so "1.2" === "1.2.0".
 *
 * Returns negative if a < b, positive if a > b, 0 if equal.
 */
export function compareVersions(a: string, b: string): number {
  const partsA = a.trim().split('.').map((p) => parseInt(p, 10) || 0);
  const partsB = b.trim().split('.').map((p) => parseInt(p, 10) || 0);
  const length = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < length; i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
