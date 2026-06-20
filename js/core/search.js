// ---------------------------------------------------------
// Hybrid ranked search.
// Tokenizes both query and target, then scores by match type:
//   exact token > prefix > edit-distance typo > subsequence.
// Security: the query is used only for string comparison and
// is never interpolated into HTML.
// ---------------------------------------------------------

/** Split a string into lowercase word tokens. */
function tokenize(str) {
  return str.toLowerCase().split(/[\s\-_]+/).filter(Boolean);
}

/**
 * Levenshtein edit distance (bounded). Returns Infinity when the
 * distance exceeds `max`, avoiding unnecessary work.
 */
function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Maximum edit distance allowed for a given word length. */
function maxTypos(len) {
  if (len <= 2) return 0;   // no typo tolerance for very short tokens
  if (len <= 5) return 1;
  return 2;
}

/**
 * Score a single query token against a single target token.
 * Returns 0 when there is no meaningful match.
 */
function tokenScore(qTok, tTok) {
  if (qTok === tTok) return 100;                        // exact
  if (tTok.startsWith(qTok)) return 75 + qTok.length;  // prefix
  if (tTok.includes(qTok)) return 50 + qTok.length;    // substring

  // Edit-distance typo tolerance
  const allowed = maxTypos(qTok.length);
  if (allowed > 0) {
    const dist = editDistance(qTok, tTok, allowed);
    if (dist <= allowed) return 30 - dist * 10;         // typo (30 or 20)
  }

  return 0;
}

/**
 * Score a full query against a target string.
 * Every query token must match at least one target token; if any
 * token fails to match the result is null (no match).
 *
 * @param {string} query - User search input.
 * @param {string} target - Text to match against.
 * @returns {number|null} Positive score if all tokens match, else null.
 */
export function scoreText(query, target) {
  if (!query || !target) return null;

  const qTokens = tokenize(query);
  const tTokens = tokenize(target);
  if (!qTokens.length || !tTokens.length) return null;

  let total = 0;

  for (const qTok of qTokens) {
    let best = 0;
    for (const tTok of tTokens) {
      const s = tokenScore(qTok, tTok);
      if (s > best) best = s;
    }
    if (best === 0) return null;   // unmatched query token → no match
    total += best;
  }

  return total;
}

/** Field weight multipliers. */
const WEIGHT_TITLE = 3;
const WEIGHT_TAG   = 1;

/**
 * Score a card against a search query using weighted field matching.
 * @param {string} query
 * @param {{ title: string, tag?: string }} card
 * @returns {number|null} Composite score, or null if no field matches.
 */
export function scoreCard(query, card) {
  const titleScore = scoreText(query, card.title);
  const tagScore   = scoreText(query, card.tag || "");

  const t = (titleScore ?? 0) * WEIGHT_TITLE;
  const g = (tagScore   ?? 0) * WEIGHT_TAG;

  const best = Math.max(t, g);
  return best > 0 ? best : null;
}
