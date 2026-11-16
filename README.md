# Vyralink + Creator Hub — LIVE Commerce Blueprint (generator)

Source for the design canvas at https://claude.ai/artifact/U1Tg5eQp1FY9uAq7CC12yS
(slug `dab72ea0-0d28-4994-b401-a4b04c363dfd`).

- `project/` — every file on the canvas: `canvas.json` (board index) and the `.dc.html` artboards, plus `handoff/handoff.json` and `handoff/handoff.csv`.
- `scripts/` — the Node generators that wrote them (no dependencies, Node 22+).
- `api/` — the MVP backend (123 endpoints) built from the blueprint. See `api/README.md`.

## Scripts

| Script | Writes |
|---|---|
| `lib.mjs` | Shared grayscale wireframe pieces (buttons, fields, tables, chips, state panels…) |
| `gen.mjs` | Batch 1: `Main`, `IA`, `MasterFlow`, `brand/B01–B18`, and a **fresh** `canvas.json` |
| `gen2.mjs` | Batch 2: `creator/` (C01–C27 mobile, More menu, 3 desktop variants) |
| `gen3.mjs` | Batch 3: `ops/` (O01–O24, O12 tablet) |
| `gen4.mjs` | Batch 4: `fin/` (F01–F08), `admin/` (A01–A12), `brand/M01`; re-links earlier boards |
| `gen5.mjs` | Batch 5: `flows/` (BF01–BF21), `journeys/` (J1–J8), `edge/` |
| `gen6.mjs` | Batch 6: `library/` (components, QA audit), `handoff/` (H01–H09 + JSON/CSV) — reads all other boards |
| `publish-list.cjs` | Turns a `batchN-files.json` into the file list for a publish call |

Run from this folder, passing the folder that holds `project/`:

```
node scripts/gen2.mjs .
```

Batches 2–6 **merge** into the existing `project/canvas.json`, so run them in order. `gen6.mjs` derives the handoff from the other boards, so re-run it last after any change.

## Cautions

- `gen.mjs` rebuilds `canvas.json` from scratch and overwrites `Main.dc.html`. Only run it for a full rebuild, then run gen2–gen6 after it.
- `Main.dc.html` (read-me board) was edited directly on the canvas after Batch 1; the copy here has the same edits applied, so `gen.mjs` would overwrite them.

## Viewing locally

Open `project/Main.dc.html` in a browser. The boards are plain HTML with inline styles, and links between boards work from the folder. Flowcharts and journeys are wide; zoom out to see them whole.
- Before republishing anything, check whether someone edited the canvas since (the publish needs the live version id and is refused otherwise).
