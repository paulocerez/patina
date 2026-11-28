/**
 * Small, deterministic text matching for user prompts (German and English): does a prompt
 * name a label? Used to scope answers and to catch refusals of things the manifest allows.
 * No model, no dictionary: case folding, umlaut folding and a light suffix stem.
 */

/** Lowercase, fold umlauts and ß, turn everything but letters and digits into spaces. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/([a-z])([0-9])/g, "$1 $2")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Splits camelCase and snake_case identifiers into words ("defaultDateRange" → "default date range"). */
export function identifierWords(id: string): string {
  return id
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_.-]+/g, " ")
    .toLowerCase();
}

// German and English inflection endings, longest first. Only stripped from longer words, so
// short words ("tag", "neu") stay distinct.
const SUFFIXES = ["ern", "en", "er", "es", "e", "n", "s"];

/** A word's stem: "anrufen" → "anruf", "letzten" → "letzt", "columns" → "column". */
export function stem(word: string): string {
  if (word.length < 4) return word;
  for (const s of SUFFIXES)
    if (word.length - s.length >= 3 && word.endsWith(s)) return word.slice(0, -s.length);
  return word;
}

function tokens(s: string): string[] {
  return normalizeText(s).split(" ").filter(Boolean).map(stem);
}

/**
 * Whether `text` names `phrase`: every word of the phrase appears, in order and next to each
 * other, after stemming. Compound words count when the phrase is one word of at least five
 * letters ("Anrufzusammenfassung" names "Zusammenfassung").
 */
export function mentions(text: string, phrase: string): boolean {
  const p = tokens(phrase);
  if (p.length === 0) return false;
  const t = tokens(text);
  for (let i = 0; i + p.length <= t.length; i++) if (p.every((w, j) => t[i + j] === w)) return true;
  if (p.length === 1 && (p[0] as string).length >= 5) {
    const w = p[0] as string;
    return t.some((x) => x.length > w.length && (x.endsWith(w) || x.startsWith(w)));
  }
  return false;
}

/** The first of `phrases` that `text` names, or null. */
export function mentionsAny(text: string, phrases: readonly (string | undefined)[]): string | null {
  for (const p of phrases) if (p && mentions(text, p)) return p;
  return null;
}
