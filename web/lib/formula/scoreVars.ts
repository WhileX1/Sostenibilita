// Extract the identifiers referenced inside the RHS of `score = …`,
// each tagged with the sign (+1 / −1) it carries in that expression.
// Used by the metric editor to populate the per-component slider section
// — every variable mentioned in the user's score expression gets a
// slider whose normalized share contributes to the rating.
//
// The sign encodes "direction" (higher-is-better vs. lower-is-better)
// without a dedicated UI toggle: writing `score = a - c` says "more `c`
// drags the rating down". Downstream the score computation inverts the
// normalized value of negative-signed variables (`100 - normalized`) so
// the weighted average stays bounded in 0..100, instead of literally
// subtracting and producing out-of-range numbers.

import { tokenize } from "./tokenize";
import { parse } from "./parse";
import type { Expr, Program, Statement } from "./types";

export interface ScoreVar {
  name: string;
  sign: 1 | -1;
}

// Walk the program looking for Assign statements whose target is `score`.
// Multiple `score = …` assignments are allowed (e.g., one in each IF
// branch) — the *last* one wins at runtime, so we pick that one's RHS as
// the source of slider variables. If no `score = …` exists, the editor
// hides the slider section entirely.
//
// Signs are detected by flattening the RHS as a chain of additions and
// subtractions of direct identifiers (with optional unary `-`). For
// expressions outside that shape — function calls, multiplications,
// percent, comparisons — we fall back to "all variables, sign +1": the
// sign analysis would be ambiguous and the editor's help text tells the
// user to stick to the simple form for the sign-as-direction convention
// to apply.
export function extractScoreVars(program: Program): ScoreVar[] {
  let lastScoreRhs: Expr | null = null;
  visitStatements(program.body, (stmt) => {
    if (stmt.kind === "Assign" && stmt.name === "score") {
      lastScoreRhs = stmt.expr;
    }
  });
  if (!lastScoreRhs) return [];

  const flat = flattenAdditive(lastScoreRhs, 1);
  if (flat) return dedupeFirst(flat);

  // Fallback path: collect every Ident reference, all positive. The
  // user's chosen formula shape doesn't fit the strict ± chain, so we
  // can't pretend to extract direction safely.
  return collectAllPositive(lastScoreRhs);
}

// Try to interpret the expression as a chain of `+ ident` / `− ident`
// terms (with parens and unary `-` allowed). Returns null if any term
// isn't a clean direct identifier — e.g. `2 * a`, `max(a, b)`, `a%`.
function flattenAdditive(e: Expr, sign: 1 | -1): ScoreVar[] | null {
  if (e.kind === "Ident") {
    if (e.name === "score") return null;
    return [{ name: e.name, sign }];
  }
  if (e.kind === "Unary" && e.op === "-") {
    return flattenAdditive(e.operand, flipSign(sign));
  }
  if (e.kind === "Binary" && (e.op === "+" || e.op === "-")) {
    const left = flattenAdditive(e.left, sign);
    if (!left) return null;
    const rightSign = e.op === "+" ? sign : flipSign(sign);
    const right = flattenAdditive(e.right, rightSign);
    if (!right) return null;
    return [...left, ...right];
  }
  return null;
}

function flipSign(s: 1 | -1): 1 | -1 {
  return s === 1 ? -1 : 1;
}

// Preserve first-appearance order; if the same name occurs twice (e.g.
// `score = a + b - a`), keep the first sign — the user's intent is
// ambiguous and the editor's help text covers this case.
function dedupeFirst(vars: ScoreVar[]): ScoreVar[] {
  const seen = new Set<string>();
  const out: ScoreVar[] = [];
  for (const v of vars) {
    if (seen.has(v.name)) continue;
    seen.add(v.name);
    out.push(v);
  }
  return out;
}

function collectAllPositive(e: Expr): ScoreVar[] {
  const seen = new Set<string>();
  const out: ScoreVar[] = [];
  visitExpr(e, (n) => {
    if (n.kind === "Ident" && n.name !== "score" && !seen.has(n.name)) {
      seen.add(n.name);
      out.push({ name: n.name, sign: 1 });
    }
  });
  return out;
}

function visitStatements(stmts: Statement[], f: (s: Statement) => void): void {
  for (const s of stmts) {
    f(s);
    if (s.kind === "If") {
      visitStatements(s.thenBranch, f);
      visitStatements(s.elseBranch, f);
    }
  }
}

// Source-text equivalent of `extractScoreVars` that survives parse
// errors elsewhere in the formula. The metric editor's slider section
// uses this so the slider rows stay visible (and adjustable) while the
// user is mid-edit on an unrelated broken line — without it, a single
// missing `END` or stray operator wipes the sliders and forces the
// user to fix the typo *before* they can keep tuning weights / ranges.
//
// Three-tier fallback:
//
//   1. **Full compile** — best signal. Captures every `score = …`
//      across all branches and picks the last per AST order, like the
//      AST-only path. Signs preserved.
//   2. **Line-isolated compile** — when the whole formula won't parse,
//      we still typically have a clean `score = …` line. Tokenize and
//      parse just that line; if it succeeds, run the same AST analysis
//      on the one-statement program. Signs preserved.
//   3. **Regex fallback** — when even the score line is in flight
//      (e.g. user just typed `score = a +`), pull every identifier-
//      shaped token out of the RHS, dedupe, drop reserved names. Signs
//      can't be inferred without a parse, so everything reads as `+1`;
//      the user gets the variable list they expect with a one-frame
//      blip in direction info that resolves once the line parses again.
//
// The regex tier exists so the slider section is *never* empty mid-
// edit when the user has already declared what `score` depends on —
// even partial syntax keeps the UI responsive.
export function extractScoreVarsFromText(src: string): ScoreVar[] {
  const tokens = tokenize(src);
  if (tokens.ok) {
    const program = parse(tokens.value);
    if (program.ok) return extractScoreVars(program.value);
  }

  // Find the last line that *starts with* `score =` (modulo whitespace).
  // The DSL has no multi-line statements and no string literals that
  // span newlines, so a plain split is safe.
  const lines = src.split("\n");
  let lastScoreLine: string | null = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^\s*score\s*=/.test(lines[i])) {
      lastScoreLine = lines[i];
      break;
    }
  }
  if (lastScoreLine === null) return [];

  // Tier 2 — try to parse just that line. Often works even when the
  // surrounding formula doesn't (missing END, stray character on
  // another line, etc.).
  const lineTokens = tokenize(lastScoreLine);
  if (lineTokens.ok) {
    const lineProgram = parse(lineTokens.value);
    if (lineProgram.ok) return extractScoreVars(lineProgram.value);
  }

  // Tier 3 — regex over the RHS. The line definitely starts with
  // `score =` (we filtered for it), so split on the first `=` and take
  // what's right of it.
  const eqAt = lastScoreLine.indexOf("=");
  if (eqAt < 0) return [];
  const rhs = lastScoreLine.slice(eqAt + 1);
  return collectIdentifiersFromText(rhs);
}

// Pull every identifier-shaped token out of a string, dedupe, drop
// reserved names. Used as the last-resort fallback inside
// `extractScoreVarsFromText` when neither the full formula nor the
// last `score = …` line can be tokenized + parsed cleanly.
//
// Strings can contain identifier-shaped substrings that aren't real
// references — `"renewable_share"` shouldn't pull out `renewable_share`.
// We strip string literals (both single and double quoted) before the
// scan, leaving the rest of the source untouched. Numbers are filtered
// implicitly because the identifier regex requires a leading letter or
// underscore.
function collectIdentifiersFromText(rhs: string): ScoreVar[] {
  const stripped = rhs
    .replace(/"(?:\\.|[^"\\])*"/g, "")
    .replace(/'(?:\\.|[^'\\])*'/g, "");
  const matches = stripped.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) ?? [];
  const seen = new Set<string>();
  const out: ScoreVar[] = [];
  for (const raw of matches) {
    if (seen.has(raw)) continue;
    if (raw === "score") continue;
    if (RESERVED_LOWERCASE.has(raw.toLowerCase())) continue;
    seen.add(raw);
    out.push({ name: raw, sign: 1 });
  }
  return out;
}

// Names the regex fallback must not return — DSL keywords + built-in
// function names. Lowercased because the language is case-insensitive
// for both. Built-ins that the user calls (e.g. `sqrt(x)`) leak into
// the RHS as identifiers and would otherwise show up as fake slider
// rows.
const RESERVED_LOWERCASE: ReadonlySet<string> = new Set([
  "if",
  "else",
  "end",
  "and",
  "or",
  "true",
  "false",
  "min",
  "max",
  "sqrt",
  "abs",
  "floor",
  "ceil",
  "round",
]);

function visitExpr(e: Expr, f: (e: Expr) => void): void {
  f(e);
  switch (e.kind) {
    case "Call":
      for (const a of e.args) visitExpr(a, f);
      return;
    case "Unary":
      visitExpr(e.operand, f);
      return;
    case "Binary":
      visitExpr(e.left, f);
      visitExpr(e.right, f);
      return;
    case "Percent":
      visitExpr(e.value, f);
      return;
    case "NumLit":
    case "StrLit":
    case "BoolLit":
    case "Ident":
      return;
  }
}
