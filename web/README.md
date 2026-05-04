# Sostenibilità

ESG self-assessment for Italian SMEs in **Windows 2000** style. Fill in 15 ESRS indicators (E1–E5, S1–S4, G1), edit the formulas with a small custom DSL, get a 0–100 ESG rating, and print the sustainability statement in CSRD format.

School project — does not replace an official CSRD statement under Directive (EU) 2022/2464.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Other commands:

```bash
npm run build            # production build
npm run start            # serve the build
npm run lint             # ESLint
npx tsx lib/formula/smoke.mts   # 52 DSL smoke tests
```

## What it does

- **15 ESG metrics** seeded for an Italian light-manufacturing SME (~50 employees, ~1.5 M€ revenue). Each is anchored to the corresponding ESRS standard and, where relevant, to Italian regulatory references (D.Lgs. 231/2001, D.Lgs. 24/2023, D.Lgs. 81/08, Legge Golfo-Mosca, Codice Autodisciplina).
- **Metric editor** with a DSL formula, weight sliders, and a judgement range for each component — the user can re-tune any indicator without touching code.
- **Strategy** for cross-metric materiality: a 0–10 slider per indicator with live-normalised shares.
- Aggregated **ESG rating** (overall + Environmental / Social / Governance sub-scores) and printable **CSRD reporting** as PDF.
- Per-metric **materiality switch**: anyone who doesn't assess a topic must declare why, as the framework requires.
- **Win2K shell**: desktop with icons, taskbar, Start menu, centered or maximized window, persistence in `localStorage`.

## Stack

- [Next.js 16](https://nextjs.org) (App Router) + React 19 + TypeScript
- Redux Toolkit for global state (windows, esg, metrics, desktopIcons)
- Tailwind 4 + custom theme tokens for the Win2K palette
- Hand-written DSL parser/evaluator, **zero external runtime dependencies** for the formula

## Architecture

Technical docs live under [`docs/`](./docs):

| Document | What it covers |
| --- | --- |
| [`architecture/scoring.md`](./docs/architecture/scoring.md) | Three-layer model: components → materiality → aggregated ESG. State, reducer, persistence, seed catalogue. |
| [`architecture/formula-dsl.md`](./docs/architecture/formula-dsl.md) | Formula language: types, operators, calculator-style percent, built-ins, errors. |
| [`architecture/window-manager.md`](./docs/architecture/window-manager.md) | Windows slice, registry, deep-link routing, single-foreground render. |
| [`architecture/shell.md`](./docs/architecture/shell.md) | Root layout, zoom, user-select, first-paint discipline. |
| [`components/`](./docs/components) | Desktop, icons, bottombar, Start menu. |
| [`themes/`](./docs/themes) | Theming system (Win2K preset, per-page overrides). |

## Repo structure

```
web/
├─ app/                  Next.js routes (one per window) + root layout
├─ components/
│  ├─ layout/            Desktop, Window, Bottombar, StartMenu
│  ├─ metricEditor/      Generic editor for every scored metric
│  └─ pages/             Per-area wrappers: environmental/, social/, governance/, objective/
├─ lib/
│  ├─ formula/           DSL tokenizer, parser, evaluator, highlighter (+ smoke tests)
│  ├─ scoring/           computeMetricRating, ratingFromEval, config
│  ├─ themes/            Tokens + presets
│  └─ windows/           Registry and mount hook
├─ store/                Redux: slices, persist, hooks
├─ public/icons/         SVGs for windows and areas
└─ docs/                 Technical documentation (see above)
```

Adding a new window is a 4-step recipe documented in [`docs/architecture/window-manager.md`](./docs/architecture/window-manager.md#the-registry-contract).

## Shortcuts

- Double-click a desktop icon → opens the window
- Click the active taskbar button → minimize
- **Esc** inside a window → minimize (the window stays open on the taskbar)
- "Print / Save as PDF" button in CSRD reporting → exports the statement

## Known limits

- Current-year values only (no historical data, no YoY trends).
- No sector-specific materiality presets — weights are sector-agnostic by design.
- No editable narrative in the CSRD report: the text is generated automatically from the values.
