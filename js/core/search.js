// ---------------------------------------------------------
// Fuzzy search.
// Security: the query is used only for character-level string
// comparison and is never interpolated into HTML.
// ---------------------------------------------------------

/**
 * Compute a fuzzy match score of `query` against `target`.
 * @param {string} query - Search string (lowercased internally).
 * @param {string} target - Text to match against.
 * @returns {number|null} Positive score (higher = better), or null if no match.
 */
export function fuzzyScore(query, target) {
  if (!query || !target) return null;

  const q = query.toLowerCase();
  const t = target.toLowerCase();

  if (q === t) return 10000;
  if (t.startsWith(q)) return 5000 + q.length;
  if (t.includes(q)) return 3000 + q.length;

  // Subsequence matching with weighted scoring
  let qi = 0;
  let score = 0;
  let consecutive = 0;
  let prevIdx = -2;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++;
      if (prevIdx === ti - 1) {
        consecutive++;
        score += consecutive * 3;
      } else {
        consecutive = 0;
        score += 1;
      }
      // Bonus for word-boundary matches
      if (ti === 0 || t[ti - 1] === " " || t[ti - 1] === "-" || t[ti - 1] === "_") {
        score += 5;
      }
      prevIdx = ti;
    }
  }

  return qi === q.length ? score : null;
}
