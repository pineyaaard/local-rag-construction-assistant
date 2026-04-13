/**
 * Serbian language utilities for text normalization.
 *
 * Many older construction documents were typed without diacritics
 * (e.g. "gradjevinska" instead of "građevinska"). We need to handle
 * both variants so that vector search works regardless of the source
 * document's encoding.
 */

// Latin diacritics → ASCII mapping (Serbian specific)
const DIACRITICS_MAP: Record<string, string> = {
  č: "c",  ć: "c",  đ: "dj",  š: "s",  ž: "z",
  Č: "C",  Ć: "C",  Đ: "Dj",  Š: "S",  Ž: "Z",
};

// ASCII → possible diacritics (reverse mapping for query expansion)
const ASCII_TO_DIACRITICS: Record<string, string[]> = {
  c:  ["č", "ć"],
  dj: ["đ"],
  s:  ["š"],
  z:  ["ž"],
};

/**
 * Strip Serbian diacritics to ASCII.
 * Useful for normalizing queries and document text before comparison.
 */
export function stripDiacritics(text: string): string {
  return text.replace(/[čćđšžČĆĐŠŽ]/g, (match) => DIACRITICS_MAP[match] || match);
}

/**
 * Normalize text for embedding: lowercase, strip diacritics, collapse whitespace.
 * We store both the original and normalized version in metadata
 * so we can display the original but search on normalized text.
 */
export function normalizeForEmbedding(text: string): string {
  let normalized = text.toLowerCase();
  normalized = stripDiacritics(normalized);
  normalized = normalized.replace(/\s+/g, " ").trim();
  return normalized;
}

/**
 * Expand a query to include both diacritic and non-diacritic variants.
 * Example: "gradjevinska dozvola" → also matches "građevinska dozvola"
 *
 * NOTE: This is a simple heuristic. For production, consider a proper
 * Serbian morphological analyzer (e.g., via hunspell sr_RS dictionary).
 */
export function expandQueryVariants(query: string): string[] {
  const variants = new Set<string>();
  variants.add(query);
  variants.add(stripDiacritics(query));

  // If the query is already ASCII, try adding diacritics back
  // This is imprecise but catches common construction terms
  const CONSTRUCTION_TERMS: Record<string, string> = {
    gradjevinska: "građevinska",
    gradevinska:  "građevinska",
    bezbednost:   "bezbednost",   // same — no diacritics needed
    zastita:      "zaštita",
    cena:         "cena",
    sluzbeni:     "službeni",
    dozvola:      "dozvola",
    izvodjac:     "izvođač",
    izvodjenje:   "izvođenje",
    predracun:    "predračun",
    tehnicka:     "tehnička",
    radovi:       "radovi",
  };

  const words = query.toLowerCase().split(/\s+/);
  const expanded = words.map((w) => CONSTRUCTION_TERMS[w] || w);
  variants.add(expanded.join(" "));

  return Array.from(variants);
}

/**
 * Detect if text is primarily Serbian (Latin or Cyrillic).
 * Used to set the correct system prompt language for Llama 3.
 */
export function detectSerbianScript(
  text: string
): "latin" | "cyrillic" | "unknown" {
  const cyrillicPattern = /[\u0400-\u04FF]/;
  const latinSerbian = /[čćđšžČĆĐŠŽ]/;

  if (cyrillicPattern.test(text)) return "cyrillic";
  if (latinSerbian.test(text)) return "latin";

  // Heuristic: check for common Serbian Latin words without diacritics
  const serbianIndicators = /\b(je|su|za|na|od|ili|koji|koja|koje|ovaj|ovim)\b/i;
  if (serbianIndicators.test(text)) return "latin";

  return "unknown";
}
