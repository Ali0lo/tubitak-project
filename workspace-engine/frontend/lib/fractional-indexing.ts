/**
 * Client-side fractional indexing for O(1) drag-and-drop reordering.
 * Uses Base-62 character set: 0-9, A-Z, a-z.
 */

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE_LEN = BASE62.length;
const CHAR_TO_INT: Record<string, number> = {};
for (let i = 0; i < BASE_LEN; i++) {
  CHAR_TO_INT[BASE62[i]] = i;
}

const MID_CHAR = BASE62[Math.floor(BASE_LEN / 2)]; // 'V'
const MIN_CHAR = BASE62[0]; // '0'

export function generateFractionalIndex(
  before?: string | null,
  after?: string | null
): string {
  if (!before && !after) {
    return "a0";
  }

  // Prepend before lowest item
  if (!before) {
    return decrementKey(after!);
  }

  // Append after highest item
  if (!after) {
    return incrementKey(before);
  }

  // Insert between before and after
  if (before >= after) {
    throw new Error(
      `Constraint violated: before (${before}) must be < after (${after})`
    );
  }

  return midpoint(before, after);
}

function midpoint(a: string, b: string): string {
  let commonLen = 0;
  const minLen = Math.min(a.length, b.length);

  while (commonLen < minLen && a[commonLen] === b[commonLen]) {
    commonLen++;
  }

  const prefix = a.slice(0, commonLen);
  const charA = commonLen < a.length ? a[commonLen] : MIN_CHAR;
  const charB = commonLen < b.length ? b[commonLen] : null;

  const valA = CHAR_TO_INT[charA] ?? 0;
  const valB = charB !== null ? CHAR_TO_INT[charB] : BASE_LEN;

  if (valB - valA > 1) {
    const midVal = Math.floor((valA + valB) / 2);
    return prefix + BASE62[midVal];
  }

  if (commonLen < a.length) {
    const remainderA = a.slice(commonLen + 1);
    const suffix = remainderA ? incrementKey(remainderA) : MID_CHAR;
    return a.slice(0, commonLen + 1) + suffix;
  }

  return a + MID_CHAR;
}

function incrementKey(key: string): string {
  if (!key) return "a0";

  const chars = key.split("");
  const lastVal = CHAR_TO_INT[chars[chars.length - 1]];
  if (lastVal < BASE_LEN - 1) {
    chars[chars.length - 1] = BASE62[lastVal + 1];
    return chars.join("");
  }

  return key + MID_CHAR;
}

function decrementKey(key: string): string {
  if (!key) return "0";

  const chars = key.split("");
  const firstVal = CHAR_TO_INT[chars[0]];
  if (firstVal > 0) {
    chars[0] = BASE62[firstVal - 1];
    return chars.join("");
  }

  return "0" + MID_CHAR + key;
}

export function rebalanceIndices(count: number, prefix: string = "a"): string[] {
  if (count <= 0) return [];

  const indices: string[] = [];
  const step = Math.max(1, Math.floor((BASE_LEN - 1) / Math.max(1, count)));

  for (let i = 0; i < count; i++) {
    const idx = Math.min(i * step, BASE_LEN - 1);
    indices.push(`${prefix}${BASE62[idx]}`);
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (let i = 0; i < indices.length; i++) {
    let current = indices[i];
    let counter = 0;
    while (seen.has(current)) {
      counter++;
      current = `${indices[i]}${BASE62[counter % BASE_LEN]}`;
    }
    seen.add(current);
    result.push(current);
  }

  return result.sort();
}
