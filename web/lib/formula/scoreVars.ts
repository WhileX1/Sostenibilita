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
