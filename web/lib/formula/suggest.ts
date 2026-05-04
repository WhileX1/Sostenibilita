// Autocomplete support — kept in the library so the editor UI doesn't have
// to re-parse identifier boundaries itself. The popover only needs to know
// "what is the user typing right now" and "where in the source does it sit".

export interface IdentifierAtCaret {
  // The text from the start of the identifier up to the caret. Empty when
  // the caret isn't inside an identifier (after an operator, in whitespace,
  // inside a string literal, etc.).
  prefix: string;
  // Source offsets of the full identifier under the caret. The UI uses
  // these to replace the prefix with a chosen suggestion: the suggestion
  // overwrites [start, end) and the caret moves to start + suggestion.length.
  start: number;
  end: number;
}

export function getIdentifierAt(src: string, caret: number): IdentifierAtCaret {
  // Walk left from the caret while the previous character could continue an
  // identifier. The first character of an identifier can't be a digit, so
  // we stop one short if `start` would land on a digit-leading "identifier"
  // (which is really a number literal — not autocompleteable).
  let start = caret;
  while (start > 0 && isIdentCont(src.charAt(start - 1))) start--;
  if (start < src.length && isDigit(src.charAt(start))) {
    // Caret sits inside a numeric literal, not an identifier.
    return { prefix: "", start: caret, end: caret };
  }
  let end = caret;
  while (end < src.length && isIdentCont(src.charAt(end))) end++;
  return { prefix: src.slice(start, caret), start, end };
}

// Filter a list of candidates against a prefix using case-insensitive
// `startsWith`. Keyword and built-in suggestions are always uppercase /
// lowercase respectively, so case-insensitive matching lets the user keep
// typing in whatever case they prefer.
export function filterSuggestions(
  candidates: readonly string[],
  prefix: string,
): string[] {
  if (prefix.length === 0) return candidates.slice();
  const p = prefix.toLowerCase();
  return candidates.filter((c) => c.toLowerCase().startsWith(p));
}

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function isIdentCont(ch: string): boolean {
  return (
    (ch >= "a" && ch <= "z") ||
    (ch >= "A" && ch <= "Z") ||
    isDigit(ch) ||
    ch === "_"
  );
}
