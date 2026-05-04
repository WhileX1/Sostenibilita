// Public API for the formula DSL. The editor UI and the metric runner both
// import from here; everything else (tokenize / parse / evaluate / suggest)
// is an implementation detail.

import { tokenize } from "./tokenize";
import { parse } from "./parse";
import { evaluate } from "./evaluate";
import type { Program, Result, Value } from "./types";
import type { EvalResult } from "./evaluate";

export type {
  FormulaError,
  Position,
  Program,
  Result,
  Value,
} from "./types";
export type { EvalResult } from "./evaluate";

export { getIdentifierAt, filterSuggestions } from "./suggest";
export { highlight, collectAssignmentTargets } from "./highlight";
export type { Segment, SegmentKind } from "./highlight";
export { extractScoreVars, extractScoreVarsFromText } from "./scoreVars";
export type { ScoreVar } from "./scoreVars";

// Compile a script source to an AST. The editor calls this on every keystroke
// (cheap — the input fits in a textarea, the parser is non-allocating beyond
// the AST itself) so it can show parse errors live as the user types.
export function compile(src: string): Result<Program> {
  const t = tokenize(src);
  if (!t.ok) return t;
  return parse(t.value);
}

// Compile + run in one shot. Useful for tests and for the runner that the
// "Rating ESG" aggregator will use; the editor uses `compile` then a
// separate `evaluate` so it can re-run the same AST against changing input
// values without re-parsing.
export function run(
  src: string,
  inputs: Record<string, Value>,
): Result<EvalResult> {
  const compiled = compile(src);
  if (!compiled.ok) return compiled;
  return evaluate(compiled.value, inputs);
}

export { evaluate };

// Names the autocomplete popover offers in addition to the user's own input
// variables. Listed here — not derived from the tokenizer / evaluator
// internals — so the UI can present them in a stable order without coupling
// to those modules' internal representation.
export const BUILTIN_FUNCTIONS: readonly string[] = [
  "min",
  "max",
  "sqrt",
  "abs",
  "floor",
  "ceil",
  "round",
];

export const KEYWORDS: readonly string[] = [
  "IF",
  "ELSE",
  "END",
  "AND",
  "OR",
  "TRUE",
  "FALSE",
];

// Names the user is not allowed to give to inputs (because they'd shadow a
// keyword or built-in). The input-editor UI uses this to validate names
// before adding a new input. Comparison is case-insensitive on the user
// side, so we lowercase here for the membership check.
export const RESERVED_NAMES: ReadonlySet<string> = new Set(
  [...BUILTIN_FUNCTIONS, ...KEYWORDS].map((s) => s.toLowerCase()),
);
