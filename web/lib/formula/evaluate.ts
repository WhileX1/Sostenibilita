import type {
  Expr,
  Position,
  Program,
  Result,
  Statement,
  Value,
} from "./types";

// Built-in functions. Names match in lowercase regardless of how the user
// types them in the source — `MIN(...)` and `min(...)` both resolve here.
const BUILTINS: Record<
  string,
  { arity: number | "variadic"; fn: (args: Value[], pos: Position) => Value }
> = {
  min: {
    arity: "variadic",
    fn: (args, pos) => {
      if (args.length === 0) throw new RuntimeError("min() needs at least 1 argument", pos);
      return Math.min(...args.map((v) => toNum(v, pos)));
    },
  },
  max: {
    arity: "variadic",
    fn: (args, pos) => {
      if (args.length === 0) throw new RuntimeError("max() needs at least 1 argument", pos);
      return Math.max(...args.map((v) => toNum(v, pos)));
    },
  },
  sqrt: { arity: 1, fn: (args, pos) => Math.sqrt(toNum(args[0], pos)) },
  abs: { arity: 1, fn: (args, pos) => Math.abs(toNum(args[0], pos)) },
  floor: { arity: 1, fn: (args, pos) => Math.floor(toNum(args[0], pos)) },
  ceil: { arity: 1, fn: (args, pos) => Math.ceil(toNum(args[0], pos)) },
  round: { arity: 1, fn: (args, pos) => Math.round(toNum(args[0], pos)) },
};

class RuntimeError extends Error {
  constructor(message: string, public pos: Position) {
    super(message);
  }
}

export interface EvalResult {
  // Final 0..100 score, after clamping the user's `score` variable.
  // Downstream consumers (Strategy / Rating ESG aggregation) should read
  // this — the clamp guarantees the value is in a known range.
  score: number;
  // Full scope after the script finishes — useful for the editor's live
  // preview to also show intermediate variable values, not just the score.
  scope: Record<string, Value>;
}

// Conventional name for the output variable. The script must assign it
// (somewhere — last write wins) for the formula to be valid.
const SCORE_NAME = "score";

export function evaluate(
  program: Program,
  inputs: Record<string, Value>,
): Result<EvalResult> {
  // Copy so the script's intermediate writes don't mutate the input map.
  const scope: Record<string, Value> = { ...inputs };
  try {
    runBody(program.body, scope);
  } catch (e) {
    if (e instanceof RuntimeError) {
      return { ok: false, error: { message: e.message, pos: e.pos } };
    }
    throw e;
  }

  const raw = scope[SCORE_NAME];
  if (raw === undefined) {
    return {
      ok: false,
      error: {
        message: `formula must assign '${SCORE_NAME}' (the 0–100 result)`,
        pos: { line: 1, col: 1 },
      },
    };
  }
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return {
      ok: false,
      error: {
        message: `'${SCORE_NAME}' must be a number, got ${describeType(raw)}`,
        pos: { line: 1, col: 1 },
      },
    };
  }
  // Clamp at the boundary so a slightly-out-of-range formula still
  // produces a usable score for the aggregator. Whether this is
  // desirable depends on taste — we go for forgiving here because the
  // user is iterating.
  return {
    ok: true,
    value: {
      score: Math.max(0, Math.min(100, raw)),
      scope,
    },
  };
}

function runBody(body: Statement[], scope: Record<string, Value>): void {
  for (const stmt of body) runStatement(stmt, scope);
}

function runStatement(stmt: Statement, scope: Record<string, Value>): void {
  if (stmt.kind === "Assign") {
    scope[stmt.name] = evalExpr(stmt.expr, scope);
    return;
  }
  // IF
  const c = evalExpr(stmt.cond, scope);
  if (toBool(c, stmt.pos)) runBody(stmt.thenBranch, scope);
  else runBody(stmt.elseBranch, scope);
}

function evalExpr(e: Expr, scope: Record<string, Value>): Value {
  switch (e.kind) {
    case "NumLit":
      return e.value;
    case "StrLit":
      return e.value;
    case "BoolLit":
      return e.value;
    case "Ident": {
      if (e.name in scope) return scope[e.name];
      throw new RuntimeError(`undefined variable '${e.name}'`, e.pos);
    }
    case "Call": {
      const def = BUILTINS[e.name.toLowerCase()];
      if (!def) {
        throw new RuntimeError(`unknown function '${e.name}'`, e.pos);
      }
      if (def.arity !== "variadic" && e.args.length !== def.arity) {
        throw new RuntimeError(
          `${e.name}() expects ${def.arity} arguments, got ${e.args.length}`,
          e.pos,
        );
      }
      const args = e.args.map((a) => evalExpr(a, scope));
      return def.fn(args, e.pos);
    }
    case "Unary": {
      // unary minus — the only unary form left after `NOT` was dropped
      // in favour of the binary `!=` operator.
      const v = evalExpr(e.operand, scope);
      if (typeof v === "string") {
        throw new RuntimeError(
          `cannot apply '-' to text ${JSON.stringify(v)} — '-' is a math operator and only works with numbers (or true/false, which counts as 0/1)`,
          e.pos,
        );
      }
      return -toNum(v, e.pos);
    }
    case "Percent":
      // Standalone n% = n / 100. The calculator-style "x ± n%" rule is
      // applied in evalBinary when this node is the direct right operand
      // of a + or -.
      return toNum(evalExpr(e.value, scope), e.pos) / 100;
    case "Binary":
      return evalBinary(e, scope);
  }
}

function evalBinary(
  e: Extract<Expr, { kind: "Binary" }>,
  scope: Record<string, Value>,
): Value {
  // Calculator-style percent: the user expects `x - 10%` to mean
  // "subtract 10 percent of x", i.e. x * 0.9 — not x - 0.1. We only fire
  // this when the right operand is *directly* a `n%` postfix; if it's
  // `(10%)` (parenthesised) or part of a bigger expression, normal
  // arithmetic applies.
  if ((e.op === "+" || e.op === "-") && e.right.kind === "Percent") {
    const x = toNum(evalExpr(e.left, scope), e.pos);
    const n = toNum(evalExpr(e.right.value, scope), e.pos);
    return e.op === "+" ? x * (1 + n / 100) : x * (1 - n / 100);
  }

  // AND / OR short-circuit so a guarded expression like
  //   IF x > 0 AND y / x > 1
  // doesn't divide by zero when the guard fails.
  if (e.op === "AND") {
    const l = toBool(evalExpr(e.left, scope), e.pos);
    if (!l) return false;
    return toBool(evalExpr(e.right, scope), e.pos);
  }
  if (e.op === "OR") {
    const l = toBool(evalExpr(e.left, scope), e.pos);
    if (l) return true;
    return toBool(evalExpr(e.right, scope), e.pos);
  }

  const l = evalExpr(e.left, scope);
  const r = evalExpr(e.right, scope);

  if (e.op === "=" || e.op === "!=") {
    if (typeof l !== typeof r) {
      throw new RuntimeError(
        `cannot compare ${describeType(l)} with ${describeType(r)} using '${e.op}' — both sides must have the same type`,
        e.pos,
      );
    }
    return e.op === "=" ? l === r : l !== r;
  }

  // Catch the common gotcha early with a specific message — otherwise
  // toNum below produces a generic "expected a number" that doesn't
  // tell the user *why* the formula refused their text. The fix is
  // either '=' / '!=' (text is fine for equality) or numeric inputs.
  if (typeof l === "string" || typeof r === "string") {
    if (e.op === "<" || e.op === ">") {
      throw new RuntimeError(
        `'${e.op}' compares numbers, not text — use '=' or '!=' to check whether two text values are the same`,
        e.pos,
      );
    }
    throw new RuntimeError(
      `'${e.op}' is a math operator and needs numbers — text values can only be compared for equality with '=' or '!='`,
      e.pos,
    );
  }

  // Arithmetic and ordering: boolean coerces to 0/1, anything else is
  // rejected by toNum.
  const ln = toNum(l, e.pos);
  const rn = toNum(r, e.pos);
  switch (e.op) {
    case "+":
      return ln + rn;
    case "-":
      return ln - rn;
    case "*":
      return ln * rn;
    case "/":
      if (rn === 0) throw new RuntimeError("division by zero", e.pos);
      return ln / rn;
    case "<":
      return ln < rn;
    case ">":
      return ln > rn;
  }
}

function toNum(v: Value, pos: Position): number {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  // Reached when a string slipped past the explicit per-operator
  // checks (e.g. inside a built-in). Wording matches the more specific
  // checks in evalBinary so the user sees a consistent vocabulary
  // ("math" / "needs a number") regardless of where the error came from.
  throw new RuntimeError(
    `this needs a number — got text ${JSON.stringify(v)}, and text only supports equality with '='`,
    pos,
  );
}

function toBool(v: Value, pos: Position): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  throw new RuntimeError(
    `this needs true/false — got text ${JSON.stringify(v)}; logical operators (AND / OR / IF) don't accept text`,
    pos,
  );
}

function describeType(v: Value): string {
  if (typeof v === "number") return "number";
  if (typeof v === "boolean") return "true/false";
  return "text";
}
