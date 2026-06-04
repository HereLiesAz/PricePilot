/**
 * Cross-vendor product matching (PLAN.md intelligence layer). Heuristics first:
 * exact GTIN/MPN, then normalized-title fuzzy match. The Claude tie-break for
 * ambiguous cases lives in `claude.ts` and is invoked by the caller only when
 * the fuzzy score lands in an uncertain band.
 */

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "with",
  "for",
  "and",
  "of",
  "new",
  "genuine",
  "official",
]);

/** Lowercase, strip punctuation, drop stopwords, collapse whitespace. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length > 0 && !STOPWORDS.has(t))
    .join(" ")
    .trim();
}

function tokens(title: string): Set<string> {
  return new Set(normalizeTitle(title).split(" ").filter(Boolean));
}

/** Sørensen–Dice similarity over title token sets, in [0, 1]. */
export function titleSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const t of ta) if (tb.has(t)) intersection++;
  return (2 * intersection) / (ta.size + tb.size);
}

export interface MatchCandidate {
  title: string;
  gtin?: string | null;
  mpn?: string | null;
}

export interface ExistingProduct {
  id: string;
  normalizedTitle: string;
  gtin?: string | null;
  mpn?: string | null;
}

export interface MatchResult {
  productId: string;
  /** How the match was made — exact identifier or fuzzy title score. */
  by: "gtin" | "mpn" | "title";
  score: number;
}

/** Default similarity at/above which a fuzzy title match is accepted outright. */
export const STRONG_MATCH = 0.8;
/** Below this, no match. Between [WEAK, STRONG) is the Claude tie-break band. */
export const WEAK_MATCH = 0.5;

/**
 * Find the best existing product for a candidate. Exact GTIN then MPN win
 * immediately; otherwise the highest title similarity is returned (the caller
 * decides what to do with scores in the uncertain band).
 */
export function findProductMatch(
  candidate: MatchCandidate,
  existing: ExistingProduct[],
): MatchResult | null {
  if (candidate.gtin) {
    const hit = existing.find((p) => p.gtin && p.gtin === candidate.gtin);
    if (hit) return { productId: hit.id, by: "gtin", score: 1 };
  }
  if (candidate.mpn) {
    const hit = existing.find((p) => p.mpn && p.mpn === candidate.mpn);
    if (hit) return { productId: hit.id, by: "mpn", score: 1 };
  }

  let best: MatchResult | null = null;
  for (const p of existing) {
    const score = titleSimilarity(candidate.title, p.normalizedTitle);
    if (!best || score > best.score) best = { productId: p.id, by: "title", score };
  }
  return best && best.score >= WEAK_MATCH ? best : null;
}
