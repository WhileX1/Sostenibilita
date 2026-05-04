"use client";

import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
} from "react";
import { useTheme } from "@/lib/themes";
import { useButtonState } from "@/lib/ui/useButtonState";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  addInput,
  removeInput,
  resetMetric,
  setFormula,
  setInputValue,
  setMaterial,
  setNotMaterialReason,
  setVarRange,
  setVarWeight,
  type InputDefinition,
  type InputType,
  type VarRange,
} from "@/store/slices/metricsSlice";
import { getWindow } from "@/lib/windows/registry";
import {
  BUILTIN_FUNCTIONS,
  KEYWORDS,
  RESERVED_NAMES,
  collectAssignmentTargets,
  compile,
  evaluate,
  extractScoreVarsFromText,
  getIdentifierAt,
  highlight,
  type FormulaError,
  type ScoreVar,
  type Segment,
  type SegmentKind,
  type Value,
} from "@/lib/formula";
import { MAX_WEIGHT } from "@/lib/scoring/config";
import {
  DEFAULT_RANGE,
  DEFAULT_VAR_WEIGHT,
  ratingFromEval,
} from "@/lib/scoring/rating";

const VALID_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

type EditorStyles = ReturnType<
  typeof useTheme
>["theme"]["pages"]["metricEditor"];

// Generic per-metric editor. Reads its config from the metrics slice
// keyed by `metricId`; the title is whatever the registry calls the
// page. Identical chrome (inputs table, formula textarea, component
// sliders, score footer) for every scored E/S/G window — the only
// per-metric variation is the seed (in `metricsSlice.ts`) and the
// title shown in the header.
//
// The default helper text is generic; pages that want to set the
// scene with a metric-specific intro can pass `helper`.
export interface MetricEditorProps {
  metricId: string;
  title: string;
  helper?: React.ReactNode;
}

const DEFAULT_HELPER = (
  <>
    Define the inputs your company measures and write a formula that turns
    them into a 0–100 score. Intermediate variables are allowed; the final
    result must be assigned to <code>score</code>.
  </>
);

export default function MetricEditor({
  metricId,
  title,
  helper,
}: MetricEditorProps) {
  const { theme } = useTheme();
  const styles = theme.pages.metricEditor;
  const dispatch = useAppDispatch();
  const config = useAppSelector((s) => s.metrics.byId[metricId]);

  // Compile the formula once per source change. The AST is then re-evaluated
  // against the input values whenever they change without re-parsing — the
  // hot loop while the user is typing numbers is just `evaluate`, not
  // `tokenize → parse → evaluate`.
  const compiled = useMemo(() => compile(config.formula), [config.formula]);
  const evalResult = useMemo(() => {
    if (!compiled.ok) return null;
    return evaluate(compiled.value, config.values);
  }, [compiled, config.values]);

  // Every variable in the formula's scope at the end of evaluation —
  // both the user's inputs (their current values) and the script's own
  // intermediate assignments. Shown as chips so the user sees the full
  // numeric picture without having to re-do the math in their head.
  // Inputs come first (the evaluator seeds the scope with them, JS
  // preserves insertion order); `score` is excluded — it's already
  // rendered front-and-centre in the score panel below.
  const scopeChips = useMemo(() => {
    if (!evalResult || !evalResult.ok) return [];
    const inputNames = new Set(config.inputs.map((i) => i.name));
    return Object.entries(evalResult.value.scope)
      .filter(([k]) => k !== "score")
      .map(([name, value]) => ({
        name,
        value,
        isInput: inputNames.has(name),
      }));
  }, [evalResult, config.inputs]);

  // Identifiers referenced inside the user's `score = …` line — every
  // variable that appears there gets a slider in the weights section
  // below the formula. Each carries a sign (+1 / −1) lifted from the
  // formula's `+`/`−` operators: writing `score = a - c` flags `c` as
  // "lower is better". Empty when the user hasn't written `score = …`
  // yet, in which case the section stays hidden and the rating falls
  // back to the formula's literal value.
  //
  // Reads from source text via `extractScoreVarsFromText` (not from
  // the compiled AST) so the slider section keeps its rows when the
  // wider formula has a parse error somewhere unrelated. The helper
  // tries the full compile first, then a line-isolated parse of the
  // last `score = …` line, then a regex tier as last resort — see
  // `web/lib/formula/scoreVars.ts` for the three-tier rationale.
  const scoreVars = useMemo<ScoreVar[]>(
    () => extractScoreVarsFromText(config.formula),
    [config.formula],
  );

  const inputNameSet = useMemo(
    () => new Set(config.inputs.map((i) => i.name)),
    [config.inputs],
  );

  // The metric's rating: a 0..100 number computed from the components
  // in `score = …`. Logic factored into `ratingFromEval` so the
  // `Rating ESG` aggregator can reuse the same calculation without
  // re-implementing the slider/range model.
  const rating = useMemo<number | null>(() => {
    if (!evalResult || !evalResult.ok) return null;
    return ratingFromEval(
      evalResult.value.scope,
      evalResult.value.score,
      scoreVars,
      config.weights,
      config.ranges,
    );
  }, [scoreVars, evalResult, config.weights, config.ranges]);

  const formulaError: FormulaError | null = !compiled.ok
    ? compiled.error
    : evalResult && !evalResult.ok
      ? evalResult.error
      : null;

  const esrs = getWindow(metricId)?.esrs;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>{title}</h1>
        {esrs && (
          <p style={styles.esrsTag}>
            <code>{esrs.code}</code> · {esrs.topic}
          </p>
        )}
        <p style={styles.helper}>{helper ?? DEFAULT_HELPER}</p>
      </header>

      <MaterialityPanel
        styles={styles}
        isMaterial={config.isMaterial}
        reason={config.notMaterialReason}
        onToggle={(next) =>
          dispatch(setMaterial({ metricId, isMaterial: next }))
        }
        onReasonChange={(reason) =>
          dispatch(setNotMaterialReason({ metricId, reason }))
        }
      />

      {config.isMaterial && (
        <>
          <fieldset style={styles.section}>
            <legend style={styles.sectionLegend}>Inputs</legend>

            <div style={styles.inputsGrid}>
              <div style={styles.inputsHeaderCell}>Name</div>
              <div style={styles.inputsHeaderCell}>Type</div>
              <div style={styles.inputsHeaderCell}>Label</div>
              <div style={styles.inputsHeaderCell}>Value</div>
              <div />

              {config.inputs.map((input) => (
                <InputRow
                  key={input.name}
                  input={input}
                  value={config.values[input.name]}
                  styles={styles}
                  onChangeValue={(value) =>
                    dispatch(
                      setInputValue({ metricId, name: input.name, value }),
                    )
                  }
                  onRemove={() =>
                    dispatch(removeInput({ metricId, name: input.name }))
                  }
                />
              ))}
            </div>

            <AddInputForm
              existingNames={config.inputs.map((i) => i.name)}
              styles={styles}
              onAdd={(input) => dispatch(addInput({ metricId, input }))}
            />
          </fieldset>

          <FormulaSection
            styles={styles}
            formula={config.formula}
            inputNames={config.inputs.map((i) => i.name)}
            onChange={(formula) =>
              dispatch(setFormula({ metricId, formula }))
            }
            formulaError={formulaError}
            scopeChips={scopeChips}
          />

          {scoreVars.length > 0 && (
            <WeightsSection
              styles={styles}
              scoreVars={scoreVars}
              weights={config.weights}
              ranges={config.ranges}
              inputNameSet={inputNameSet}
              onChangeWeight={(name, weight) =>
                dispatch(setVarWeight({ metricId, name, weight }))
              }
              onChangeRange={(name, range) =>
                dispatch(
                  setVarRange({
                    metricId,
                    name,
                    min: range.min,
                    max: range.max,
                  }),
                )
              }
            />
          )}
        </>
      )}

      <div style={styles.scorePanel}>
        <div style={styles.scoreInline}>
          <span style={styles.scoreLabel}>Score</span>
          {!config.isMaterial ? (
            <span style={styles.scoreError}>not assessed</span>
          ) : !formulaError && rating !== null ? (
            <span style={styles.scoreValue}>{Math.round(rating)} / 100</span>
          ) : (
            <span style={styles.scoreError}>
              {formulaError ? "—" : "waiting for data"}
            </span>
          )}
        </div>
        <ResetButton
          styles={styles}
          onReset={() => dispatch(resetMetric({ metricId }))}
        />
      </div>
    </div>
  );
}

// Materiality toggle — sits between the page header and the inputs
// section. When ON: a slim "this topic is material" strip with a
// checkbox. When OFF: a more prominent panel with the toggle, a
// "this topic is not assessed" callout, and a reason textarea so
// the user can record *why* — this text shows up in Reporting CSRD.
function MaterialityPanel({
  styles,
  isMaterial,
  reason,
  onToggle,
  onReasonChange,
}: {
  styles: EditorStyles;
  isMaterial: boolean;
  reason: string | undefined;
  onToggle: (next: boolean) => void;
  onReasonChange: (reason: string) => void;
}) {
  return (
    <fieldset
      style={
        isMaterial
          ? styles.materialityStripMaterial
          : styles.materialityStripNotMaterial
      }
    >
      <legend style={styles.materialityLegend}>Materiality</legend>
      <label style={styles.materialityToggleLabel}>
        <input
          type="checkbox"
          checked={isMaterial}
          onChange={(e) => onToggle(e.target.checked)}
          style={styles.checkbox}
        />
        Material to this organisation
      </label>
      {!isMaterial && (
        <>
          <p style={styles.materialityNotice}>
            This ESRS topic is currently flagged <strong>not material</strong>.
            Inputs, formula, and rating are hidden; the topic appears under{" "}
            <em>Topics not assessed</em> in the Reporting CSRD window with
            the reason below.
          </p>
          <label style={styles.materialityReasonLabel}>
            Reason (shown in the report)
            <textarea
              value={reason ?? ""}
              onChange={(e) => onReasonChange(e.target.value)}
              style={styles.materialityReasonField}
              rows={3}
              placeholder="e.g. Not material: B2B-only sales, no direct impact on consumers."
            />
          </label>
        </>
      )}
    </fieldset>
  );
}

// Slider section — one row per identifier referenced in `score = …`.
// Each row carries:
//   * the variable name (with a "−" prefix when the formula subtracts
//     the variable, i.e. "lower is better");
//   * a Strategy-style weight slider (0..MAX_WEIGHT raw, normalized to
//     100% shares across the visible variables);
//   * a [min, max] judgement range that maps the variable's native
//     scale onto 0..100 before the rating is computed;
//   * the resulting share %.
//
// The sign comes from the formula text (lifted by `extractScoreVars`)
// and is read-only here — the user's authoritative way to express
// direction is the formula itself.
function WeightsSection({
  styles,
  scoreVars,
  weights,
  ranges,
  inputNameSet,
  onChangeWeight,
  onChangeRange,
}: {
  styles: EditorStyles;
  scoreVars: ScoreVar[];
  weights: Record<string, number>;
  ranges: Record<string, VarRange>;
  inputNameSet: Set<string>;
  onChangeWeight: (name: string, weight: number) => void;
  onChangeRange: (name: string, range: VarRange) => void;
}) {
  const totalRaw = scoreVars.reduce(
    (sum, { name }) => sum + (weights[name] ?? DEFAULT_VAR_WEIGHT),
    0,
  );
  return (
    <fieldset style={styles.section}>
      <legend style={styles.sectionLegend}>Component weights & ranges</legend>
      <p style={styles.weightsHelper}>
        For each variable in <code>score = …</code>, set the weight (how
        much it counts) and the [min, max] range (what value on the
        variable&apos;s native scale counts as <em>0</em> and <em>100</em>{" "}
        on the rating). A variable subtracted in the formula{" "}
        (<code>− name</code>) is read as &ldquo;lower is better&rdquo; —
        the system inverts its normalized value before averaging.
      </p>
      {scoreVars.map(({ name, sign }) => {
        const w = weights[name] ?? DEFAULT_VAR_WEIGHT;
        const share = totalRaw === 0 ? 0 : (w / totalRaw) * 100;
        const range = ranges[name] ?? DEFAULT_RANGE;
        const labelStyle = inputNameSet.has(name)
          ? styles.weightsLabelInput
          : styles.weightsLabelComputed;
        return (
          <div key={name} style={styles.weightsRow}>
            <span style={labelStyle} title={name}>
              {sign === -1 && (
                <span style={styles.weightsSignNegative}>−</span>
              )}
              {name}
            </span>
            <input
              type="range"
              className="win2k-slider"
              min={0}
              max={MAX_WEIGHT}
              step={1}
              value={w}
              onChange={(e) => onChangeWeight(name, Number(e.target.value))}
              aria-label={`Weight for ${name}`}
            />
            <span style={styles.weightsRaw}>
              {w} / {MAX_WEIGHT}
            </span>
            <RangeEditor
              styles={styles}
              name={name}
              range={range}
              onChange={(next) => onChangeRange(name, next)}
            />
            <span style={styles.weightsShare}>{share.toFixed(1)}%</span>
          </div>
        );
      })}
    </fieldset>
  );
}

// Two-field [min] – [max] inline editor. Each field commits on blur or
// Enter (instead of every keystroke) so a half-typed number doesn't
// thrash the persisted state mid-edit. Local string state lets the user
// type "-" or "1." without the parent rejecting the partial value.
function RangeEditor({
  styles,
  name,
  range,
  onChange,
}: {
  styles: EditorStyles;
  name: string;
  range: VarRange;
  onChange: (next: VarRange) => void;
}) {
  return (
    <div style={styles.rangeEditor}>
      <RangeField
        styles={styles}
        ariaLabel={`Min for ${name}`}
        value={range.min}
        onCommit={(v) => onChange({ min: v, max: range.max })}
      />
      <span style={styles.rangeDash}>–</span>
      <RangeField
        styles={styles}
        ariaLabel={`Max for ${name}`}
        value={range.max}
        onCommit={(v) => onChange({ min: range.min, max: v })}
      />
    </div>
  );
}

function RangeField({
  styles,
  ariaLabel,
  value,
  onCommit,
}: {
  styles: EditorStyles;
  ariaLabel: string;
  value: number;
  onCommit: (next: number) => void;
}) {
  const formatted = formatRange(value);
  // Uncontrolled input: the field owns its DOM value while the user is
  // typing (so partial inputs like "1." or "-" don't get rejected
  // mid-keystroke), and we read + commit on blur or Enter. The `key`
  // forces a remount when the parent value changes from outside (Reset
  // or programmatic update) so the new value reaches the field —
  // unrelated parent re-renders don't disturb the field because the
  // key is derived from `value` itself, not from a counter.
  const commit = (el: HTMLInputElement) => {
    const n = Number(el.value);
    if (Number.isFinite(n)) {
      onCommit(n);
      // Canonicalise the displayed text so "5.0" reads as "5" after
      // commit. If the user re-focuses, they see the same form the
      // formatter used to write the value back.
      el.value = formatRange(n);
    } else {
      // Revert: parsing failed (empty, "abc", "1..2", etc.). Better
      // than dispatching NaN.
      el.value = formatted;
    }
  };
  return (
    <input
      key={formatted}
      type="text"
      inputMode="decimal"
      defaultValue={formatted}
      onBlur={(e) => commit(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          const target = e.currentTarget;
          commit(target);
          target.blur();
        }
      }}
      style={styles.rangeField}
      aria-label={ariaLabel}
    />
  );
}

function formatRange(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, "");
}

interface ScopeChip {
  name: string;
  value: Value;
  isInput: boolean;
}

function FormulaSection({
  styles,
  formula,
  inputNames,
  onChange,
  formulaError,
  scopeChips,
}: {
  styles: EditorStyles;
  formula: string;
  inputNames: string[];
  onChange: (next: string) => void;
  formulaError: FormulaError | null;
  scopeChips: ScopeChip[];
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const helpBtn = useButtonState();
  return (
    <fieldset style={styles.section}>
      <legend style={styles.sectionLegendRow}>
        Formula
        <button
          type="button"
          {...helpBtn.handlers}
          onClick={() => setHelpOpen((v) => !v)}
          aria-expanded={helpOpen}
          aria-controls="formula-help-panel"
          title={helpOpen ? "Hide formula help" : "Show formula help"}
          style={mergeButtonStyle(
            styles.helpToggle,
            helpBtn.state,
            styles.helpToggleHover,
            styles.helpToggleFocus,
            styles.helpTogglePressed,
          )}
        >
          ?
        </button>
      </legend>

      {helpOpen && <FormulaHelpPanel styles={styles} />}

      <FormulaEditor
        value={formula}
        onChange={onChange}
        inputNames={inputNames}
        styles={styles}
      />

      {/* Error sits directly under the textarea so the eye doesn't have
          to jump down past the legend to find what's wrong. */}
      {formulaError && (
        <pre style={styles.formulaError} role="alert">
          line {formulaError.pos.line}, col {formulaError.pos.col}:{" "}
          {formulaError.message}
        </pre>
      )}

      <SyntaxLegend styles={styles} />

      {scopeChips.length > 0 && (
        <div style={styles.scopeList} aria-label="Live variable values">
          {scopeChips.map((chip) => (
            <span
              key={chip.name}
              style={
                chip.isInput
                  ? styles.scopeChipInput
                  : styles.scopeChipComputed
              }
            >
              {chip.name} = {formatValue(chip.value)}
            </span>
          ))}
        </div>
      )}
    </fieldset>
  );
}

// Inline reference card for the formula DSL. Concise on purpose — the
// full app guide is a separate window in the registry; this panel only
// covers what the user needs to write a working formula in *this* editor.
function FormulaHelpPanel({ styles }: { styles: EditorStyles }) {
  return (
    <div id="formula-help-panel" style={styles.helpPanel} role="region" aria-label="Formula reference">
      <h2 style={styles.helpPanelTitle}>Formula reference</h2>

      <dl style={styles.helpPanelDl}>
        <dt style={styles.helpPanelTerm}>+ - * /</dt>
        <dd style={styles.helpPanelDef}>Standard arithmetic.</dd>

        <dt style={styles.helpPanelTerm}>x - 10%</dt>
        <dd style={styles.helpPanelDef}>
          Calculator-style: subtract 10 percent of x (= x × 0.9). Same
          for <code>x + 10%</code> (= x × 1.1). Standalone <code>10%</code> is
          just 0.1.
        </dd>

        <dt style={styles.helpPanelTerm}>= != &lt; &gt;</dt>
        <dd style={styles.helpPanelDef}>
          Comparisons. <code>=</code> and <code>!=</code> work on any type
          of value (number, true/false, text); <code>&lt;</code> and{" "}
          <code>&gt;</code> are numbers only.
        </dd>

        <dt style={styles.helpPanelTerm}>AND OR</dt>
        <dd style={styles.helpPanelDef}>
          Logical operators. Both short-circuit (the right side is skipped
          when the left already decides the result).
        </dd>

        <dt style={styles.helpPanelTerm}>IF / ELSE / END</dt>
        <dd style={styles.helpPanelDef}>
          Conditional block. The body runs when the condition is true.
          <code> ELSE</code> is optional; <code>END</code> closes the block.
        </dd>

        <dt style={styles.helpPanelTerm}>min max</dt>
        <dd style={styles.helpPanelDef}>
          <code>min(a, b, …)</code> / <code>max(a, b, …)</code> — variadic.
        </dd>

        <dt style={styles.helpPanelTerm}>sqrt abs</dt>
        <dd style={styles.helpPanelDef}>
          <code>sqrt(x)</code> square root, <code>abs(x)</code> absolute value.
        </dd>

        <dt style={styles.helpPanelTerm}>floor ceil round</dt>
        <dd style={styles.helpPanelDef}>Rounding to integer (down / up / nearest).</dd>

        <dt style={styles.helpPanelTerm}>name = ...</dt>
        <dd style={styles.helpPanelDef}>
          Assignment. The left side is the variable name; valid identifiers
          start with a letter or <code>_</code>.
        </dd>

        <dt style={styles.helpPanelTerm}>score = …</dt>
        <dd style={styles.helpPanelDef}>
          Names the variables that <em>compose the rating</em>. Each
          identifier referenced here gets a slider in the section below
          (weight, [min, max] range, share %). The rating is the
          slider-weighted average of those components, each first
          normalized to 0..100 via its range, clamped to 0..100. The
          formula computes components on their natural scale
          (fractions, kWh, true/false) — the range turns natural values
          into rating contributions, so coefficients like <code>0.6 *</code>{" "}
          are <em>not needed</em> and would be ignored.
        </dd>

        <dt style={styles.helpPanelTerm}>+ / − in score</dt>
        <dd style={styles.helpPanelDef}>
          Direction. <code>score = a + b - c</code> means &ldquo;more{" "}
          <code>c</code> drags the rating down&rdquo;: the component
          flagged with <code>−</code> has its normalized value inverted
          (<code>100 - normalized</code>) before averaging. The sliders
          read the sign from the formula and show <code>−</code> next to
          the component name as a reminder.
        </dd>

        <dt style={styles.helpPanelTerm}>score expression shape</dt>
        <dd style={styles.helpPanelDef}>
          For the slider weighting to honour signs, the right-hand side
          of <code>score = …</code> must be a chain of additions and
          subtractions of identifiers (with optional unary <code>−</code>{" "}
          and parens). Anything with <code>*</code>, <code>/</code>, or
          a function call falls back to &ldquo;all components positive&rdquo; —
          the rating is still computed, but every component contributes
          additively regardless of how the formula combines them. Move
          complex math into intermediate computed variables and keep the
          final <code>score = …</code> a clean sum.
        </dd>
      </dl>

      <pre style={styles.helpPanelCode}>
        {`renewable_share = kwh_renewable / kwh_total
reduction = (kwh_previous - kwh_total) / kwh_previous

excellence_bonus = 0
IF renewable_share > 0.7
  excellence_bonus = 1
END

score = renewable_share + reduction + iso_50001 + excellence_bonus`}
      </pre>
    </div>
  );
}

// Highlighted formula editor: a syntax-coloured div under a transparent
// textarea. The textarea drives the height (resize handle works as
// usual) and owns the caret + selection; the overlay is purely visual.
//
// Layered on top: a Copilot-style **inline ghost completion**. While
// the user is typing an identifier, the top matching candidate (from
// `[inputs, computed, keywords, builtins]` ranked in that order) shows
// as muted-grey text directly after the caret, in the same monospace
// font as the textarea so it reads as a continuation of what the user
// just typed. `Tab` accepts (inserts the suggestion suffix at the
// caret); `Esc` dismisses for the current prefix only. Activates only
// while the caret sits at the *end* of an identifier so clicking into
// the middle of a name to fix a typo doesn't drop a ghost the user
// then has to dismiss.
function FormulaEditor({
  value,
  onChange,
  inputNames,
  styles,
}: {
  value: string;
  onChange: (next: string) => void;
  inputNames: string[];
  styles: EditorStyles;
}) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [caret, setCaret] = useState(0);
  // Prefix the user dismissed via Esc — null when nothing is dismissed.
  // Compared against the current prefix so the ghost only stays
  // suppressed for *this exact prefix*; further typing changes the
  // prefix and the ghost reappears.
  const [dismissedPrefix, setDismissedPrefix] = useState<string | null>(null);

  // Set of input names + the current set of assigned (computed) names.
  // Recomputed on every keystroke so a freshly-typed `risk = ...` colours
  // immediately, without waiting for a parse pass.
  const inputSet = useMemo(() => new Set(inputNames), [inputNames]);
  const computedSet = useMemo(
    () => collectAssignmentTargets(value),
    [value],
  );
  const segments = useMemo(
    () => highlight(value, inputSet, computedSet),
    [value, inputSet, computedSet],
  );

  // The identifier under the caret + the source range it occupies.
  // Empty prefix = caret isn't inside an identifier (whitespace, after
  // an operator, inside a number literal). Ghost hides in that case.
  const identAt = useMemo(
    () => getIdentifierAt(value, caret),
    [value, caret],
  );

  // Candidate ordering matters: user-defined names come first so a
  // freshly-added input outranks a built-in that happens to share a
  // prefix. `score` is filtered out — assigning to it is fine but it's
  // never a useful right-hand-side identifier (it's the formula's exit).
  const candidates = useMemo<string[]>(() => {
    const list: string[] = [];
    for (const n of inputNames) list.push(n);
    for (const n of computedSet) {
      if (!inputSet.has(n) && n !== "score") list.push(n);
    }
    for (const k of KEYWORDS) list.push(k);
    for (const b of BUILTIN_FUNCTIONS) list.push(b);
    return list;
  }, [inputNames, computedSet, inputSet]);

  // Single-suggestion ghost: the chars to render after the caret. Null
  // means no ghost — empty prefix, caret in the middle of a name, or
  // the user pressed Esc on this prefix. Cheap loop, intentionally not
  // wrapped in `useMemo` — the React 19 compiler handles the
  // memoization, and a manual `useMemo` here trips
  // `react-hooks/preserve-manual-memoization` because the compiler
  // can't preserve dep-list semantics that mix object access
  // (`identAt.prefix`, `identAt.end`) with closure-over-loop iteration.
  const ghostText: string | null = (() => {
    if (identAt.prefix.length === 0) return null;
    if (caret !== identAt.end) return null;
    if (dismissedPrefix === identAt.prefix) return null;
    const prefixLc = identAt.prefix.toLowerCase();
    for (const c of candidates) {
      const cLc = c.toLowerCase();
      if (cLc.startsWith(prefixLc) && cLc !== prefixLc) {
        // Suffix in the candidate's own case. The user keeps what they
        // typed; only the *missing* characters get inserted on accept.
        return c.slice(identAt.prefix.length);
      }
    }
    return null;
  })();

  const styleForKind: Record<SegmentKind, CSSProperties> = {
    operator: styles.syntaxOperator,
    builtin: styles.syntaxBuiltin,
    literal: styles.syntaxLiteral,
    number: styles.syntaxNumber,
    string: styles.syntaxString,
    input: styles.syntaxInput,
    computed: styles.syntaxComputed,
    score: styles.syntaxScore,
    unknown: styles.syntaxUnknown,
    punct: styles.syntaxPunct,
    plain: styles.syntaxPlain,
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    overlay.scrollTop = e.currentTarget.scrollTop;
    overlay.scrollLeft = e.currentTarget.scrollLeft;
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setCaret(e.target.selectionStart);
    setDismissedPrefix(null);
    onChange(e.target.value);
  };

  // Caret-only updates (arrow keys, click into the textarea) don't
  // change the source, but they do change which identifier is under
  // the caret — re-derive `identAt` by updating `caret`. We
  // deliberately don't reset `dismissedPrefix` here: a caret move that
  // lands back on a dismissed prefix should keep the ghost suppressed;
  // only typing should reopen it.
  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    setCaret(e.currentTarget.selectionStart);
  };

  const acceptGhost = () => {
    if (!ghostText) return;
    const next = value.slice(0, caret) + ghostText + value.slice(caret);
    const newCaret = caret + ghostText.length;
    onChange(next);
    setDismissedPrefix(null);
    // Restore focus + caret after React renders the new value. Without
    // the rAF the textarea's selection range gets clobbered when React
    // commits the new value attribute.
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(newCaret, newCaret);
      setCaret(newCaret);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!ghostText) return;
    if (e.key === "Tab") {
      // Tab on a visible ghost = accept. Tab without a ghost falls
      // through to the browser's default (focus next), which keeps the
      // editor keyboard-navigable when there's nothing to suggest.
      e.preventDefault();
      acceptGhost();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDismissedPrefix(identAt.prefix);
    }
  };

  return (
    <div style={styles.formulaWrapper}>
      <div ref={overlayRef} style={styles.formulaOverlay} aria-hidden>
        {renderSegments(segments, styleForKind)}
      </div>
      {ghostText && (
        // Second overlay paints *only* the ghost. The prefix portion is
        // rendered with `color: transparent` so it occupies the same
        // horizontal space as the real text up to the caret — that's
        // what positions the ghost suffix at exactly the caret's pixel
        // location, with no DOM measurement and no caret-rect math.
        <div style={styles.formulaOverlay} aria-hidden>
          <span style={{ color: "transparent" }}>{value.slice(0, caret)}</span>
          <span style={styles.formulaGhost}>{ghostText}</span>
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onSelect={handleSelect}
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        style={styles.formulaTextarea}
        spellCheck={false}
        aria-label="Formula"
        aria-autocomplete="inline"
      />
    </div>
  );
}

// Render segments. We append a trailing zero-width space if the source
// ends with a newline so the overlay's last (empty) line still occupies
// vertical space — otherwise the overlay would be one line shorter than
// the textarea after the user presses Enter at the end of input.
function renderSegments(
  segments: Segment[],
  styleForKind: Record<SegmentKind, CSSProperties>,
) {
  const lastSegment = segments[segments.length - 1];
  const trailingNewline = lastSegment?.text.endsWith("\n") ?? false;
  return (
    <>
      {segments.map((seg, i) => (
        <span key={i} style={styleForKind[seg.kind]}>
          {seg.text}
        </span>
      ))}
      {trailingNewline && <span>&#8203;</span>}
    </>
  );
}

function SyntaxLegend({ styles }: { styles: EditorStyles }) {
  const items: { kind: SegmentKind; label: string; sample: string }[] = [
    { kind: "operator", label: "operators / keywords", sample: "IF =" },
    { kind: "input", label: "inputs", sample: "kwh_total" },
    { kind: "computed", label: "computed", sample: "renewable_share" },
    { kind: "score", label: "score (output)", sample: "score" },
    { kind: "number", label: "numbers", sample: "42" },
    { kind: "string", label: "strings", sample: '"text"' },
    { kind: "literal", label: "booleans", sample: "TRUE" },
  ];
  const styleByKind: Record<SegmentKind, CSSProperties> = {
    operator: styles.syntaxOperator,
    builtin: styles.syntaxBuiltin,
    literal: styles.syntaxLiteral,
    number: styles.syntaxNumber,
    string: styles.syntaxString,
    input: styles.syntaxInput,
    computed: styles.syntaxComputed,
    score: styles.syntaxScore,
    unknown: styles.syntaxUnknown,
    punct: styles.syntaxPunct,
    plain: styles.syntaxPlain,
  };
  return (
    <div style={styles.syntaxLegend}>
      {items.map((item) => (
        <span key={item.kind} style={styles.syntaxLegendItem}>
          <span
            style={{ ...styles.syntaxLegendSwatch, ...styleByKind[item.kind] }}
          >
            {item.sample}
          </span>
          <span>{item.label}</span>
        </span>
      ))}
    </div>
  );
}

function InputRow({
  input,
  value,
  styles,
  onChangeValue,
  onRemove,
}: {
  input: InputDefinition;
  value: Value | undefined;
  styles: EditorStyles;
  onChangeValue: (value: Value) => void;
  onRemove: () => void;
}) {
  const remove = useButtonState();
  const label = input.label ?? input.name;

  const typeStyle =
    input.type === "number"
      ? styles.inputTypeNumber
      : input.type === "boolean"
        ? styles.inputTypeBoolean
        : styles.inputTypeString;

  return (
    <>
      <div style={styles.inputName} title={input.name}>
        {input.name}
      </div>
      <div style={{ ...styles.inputType, ...typeStyle }}>{input.type}</div>
      <div title={label}>{label}</div>
      <div>
        <ValueField
          type={input.type}
          value={value}
          onChange={onChangeValue}
          styles={styles}
          aria-label={`Value of ${label}`}
        />
      </div>
      <button
        type="button"
        {...remove.handlers}
        onClick={onRemove}
        title={`Remove ${input.name}`}
        aria-label={`Remove ${input.name}`}
        style={mergeButtonStyle(
          styles.removeButton,
          remove.state,
          styles.removeButtonHover,
          styles.removeButtonFocus,
          styles.removeButtonPressed,
        )}
      >
        ×
      </button>
    </>
  );
}

function ValueField({
  type,
  value,
  onChange,
  styles,
  ...rest
}: {
  type: InputType;
  value: Value | undefined;
  onChange: (v: Value) => void;
  styles: EditorStyles;
  "aria-label"?: string;
}) {
  if (type === "boolean") {
    return (
      <input
        type="checkbox"
        checked={value === true}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
        style={styles.checkbox}
        {...rest}
      />
    );
  }
  if (type === "number") {
    return (
      <input
        type="number"
        value={typeof value === "number" ? value : 0}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const n = Number(e.target.value);
          // Reject NaN — the slice's setInputValue would no-op, but better
          // to keep the input visibly stale until the user completes a
          // valid number than to thrash dispatch with NaNs every keystroke.
          if (Number.isFinite(n)) onChange(n);
        }}
        style={styles.numberField}
        {...rest}
      />
    );
  }
  return (
    <input
      type="text"
      value={typeof value === "string" ? value : ""}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      style={styles.textField}
      {...rest}
    />
  );
}

function AddInputForm({
  existingNames,
  styles,
  onAdd,
}: {
  existingNames: string[];
  styles: EditorStyles;
  onAdd: (input: InputDefinition) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<InputType>("number");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const addBtn = useButtonState();

  const validate = (n: string): string | null => {
    const trimmed = n.trim();
    if (trimmed.length === 0) return "Name is required";
    if (!VALID_NAME_RE.test(trimmed))
      return "Only letters, digits and _, must start with a letter or _";
    if (RESERVED_NAMES.has(trimmed.toLowerCase()))
      return `'${trimmed}' is a reserved language keyword`;
    if (existingNames.includes(trimmed))
      return `An input named '${trimmed}' already exists`;
    return null;
  };

  const submit = () => {
    const err = validate(name);
    if (err) {
      setError(err);
      return;
    }
    onAdd({
      name: name.trim(),
      type,
      label: label.trim() || undefined,
    });
    setName("");
    setType("number");
    setLabel("");
    setError(null);
  };

  return (
    <div style={styles.addInputRow}>
      <input
        type="text"
        placeholder="name (e.g. kwh_total)"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        style={styles.addInputName}
        aria-label="New input name"
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value as InputType)}
        style={styles.addInputType}
        aria-label="New input type"
      >
        <option value="number">number</option>
        <option value="boolean">boolean</option>
        <option value="string">string</option>
      </select>
      <input
        type="text"
        placeholder="label (optional)"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        style={styles.addInputLabel}
        aria-label="New input label"
      />
      {/* Value cell. Empty while the form is valid; when validation
          fails, the error message lives here — it's literally the place
          the future input's value will go, so "fix this before there's
          a value here" reads naturally. */}
      {error ? (
        <p style={styles.addInputError} role="alert">
          {error}
        </p>
      ) : (
        <span aria-hidden />
      )}
      <button
        type="button"
        onClick={submit}
        {...addBtn.handlers}
        title="Add input"
        aria-label="Add input"
        style={mergeButtonStyle(
          styles.removeButton,
          addBtn.state,
          styles.removeButtonHover,
          styles.removeButtonFocus,
          styles.removeButtonPressed,
        )}
      >
        +
      </button>
    </div>
  );
}

function ResetButton({
  styles,
  onReset,
}: {
  styles: EditorStyles;
  onReset: () => void;
}) {
  const reset = useButtonState();
  return (
    <button
      type="button"
      onClick={onReset}
      {...reset.handlers}
      style={mergeButtonStyle(
        styles.primaryButton,
        reset.state,
        styles.primaryButtonHover,
        styles.primaryButtonFocus,
        styles.primaryButtonPressed,
      )}
    >
      Reset to defaults
    </button>
  );
}

function mergeButtonStyle(
  base: CSSProperties,
  state: { hover: boolean; focused: boolean; pressed: boolean },
  hover: CSSProperties,
  focus: CSSProperties,
  pressed: CSSProperties,
): CSSProperties {
  return {
    ...base,
    ...(state.hover ? hover : null),
    ...(state.focused ? focus : null),
    ...(state.pressed ? pressed : null),
  };
}

function formatValue(v: Value): string {
  if (typeof v === "number") {
    return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, "");
  }
  if (typeof v === "boolean") return v ? "true" : "false";
  return JSON.stringify(v);
}

