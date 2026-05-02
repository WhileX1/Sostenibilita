# Sostenibilità

Self-assessment ESG per PMI italiane in stile **Windows 2000**. Compila i 15 indicatori ESRS (E1–E5, S1–S4, G1), modifica le formule con un piccolo DSL custom, ottieni un rating ESG 0–100 e stampa la dichiarazione di sostenibilità in formato CSRD.

Progetto scolastico — non sostituisce una dichiarazione CSRD ufficiale ai sensi della Direttiva (UE) 2022/2464.

## Avvio rapido

```bash
npm install
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000).

Altri comandi:

```bash
npm run build            # build di produzione
npm run start            # serve la build
npm run lint             # ESLint
npx tsx lib/formula/smoke.mts   # 47 smoke test del DSL
```

## Cosa fa

- **15 metriche ESG** seedate per una PMI italiana di manifattura leggera (~50 dipendenti, ~1.5 M€). Ognuna è ancorata allo standard ESRS corrispondente e, dove rilevante, a riferimenti normativi italiani (D.Lgs. 231/2001, D.Lgs. 24/2023, D.Lgs. 81/08, Legge Golfo-Mosca, Codice Autodisciplina).
- **Editor di metrica** con formula in DSL, slider di peso e range di giudizio per ogni componente — l'utente può ritarare ogni indicatore senza toccare il codice.
- **Strategy** per la materialità cross-metrica: uno slider 0–10 per ogni indicatore, con quote normalizzate live.
- **Rating ESG** aggregato (overall + sotto-score Environmental / Social / Governance) e **Reporting CSRD** stampabile in PDF.
- **Materiality switch** per metrica: chi non valuta un'area deve dichiararne il motivo, come richiesto dal framework.
- **Shell Win2K**: desktop con icone, taskbar, Start menu, finestra centrata o massimizzata, persistenza in `localStorage`.

## Stack

- [Next.js 16](https://nextjs.org) (App Router) + React 19 + TypeScript
- Redux Toolkit per lo stato globale (windows, esg, metrics, desktopIcons)
- Tailwind 4 + theme tokens custom per la palette Win2K
- DSL parser/evaluator scritto a mano, **zero dipendenze runtime esterne** per la formula

## Architettura

La documentazione tecnica vive sotto [`docs/`](./docs):

| Documento | Cosa copre |
| --- | --- |
| [`architecture/scoring.md`](./docs/architecture/scoring.md) | Modello a tre livelli: componenti → materialità → ESG aggregato. Stato, reducer, persistenza, seed catalogue. |
| [`architecture/formula-dsl.md`](./docs/architecture/formula-dsl.md) | Linguaggio della formula: tipi, operatori, percentuali calcolatrice, built-in, errori. |
| [`architecture/window-manager.md`](./docs/architecture/window-manager.md) | Slice windows, registry, deep-link routing, single-foreground render. |
| [`architecture/shell.md`](./docs/architecture/shell.md) | Layout root, zoom, user-select, flusso eventi della shell. |
| [`components/`](./docs/components) | Desktop, icone, bottombar, Start menu. |
| [`themes/`](./docs/themes) | Sistema di theming (preset Win2K, override per pagina). |
| [`project/objective.yaml`](./docs/project/objective.yaml) | Tassonomia ESG di partenza. |

## Struttura della repo

```
web/
├─ app/                  Routes Next.js (una per finestra) + layout root
├─ components/
│  ├─ layout/            Desktop, Window, Bottombar, StartMenu
│  ├─ metricEditor/      Editor generico per ogni metrica scored
│  └─ pages/             Wrapper per area: environmental/, social/, governance/, objective/
├─ lib/
│  ├─ formula/           Tokenizer, parser, evaluator, highlighter del DSL (+ smoke test)
│  ├─ scoring/           computeMetricRating, ratingFromEval, config
│  ├─ themes/            Tokens + preset
│  └─ windows/           Registry e mount hook
├─ store/                Redux: slices, persist, hooks
├─ public/icons/         SVG per finestre e aree
└─ docs/                 Documentazione tecnica (vedi sopra)
```

Aggiungere una nuova finestra è una ricetta in 4 passi documentata in [`docs/architecture/window-manager.md`](./docs/architecture/window-manager.md#the-registry-contract).

## Scorciatoie

- Doppio clic su un'icona del desktop → apre la finestra
- Click sul pulsante taskbar attivo → minimizza
- **Esc** dentro una finestra → minimizza (la finestra resta aperta sulla taskbar)
- Pulsante "Print / Save as PDF" in Reporting CSRD → esporta la dichiarazione

## Limiti noti

- Nessun autocomplete nella textarea della formula (gli helper esistono già in `lib/formula/suggest.ts`).
- Valori solo per l'anno corrente (no dati storici, no trend YoY).
- Nessun preset di materialità per settore — i pesi sono sector-agnostic by design.
- Nessuna narrativa modificabile nel report CSRD: il testo è generato automaticamente dai valori.
