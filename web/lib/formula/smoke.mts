// One-off smoke test, runnable with `node --experimental-strip-types`.
// Not a unit-test framework — just a quick assertion battery to confirm
// the DSL handles the spec correctly. Delete or fold into a real test
// runner once one is added.

import assert from "node:assert/strict";
// Note: dynamic imports because tsx + .mts has trouble with named imports
// from re-exported modules; the resolved namespace works fine.
const { tokenize } = await import("./tokenize.ts");
const { parse } = await import("./parse.ts");
const { evaluate } = await import("./evaluate.ts");
const { getIdentifierAt } = await import("./suggest.ts");
type Value = number | boolean | string;

function run(src: string, inputs: Record<string, Value>) {
  const t = tokenize(src);
  if (!t.ok) return t;
  const p = parse(t.value);
  if (!p.ok) return p;
  return evaluate(p.value, inputs);
}

let passed = 0;
let failed = 0;

function check(name: string, src: string, inputs: Record<string, Value>, expected: number) {
  const r = run(src, inputs);
  if (!r.ok) {
    console.log(`FAIL ${name}: parse/eval error: ${r.error.message} at line ${r.error.pos.line}:${r.error.pos.col}`);
    failed++;
    return;
  }
  if (Math.abs(r.value.score - expected) > 1e-9) {
    console.log(`FAIL ${name}: expected score ${expected}, got ${r.value.score}`);
    failed++;
    return;
  }
  passed++;
}

function checkErr(name: string, src: string, inputs: Record<string, Value>, expectedSubstr: string) {
  const r = run(src, inputs);
  if (r.ok) {
    console.log(`FAIL ${name}: expected error containing "${expectedSubstr}", got score ${r.value.score}`);
    failed++;
    return;
  }
  if (!r.error.message.includes(expectedSubstr)) {
    console.log(`FAIL ${name}: expected error containing "${expectedSubstr}", got "${r.error.message}"`);
    failed++;
    return;
  }
  passed++;
}

// Arithmetic and precedence
check("simple", `score = 1 + 2 * 3`, {}, 7);
check("parens", `score = (1 + 2) * 3`, {}, 9);
check("unary minus", `score = -5 + 10`, {}, 5);
check("input ref", `score = x * 2`, { x: 21 }, 42);

// Calculator-style percent on + / -
check("minus 10%", `score = 100 - 10%`, {}, 90);
check("plus 10%", `score = 50 + 10%`, {}, 55);
// Chained percent: (50 - 10%) - 10% = 50 * 0.9 * 0.9 = 40.5
check("chained minus %", `score = 50 - 10% - 10%`, {}, 40.5);
// Standalone n% = n/100
check("standalone %", `score = 50%`, {}, 0.5);
check("% in mul", `score = 200 * 25%`, {}, 50);

// Comparisons + booleans + AND/OR + IF
check(
  "if true",
  `
    x = 5
    score = 0
    IF x > 3
      score = 100
    END
  `,
  {},
  100,
);
check(
  "if/else",
  `
    score = 0
    IF false
      score = 1
    ELSE
      score = 50
    END
  `,
  {},
  50,
);
check(
  "AND short-circuit (no div by zero)",
  `
    score = 0
    IF y > 0 AND x / y > 1
      score = 100
    END
  `,
  { x: 0, y: 0 },
  0,
);
check(
  "OR short-circuit",
  `
    score = 0
    IF true OR x / 0 > 1
      score = 100
    END
  `,
  { x: 1 },
  100,
);

// String equality
check(
  "string ==",
  `
    score = 0
    IF sector = "service"
      score = 80
    END
  `,
  { sector: "service" },
  80,
);

// Boolean coerces in arithmetic
check(
  "boolean times number",
  `
    score = iso_50001 * 100
  `,
  { iso_50001: true },
  100,
);

// Built-ins
check("min/max", `score = max(1, 2, min(3, 4))`, {}, 3);
check("case-insensitive function", `score = MAX(50, 0)`, {}, 50);
check("case-insensitive keyword", `
  score = 0
  if true
    score = 1
  end
`, {}, 1);

// Score is clamped to 0..100 at the boundary so out-of-range formulas
// still produce a usable rating for downstream aggregation.
check("over 100 clamps", `score = 200`, {}, 100);
check("under 0 clamps", `score = -50`, {}, 0);

// The seed formula from the spec discussion. No explicit clamp — the
// evaluator clamps `score` to 0..100 at the boundary as a safety net.
check(
  "energy seed",
  `
    renewable_share = kwh_renewable / kwh_total * 100
    reduction = (kwh_previous - kwh_total) / kwh_previous * 100

    iso_bonus = 0
    IF iso_50001
      iso_bonus = 10
    END

    score = 0.6 * renewable_share + 0.4 * reduction + iso_bonus
  `,
  {
    kwh_total: 800,
    kwh_renewable: 400, // 50% renewable
    kwh_previous: 1000, // 20% reduction
    iso_50001: true,
  },
  // 0.6 * 50 + 0.4 * 20 + 10 = 30 + 8 + 10 = 48
  48,
);

// Errors
checkErr("missing score", `x = 10`, {}, "must assign 'score'");
checkErr("undef variable", `score = banana`, {}, "undefined variable 'banana'");
checkErr("div zero", `score = 10 / 0`, {}, "division by zero");
// String + math: clear "math operator needs numbers" message naming the
// offending operator and pointing the user at the only thing text supports.
checkErr("string + number", `score = "hi" + 1`, {}, "math operator and needs numbers");
checkErr("string * number", `score = "x" * 2`, {}, "math operator and needs numbers");
checkErr("string < number", `score = "a" < 1`, {}, "compares numbers, not text");
checkErr("string > string", `score = "a" > "b"`, {}, "compares numbers, not text");
checkErr("unary minus on string", `score = -"hi"`, {}, "cannot apply '-' to text");
checkErr("type mismatch =", `score = 0\nIF 1 = "1"\nscore = 2\nEND`, {}, "cannot compare");
checkErr("unterminated IF", `IF true\nscore = 1\n`, {}, "missing END");
checkErr("score must be number", `score = "hi"`, {}, "must be a number");

// Not-equal: numbers, strings, and a type-mismatch error consistent
// with `=`. Stray `!` (without `=`) gets a guided tokenizer message.
check(
  "not equal numbers true",
  `score = 0\nIF a != b\n  score = 100\nEND`,
  { a: 1, b: 2 },
  100,
);
check(
  "not equal numbers false",
  `score = 0\nIF a != b\n  score = 100\nEND`,
  { a: 5, b: 5 },
  0,
);
check(
  "not equal strings",
  `score = 0\nIF sector != "service"\n  score = 70\nEND`,
  { sector: "industry" },
  70,
);
checkErr(
  "type mismatch !=",
  `score = 0\nIF 1 != "1"\nscore = 2\nEND`,
  {},
  "cannot compare",
);
checkErr(
  "stray bang",
  `score = a\nIF a ! b\n  score = 1\nEND`,
  { a: 1, b: 1 },
  "'!='",
);

// extractScoreVars — sign extraction + fallback path
{
  const { extractScoreVars } = await import("./scoreVars.ts");
  const compile = (src: string) => {
    const t = tokenize(src);
    if (!t.ok) throw new Error("tokenize failed");
    const p = parse(t.value);
    if (!p.ok) throw new Error("parse failed");
    return p.value;
  };

  // Plain chain of additions: all signs +1.
  {
    const vars = extractScoreVars(compile("score = a + b + c"));
    assert.deepEqual(vars, [
      { name: "a", sign: 1 },
      { name: "b", sign: 1 },
      { name: "c", sign: 1 },
    ]);
    passed++;
  }
  // Mixed `+` and `−`.
  {
    const vars = extractScoreVars(compile("score = a + b - c"));
    assert.deepEqual(vars, [
      { name: "a", sign: 1 },
      { name: "b", sign: 1 },
      { name: "c", sign: -1 },
    ]);
    passed++;
  }
  // Unary minus at the head.
  {
    const vars = extractScoreVars(compile("score = -a + b"));
    assert.deepEqual(vars, [
      { name: "a", sign: -1 },
      { name: "b", sign: 1 },
    ]);
    passed++;
  }
  // Parens flip the sign of every term inside.
  {
    const vars = extractScoreVars(compile("score = a - (b + c)"));
    assert.deepEqual(vars, [
      { name: "a", sign: 1 },
      { name: "b", sign: -1 },
      { name: "c", sign: -1 },
    ]);
    passed++;
  }
  // Complex expression: falls back to all-positive collection.
  {
    const vars = extractScoreVars(compile("score = 2 * a + b"));
    assert.deepEqual(vars, [
      { name: "a", sign: 1 },
      { name: "b", sign: 1 },
    ]);
    passed++;
  }
  // No `score = …`: empty list.
  {
    const vars = extractScoreVars(compile("x = 1"));
    assert.deepEqual(vars, []);
    passed++;
  }
  // Numeric-only score: empty list (no Idents to slide).
  {
    const vars = extractScoreVars(compile("score = 50"));
    assert.deepEqual(vars, []);
    passed++;
  }
  // Self-reference is excluded.
  {
    const vars = extractScoreVars(compile("score = a + score"));
    // Top-level form is `Ident a + Ident score` — the score-self ref
    // makes flatten return null (we reject it as a term), so we fall
    // back to all-positive collection where `score` is filtered.
    assert.deepEqual(vars, [{ name: "a", sign: 1 }]);
    passed++;
  }
}

// Autocomplete helper
{
  const src = "score = kwh_re";
  const r = getIdentifierAt(src, src.length);
  assert.equal(r.prefix, "kwh_re");
  assert.equal(r.start, 8);
  assert.equal(r.end, 14);
  passed++;
}
{
  const r = getIdentifierAt("score = 12", 10);
  assert.equal(r.prefix, ""); // inside number, not identifier
  passed++;
}

// extractScoreVarsFromText — tier 1 (full compile), tier 2 (line
// isolation), and tier 3 (regex fallback).
const { extractScoreVarsFromText } = await import("./scoreVars.ts");
{
  const r = extractScoreVarsFromText(`a = 1\nscore = a + b - c`);
  assert.deepEqual(r, [
    { name: "a", sign: 1 },
    { name: "b", sign: 1 },
    { name: "c", sign: -1 },
  ]);
  passed++;
}
{
  // Unrelated line broken (missing END) — line-isolated parse rescues
  // the score variables with signs preserved.
  const src = `IF cond\n  bad = 1\nscore = a - b`;
  const r = extractScoreVarsFromText(src);
  assert.deepEqual(r, [
    { name: "a", sign: 1 },
    { name: "b", sign: -1 },
  ]);
  passed++;
}
{
  // Score line itself in flight (`score = a + `) — regex fallback,
  // signs degrade to all positive but variables still surface.
  const r = extractScoreVarsFromText(`score = a + b + `);
  assert.deepEqual(r, [
    { name: "a", sign: 1 },
    { name: "b", sign: 1 },
  ]);
  passed++;
}
{
  // No score line → empty.
  const r = extractScoreVarsFromText(`a = 1`);
  assert.deepEqual(r, []);
  passed++;
}
{
  // Reserved names (keywords / builtins) inside the regex tier must
  // not show up as fake slider rows.
  const r = extractScoreVarsFromText(`score = sqrt(a) + max(b, c) +`);
  assert.deepEqual(r.map((v) => v.name).sort(), ["a", "b", "c"]);
  passed++;
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
