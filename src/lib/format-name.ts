// ---------------------------------------------------------------------------
// OKrunit -- User Name Formatter
// ---------------------------------------------------------------------------
// Normalizes a person's display name so the first letter of each word is
// capitalized and the rest are lowercase: "nathaniel STODDARD" -> "Nathaniel
// Stoddard". Word boundaries include whitespace, apostrophes (o'brien ->
// O'Brien), and hyphens (anne-marie -> Anne-Marie).
//
// This is purely a display helper. Avoid applying to emails or IDs - those
// are pass-through in resolveDisplayLabel callers and should stay as-is.
// ---------------------------------------------------------------------------

/**
 * Title-cases a person's name. Returns the input unchanged when it is null,
 * undefined, or blank so callers can safely chain fallbacks.
 */
export function titleCaseName<T extends string | null | undefined>(name: T): T {
  if (name == null) return name;
  const trimmed = name.toString().trim();
  if (!trimmed) return name;
  return trimmed
    .toLowerCase()
    .replace(/(^|[\s'\-])(\w)/g, (_match, boundary: string, letter: string) =>
      boundary + letter.toUpperCase(),
    ) as T;
}
