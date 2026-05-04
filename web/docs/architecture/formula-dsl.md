# Formula DSL

The formula DSL is a small expression language for ESG scoring. The user writes a script in the per-metric editor; the script transforms raw input variables into named *components* on whatever native scale makes sense, then assigns `score = …` to declare which components compose the rating. The DSL itself only knows about the primitive `score` value (clamped 0..100); the editor layers a *components-and-sliders* model on top of `score = …` for the per-metric rating — see [`scoring.md`](scoring.md) for that side. Lives at [`web/lib/formula/`](../../lib/formula/) as a self-contained module — tokenizer → recursive-descent parser → AST evaluator, plus a parallel highlight tokenizer for the editor overlay and a small `extractScoreVars` helper that lifts the components from the AST. Deliberately not `eval()`, not `Function()`, not a third-party library: the input surface is small, the AST is easy to reason about for security, and writing the parser ourselves is the part of the project that has the most pedagogical value.

## Pieces

| Layer            | Role                                                                                              | Lives in                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Types            | `Value`, `Token`, `Statement`, `Expr`, `Position`, `Result<T>`, `FormulaError`.                   | [`types.ts`](../../lib/formula/types.ts)                            |
| Tokenizer        | `tokenize(src)` — produces a `Token[]` (skips inline whitespace, collapses runs of newlines).     | [`tokenize.ts`](../../lib/formula/tokenize.ts)                      |
| Parser           | `parse(tokens)` — recursive descent + precedence climbing. Throws internally, returns `Result`.   | [`parse.ts`](../../lib/formula/parse.ts)                            |
| Evaluator        | `evaluate(program, inputs)` — walks the AST, returns the final `score` (clamped to 0..100).     | [`evaluate.ts`](../../lib/formula/evaluate.ts)                      |
| Highlight tokenizer | `highlight(src, inputs, computed)` — a *parallel* tokenizer that emits a `Segment[]` covering every character (whitespace included), used by the editor's coloured overlay. Separate from the parser tokenizer because the overlay needs whitespace tokens for character-by-character alignment. | [`highlight.ts`](../../lib/formula/highlight.ts)                    |
| Autocomplete    | `getIdentifierAt(src, caret)` — the prefix being typed at the caret, for the suggestions popover. | [`suggest.ts`](../../lib/formula/suggest.ts)                        |
| Score-vars      | `extractScoreVars(program)` — walks the AST, finds the last `score = …`, returns `[{ name, sign }]` for the editor's slider section. Falls back to "all positive" when the RHS isn't a clean ± chain. | [`scoreVars.ts`](../../lib/formula/scoreVars.ts)                    |
| Public API      | `compile(src)`, `run(src, inputs)`, `evaluate(ast, inputs)`, `extractScoreVars`, `BUILTIN_FUNCTIONS`, `KEYWORDS`, `RESERVED_NAMES`. | [`index.ts`](../../lib/formula/index.ts)                            |
| Smoke tests     | 47 regression cases runnable with `npx tsx lib/formula/smoke.mts`.                                | [`smoke.mts`](../../lib/formula/smoke.mts)                          |

## Language reference

### Types

Three value types: `number`, `boolean`, `string`. Booleans coerce to `0`/`1` in arithmetic context (so `iso_50001 * 10` works). Strings never coerce — they only support equality (`=`) and inequality (`!=`).

### Statements

The script is a sequence of statements separated by newlines:

- **Assignment** — `name = expression`. Binds an identifier in the current scope. Identifiers are `[a-zA-Z_][a-zA-Z0-9_]*` and case-sensitive (`x` ≠ `X`); they can't shadow keywords or built-in function names.
- **IF block** — `IF cond` … `END`, with optional `ELSE`. Body runs when `cond` is true. Nests freely.

```
quota = renewable / total * 100

bonus = 0
IF iso_50001
  bonus = 10
ELSE
  bonus = 0
END

score = quota + bonus
```

### Operators

All operators except the unary forms take two operands. Listed in precedence order, low → high (`OR` weakest, `%` strongest).

| Precedence | Operator           | Operand types                       | Notes |
|------------|--------------------|-------------------------------------|-------|
| logical    | `OR`               | boolean / boolean (with coercion)   | Short-circuit. Right side skipped when the left is true. |
| logical    | `AND`              | same                                | Short-circuit. Right side skipped when the left is false. |
| comparison | `=`, `!=`          | any (both sides same type)          | Type-strict: `1 = "1"` is a runtime error, not `false`. To negate a boolean (no unary `NOT`), write `iso_50001 != true`. |
| comparison | `<`, `>`           | number / number                     | Strings can't be ordered (use `=` / `!=` for equality instead). |
| arithmetic | `+`, `-`           | number / number                     | See "calculator-style percent" below. |
| arithmetic | `*`, `/`           | number / number                     | Division by zero is a runtime error. |
| unary      | `-` (negation)     | number                              | `-x` for sign flip. |
| postfix    | `n%`               | number                              | Standalone `n%` evaluates to `n / 100`. The calculator-style rule (see below) overrides this when `n%` is the direct right operand of `+` / `-`. |

Keywords and operator words (`IF`, `ELSE`, `END`, `AND`, `OR`, `TRUE`, `FALSE`) are case-insensitive (`AND` = `and` = `And`). Built-in function names are also matched case-insensitively (`MIN` works the same as `min`).

### Calculator-style percent

`x + 10%` and `x - 10%` mean what calculators mean — *add 10 percent of x* and *subtract 10 percent of x* respectively, not `x ± 0.1`:

- `100 + 10%` → `100 × 1.10` = `110`
- `100 - 10%` → `100 × 0.90` = `90`
- `50 - 10% - 10%` → `50 × 0.9 × 0.9` = `40.5` (left-associative)
- `50%` (standalone) → `0.5`
- `200 * 25%` → `50` (multiplication uses the standalone rule)

The rule fires only when `n%` is the *direct* right operand of `+` or `-`. Anything else falls back to `n / 100`. This is implemented in `evalBinary` by checking `e.right.kind === "Percent"` before the generic arithmetic path.

### Built-in functions

Variadic (`min`, `max`) or fixed-arity. All take numbers (boolean coerces to 0/1). No string built-ins.

| Function | Arity      | Effect |
|----------|------------|--------|
| `min`    | variadic   | Smallest of its arguments. |
| `max`    | variadic   | Largest. |
| `sqrt`   | 1          | Square root. |
| `abs`    | 1          | Absolute value. |
| `floor`  | 1          | Round down to nearest integer. |
| `ceil`   | 1          | Round up. |
| `round`  | 1          | Round to nearest integer (banker's rounding follows JS `Math.round`). |

`clamp` is *not* a built-in — `score` is automatically clamped to 0..100 by the evaluator after the script finishes, so the common case doesn't need it. For mid-formula clamping the user writes an `IF` block.

### The `score` convention

The script must assign a variable named `score`. The evaluator clamps that value to `[0, 100]` and returns it. If the script doesn't assign `score`, evaluation fails with `formula must assign 'score' (the 0–100 result)`. If `score` ends up as anything other than a finite number, evaluation fails with `'score' must be a number, got <type>`. This is the only "magic name" in the language.

```
score = renewable_share + reduction + iso_50001 - energy_intensity
```

Two readings of the same line:

- **DSL primitive**: `score` is the assigned numeric variable; the evaluator clamps it and returns it as `EvalResult.score`. The arithmetic on the right is just normal expression evaluation.
- **Editor convention**: the metric editor parses this line specially — it lifts the referenced identifiers and their signs as the *components of the rating* (see `extractScoreVars`). The editor's rating computation is a slider-weighted, range-normalized average of those components, *not* the literal arithmetic of the expression — coefficients written here (`0.6 *`) are ignored by the rating, and `*` / `/` / function calls collapse the sign analysis into "all positive". The DSL doesn't enforce this convention; the editor does, and the help panel inside the editor explains it. See [`scoring.md`](scoring.md) for the rating computation.

### Strings

Strings exist primarily as **categorical labels** for inputs (e.g. `sector = "service"`), which the formula compares with `=`:

```
sector_bonus = 0
IF sector = "service"
  sector_bonus = 5
END
score = quota + sector_bonus
```

The language deliberately doesn't support string concatenation, ordering, or string-to-number coercion. Trying to use a string in a math operator (`+ - * /`) or in `< / >` produces a specific runtime error:

- `"hi" + 1` → `'+' is a math operator and needs numbers — text values can only be compared for equality with '=' or '!='`
- `"a" < "b"` → `'<' compares numbers, not text — use '=' or '!=' to check whether two text values are the same`
- `-"hi"` → `cannot apply '-' to text "hi" — '-' is a math operator and only works with numbers (or true/false, which counts as 0/1)`

Each error includes the line/column of the offending operator.

## Architecture

### Tokenizer (`tokenize.ts`)

Single-pass character walker. Maintains `(i, line, col)` and emits `Token` objects with kind + raw text + position. Whitespace is skipped silently *except* for newlines, which become `NEWLINE` tokens that the parser uses as statement separators. Consecutive blank lines collapse into a single `NEWLINE` so the parser doesn't have to handle vertical-whitespace runs itself.

Keyword recognition is done at lex time: an identifier whose uppercase form matches an entry in `KEYWORDS` becomes a `IF` / `AND` / `TRUE` / etc. token, not an `IDENT`. This keeps the parser from re-checking identifier text.

### Parser (`parse.ts`)

Recursive descent with precedence climbing for expressions:

```
expr           → orExpr
orExpr         → andExpr ("OR" andExpr)*
andExpr        → comparison ("AND" comparison)*
comparison     → additive (("=" | "!=" | "<" | ">") additive)?
additive       → multiplicative (("+" | "-") multiplicative)*
multiplicative → unary (("*" | "/") unary)*
unary          → "-" unary | postfix
postfix        → primary "%"?
primary        → NUMBER | STRING | "TRUE" | "FALSE" | IDENT | call | "(" expr ")"
call           → IDENT "(" (expr ("," expr)*)? ")"
```

Statements: `Assign := IDENT "=" expr NL`, `If := "IF" expr NL stmt* ("ELSE" NL stmt*)? "END"`. Errors are thrown as a `ParseError` (internal) caught at the top level and returned as a `Result`.

The parser shares an `expectStatementEnd(ctx, context)` helper between assignment and IF/ELSE so the "unexpected token after …" vocabulary stays consistent across statement contexts.

### Evaluator (`evaluate.ts`)

Tree-walking interpreter over the AST. The scope is a single mutable `Record<string, Value>` seeded with the input values; each `Assign` writes into it, each `Ident` reads from it. Errors throw a `RuntimeError` (internal) caught at the top level and returned as a `Result`.

Type discipline:

- `=` and `!=` require both sides to have the same JS type, no implicit coercion.
- `<`, `>`, and arithmetic operators reject strings with operator-specific messages, then coerce booleans to 0/1 via `toNum`.
- `AND`, `OR`, `IF` use `toBool` which accepts boolean and number (non-zero is true), but rejects strings.
- The calculator-style percent rule fires *before* generic arithmetic, only when the right operand is a direct `Percent` AST node.

After the script finishes, the evaluator reads `scope.score` and:

1. Errors if it's missing or not a finite number.
2. Clamps to `[0, 100]` and returns it.

The clamp is a safety net — formulas that produce in-range values don't need to do anything extra. The metric editor layers a *components-and-sliders* model on top of this primitive: it parses `score = …` to discover the variables that compose the rating, weights them via the user's sliders, and normalizes each via per-component ranges before averaging. The DSL itself only knows about the primitive `score` value; the slider/range UX is implemented entirely in [`web/components/metricEditor/MetricEditor.tsx`](../../components/metricEditor/MetricEditor.tsx) (the generic editor used by every scored window) and the [`metrics`](../../store/slices/metricsSlice.ts) slice.

### Highlight tokenizer (`highlight.ts`)

Parallel to the parser tokenizer but with two key differences:

1. **Emits whitespace as `plain` segments**, so concatenating every segment's text reproduces the source byte-for-byte. This is what lets the overlay stay character-aligned with the textarea on top.
2. **Classifies identifiers semantically**: input names get the `input` kind, computed names (anything assigned by the script) get `computed`, the special `score` gets its own kind, anything else is `unknown`. Keywords and built-ins are pre-classified as `operator` / `builtin` / `literal`.

`collectAssignmentTargets(src)` is a per-line regex scan that produces the set of computed names. It deliberately doesn't reuse the parser tokenizer because it must work on partially-typed (un-parseable) source — the user is mid-keystroke and the highlighter has to keep colouring as they type.

### Score-vars extractor (`scoreVars.ts`)

The metric editor needs to know which identifiers participate in the rating *and* with which sign — the slider section is one row per component, with the sign read out as a `−` prefix when the formula subtracts the variable. `extractScoreVars(program)` walks the AST, finds the last `Assign` whose target is `score`, and tries to flatten its RHS as a chain of `+` / `−` / unary `−` / parens (`a + b - (c + d)` flattens to `[+a, +b, -c, -d]`). When the RHS isn't that shape — `*`, `/`, function calls, percent — it falls back to a simple identifier collector with all signs `+1`. Self-references (`score = score + a`) are filtered out. The result is `ScoreVar[]` with `{ name, sign: 1 | -1 }`, ordered by first appearance.

`extractScoreVarsFromText(src)` is the source-text equivalent. The metric editor uses *this* one (not the AST variant) so the slider rows survive a parse error elsewhere in the formula — without it, a single missing `END` or stray operator wipes the sliders and forces the user to fix the typo before they can keep tuning weights / ranges. Three-tier fallback:

1. **Full compile.** If the whole formula tokenizes + parses, hand the AST to `extractScoreVars`. Best signal — captures `score = …` reassignments inside IF branches, signs preserved.
2. **Line-isolated compile.** If full compile fails, find the last line matching `^\s*score\s*=` and try to tokenize + parse just that line. Often works when the surrounding formula doesn't (missing END, stray character on another line). Signs preserved.
3. **Regex fallback.** If even the score line is in flight (`score = a +` mid-typing), pull every identifier-shaped token out of the RHS, dedupe, drop reserved names. Strings are stripped first so `"renewable_share"` doesn't pollute the list. Signs degrade to all `+1`; the user sees their variable list with a one-frame blip in direction info that resolves once the line parses again.

Both extractors live in the same file because they share the AST walk and the dedupe-by-first-appearance helper.

### Autocomplete helper (`suggest.ts`)

`getIdentifierAt(src, caret)` walks left from the caret while the previous character is an identifier-continue character. Returns the prefix (up to the caret), and the start/end offsets of the full identifier (so the editor can replace `[start, end)` with a chosen suggestion). Returns an empty prefix when the caret is in a numeric literal or in whitespace, so the popover knows when to hide.

`filterSuggestions(candidates, prefix)` does case-insensitive `startsWith` filtering — keyword and built-in names are uppercase / lowercase respectively, so case-insensitive matching lets the user keep typing in whatever case they prefer.

The metric editor consumes `getIdentifierAt` in [`MetricEditor.tsx`](../../components/metricEditor/MetricEditor.tsx)'s `FormulaEditor` to drive a **Copilot-style inline ghost completion** — no popover. The candidate list is `[inputs, computed names except score, KEYWORDS, BUILTIN_FUNCTIONS]` walked in that order; the first match whose lowercase form starts with (and isn't equal to) the typed prefix becomes the ghost suggestion. The suffix `candidate.slice(identAt.prefix.length)` is rendered as muted-grey text positioned at the caret.

### How the ghost gets positioned without measuring the caret

The editor stacks two overlays under the transparent textarea:

1. The existing syntax-highlight overlay paints the actual source.
2. A **second overlay** paints `<span style="color: transparent">value.slice(0, caret)</span><span style={formulaGhost}>{ghostText}</span>` — same monospace font, same `padding`, same `whiteSpace: pre-wrap`. Because the prefix span uses `color: transparent`, the layout reserves exactly the same horizontal space as the real text up to the caret, so the ghost suffix lands at the caret's pixel position with no DOM measurement, no caret-rect math, no mirror-div trick.

This works because the textarea's word-wrap behaviour is fully determined by `whiteSpace`, `wordBreak`, `font`, and `padding` — all matched on the overlay. The same chars wrap the same way.

### Activation and acceptance

- Caret must sit at `identAt.end` — typing in the middle of an existing name doesn't trigger a ghost.
- Suggestions whose lowercase form equals the prefix are filtered out — a complete name produces no ghost.
- `Tab` accepts: the ghost text inserts at the caret (the user's typed prefix is preserved verbatim, only the missing chars are added). `Tab` is only preempted while a ghost is showing; without a ghost it falls through to the browser's default focus-next behaviour, keeping the editor keyboard-navigable.
- `Esc` records the dismissed prefix. The ghost only reappears when typing changes the prefix to something different — caret-only moves don't reopen a dismissed prefix.
- Any further typing resets `dismissedPrefix` to `null`, so a deliberate "no, keep typing" doesn't permanently kill ghosts for unrelated names later.

`filterSuggestions` is exported from the library too (it powered an earlier popover-style autocomplete and remains available for any future surface that needs the case-insensitive `startsWith` filter — the metric editor's ghost-text path doesn't use it because it only needs the *first* match, not the whole filtered list).

## Errors and how they surface

Every error has a `{ line, col }` position. The editor uses these to render a single red inline message under the textarea:

```
line 3, col 12: '+' is a math operator and needs numbers — text values can only be compared for equality with '='
```

Categories:

- **Tokenizer errors** — unterminated strings, strings that span newlines, unrecognised characters.
- **Parse errors** — unexpected tokens, missing `END`, missing `=` after a name, bad function-call syntax. The tokenizer also catches `!` typed without `=` and emits a guided message pointing the user at `!=` for not-equal.
- **Runtime errors** — undefined variables, division by zero, type mismatches in `=`, math/comparison on strings, `score` missing or non-numeric.

The compile/evaluate split lets the editor avoid re-tokenizing on input-value changes: `compile(src)` runs once per source change, `evaluate(ast, values)` runs on every value change. The hot loop in the editor is just `evaluate`.

## Adding to the language

The DSL is small enough that extending it is mechanical. Examples of what each kind of change touches:

- **New built-in function** — add an entry to the `BUILTINS` map in `evaluate.ts`, add the name to `BUILTIN_FUNCTIONS` in `index.ts`, add it to the `BUILTINS` set in `highlight.ts` so the editor colours it. (Three places, but they're symmetric.)
- **New operator** — `tokenize.ts` recognises the symbol, `parse.ts` slots it into the right precedence level, `evaluate.ts` implements the semantics, `highlight.ts` adds it to its single-character operator set.
- **New value type** — touches `types.ts` (the `Value` union), the type-coercion helpers in `evaluate.ts`, and the highlighter's segment-kind enum + the editor's per-kind theme styles.
- **New statement** — extend the `Statement` AST, add a parser arm, add an evaluator arm. Statements should terminate at end-of-line so they integrate with the existing program-loop scanner.

Every extension goes alongside a smoke-test entry in `smoke.mts`. The smoke runner is intentionally lightweight (no jest / vitest) so the loop is `edit → npx tsx → see results` with no setup.
