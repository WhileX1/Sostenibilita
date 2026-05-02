// Syntax highlighting tokenizer. Distinct from `tokenize.ts` because the
// editor's overlay needs a segment for *every character* including
// whitespace, while the parser tokenizer skips whitespace silently.
//
// Emits a flat array of `Segment` covering the whole source so the editor
// can render `<span>` per segment and stay character-aligned with the
// textarea on top.

export type SegmentKind =
  // Symbols and word-keywords that act as operators.
  // `=`, `!=`, `+`, `-`, `*`, `/`, `%`, `<`, `>`, `IF`, `ELSE`, `END`,
  // `AND`, `OR` — all colored as one class because the user's mental
  // model treats them as a single category.
  | "operator"
  // Built-in function names (min, max, sqrt, ...) called like `min(a, b)`.
  | "builtin"
  // Boolean literal word forms (TRUE, FALSE).
  | "literal"
  // Numeric literal.
  | "number"
  // String literal — includes the surrounding quotes for visual cohesion.
  | "string"
  // Identifier matching one of the metric's defined input names.
  | "input"
  // Identifier assigned somewhere in the script (computed variable). The
  // target of an assignment AND every later reference to it both get
  // this kind.
  | "computed"
  // The conventional `score` output. Coloured separately from other
  // computed variables so the user can see at a glance where the
  // formula's exit point is.
  | "score"
  // Identifier that is neither input nor computed — a typo, or a
  // forward reference. Colored neutrally so the live evaluator's
  // "undefined variable" error is the authoritative signal, not the
  // highlighter's coloring.
  | "unknown"
  // Parens, commas — visible structure but no semantic color.
  | "punct"
  // Whitespace and unrecognised characters — renders without any color
  // override (default text color).
  | "plain";

export interface Segment {
  kind: SegmentKind;
  text: string;
}

const KEYWORDS: ReadonlySet<string> = new Set([
  "if",
  "else",
  "end",
  "and",
  "or",
]);

const LITERALS: ReadonlySet<string> = new Set(["true", "false"]);

const BUILTINS: ReadonlySet<string> = new Set([
  "min",
  "max",
  "sqrt",
  "abs",
  "floor",
  "ceil",
  "round",
]);

const SINGLE_OPERATOR_CHARS: ReadonlySet<string> = new Set([
  "+",
  "-",
  "*",
  "/",
  "%",
  "=",
  "<",
  ">",
  // `!` on its own is a parse error, but the highlighter colours it as
  // an operator anyway so the user sees the character they typed
  // standing out — the live evaluator's error tells them what to fix.
  "!",
]);

const PUNCT_CHARS: ReadonlySet<string> = new Set(["(", ")", ","]);

// Collect every name that appears on the left-hand side of an `=` at the
// start of a line — these are the user's computed variables. We do this
// with a per-line regex rather than the parser tokenizer because the
// source may not parse (the user is mid-typing) and we still want the
// highlighter to colour assignments correctly while it's broken.
//
// `score` is included like any other assignment target — it's just the
// conventionally-named output variable.
export function collectAssignmentTargets(src: string): Set<string> {
  const out = new Set<string>();
  for (const line of src.split("\n")) {
    const m = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=/.exec(line);
    if (m) {
      const name = m[1];
      const lower = name.toLowerCase();
      // Don't promote a keyword that happens to look like an
      // identifier-shaped left side (e.g. `IF =` would be a syntax
      // error, but the regex matches it).
      if (
        !KEYWORDS.has(lower) &&
        !LITERALS.has(lower) &&
        !BUILTINS.has(lower)
      ) {
        out.add(name);
      }
    }
  }
  return out;
}

export function highlight(
  src: string,
  inputNames: ReadonlySet<string>,
  computedNames: ReadonlySet<string>,
): Segment[] {
  const segments: Segment[] = [];
  let i = 0;
  // Buffer "plain" runs so we don't emit a separate Segment per
  // whitespace character — the renderer would create thousands of
  // <span>s for a single screenful of code otherwise.
  let plainStart = -1;
  const flushPlain = (end: number) => {
    if (plainStart >= 0 && end > plainStart) {
      segments.push({ kind: "plain", text: src.slice(plainStart, end) });
    }
    plainStart = -1;
  };

  while (i < src.length) {
    const ch = src[i];

    if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
      if (plainStart < 0) plainStart = i;
      i++;
      continue;
    }

    if (isDigit(ch) || (ch === "." && i + 1 < src.length && isDigit(src[i + 1]))) {
      flushPlain(i);
      const start = i;
      while (i < src.length && isDigit(src[i])) i++;
      if (src[i] === "." && i + 1 < src.length && isDigit(src[i + 1])) {
        i++;
        while (i < src.length && isDigit(src[i])) i++;
      }
      segments.push({ kind: "number", text: src.slice(start, i) });
      continue;
    }

    if (ch === '"' || ch === "'") {
      flushPlain(i);
      const start = i;
      const quote = ch;
      i++; // skip open quote
      while (i < src.length && src[i] !== quote && src[i] !== "\n") i++;
      if (src[i] === quote) i++; // include closing quote in the segment
      segments.push({ kind: "string", text: src.slice(start, i) });
      continue;
    }

    if (isIdentStart(ch)) {
      flushPlain(i);
      const start = i;
      while (i < src.length && isIdentCont(src[i])) i++;
      const text = src.slice(start, i);
      const lower = text.toLowerCase();
      let kind: SegmentKind;
      if (KEYWORDS.has(lower)) kind = "operator";
      else if (LITERALS.has(lower)) kind = "literal";
      else if (BUILTINS.has(lower)) kind = "builtin";
      // `score` always wins over the input/computed classification —
      // even if the user names an input "score" (which the validator
      // shouldn't allow but defensive anyway) the conventional output
      // colour stays consistent.
      else if (text === "score") kind = "score";
      else if (inputNames.has(text)) kind = "input";
      else if (computedNames.has(text)) kind = "computed";
      else kind = "unknown";
      segments.push({ kind, text });
      continue;
    }

    // Two-char operators must be checked before single-char ones —
    // otherwise `!=` would render as two separate `!` and `=` segments.
    if (ch === "!" && src[i + 1] === "=") {
      flushPlain(i);
      segments.push({ kind: "operator", text: "!=" });
      i += 2;
      continue;
    }

    if (SINGLE_OPERATOR_CHARS.has(ch)) {
      flushPlain(i);
      segments.push({ kind: "operator", text: ch });
      i++;
      continue;
    }

    if (PUNCT_CHARS.has(ch)) {
      flushPlain(i);
      segments.push({ kind: "punct", text: ch });
      i++;
      continue;
    }

    // Anything else (e.g. an unsupported character the user typed) — drop
    // into the plain buffer and let it render uncoloured. The live
    // evaluator's parse error will tell them what went wrong.
    if (plainStart < 0) plainStart = i;
    i++;
  }

  flushPlain(i);
  return segments;
}

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function isIdentStart(ch: string): boolean {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
}

function isIdentCont(ch: string): boolean {
  return isIdentStart(ch) || isDigit(ch);
}
