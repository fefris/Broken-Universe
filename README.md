# Broken Universe

A single-player homage to **Shattered Galaxy** (Nexon, 2001) — squad-scale RTS battles
fought over Points of Contention, with AI commanders filling out both your team and
the enemy's.

## Play

```sh
npm install
npm run dev    # open http://localhost:5173
```

Pick a side (or spectate an all-AI battle), set commander counts / difficulty / seed,
and hit **Deploy**.

- **Attackers** win by capturing every Point of Contention (stand in the zone with no
  defenders present until the capture timer fills).
- **Defenders** win by holding at least one PoC for the full 15 minutes.
- You command **one squad** (10 units + reserves). Allied AI commanders fight beside
  you. Reserves can be deployed at your spawn until the final 3 minutes.

### Controls

| Input | Action |
| --- | --- |
| Left-drag / click | Select your units (yours only — this is Shattered Galaxy) |
| Right-click | Move; on an enemy: attack |
| `A` + left-click | Attack-move |
| `S` | Stop |
| `Ctrl+1-9` / `1-9` | Set / recall control group |
| Arrows / middle-drag / minimap | Pan camera |
| Wheel | Zoom |
| Space | Center on selection/squad |

## The faithful part

Units are built with Shattered Galaxy's actual design system, sourced from the
official unit reference: every design is a **chassis** (per-division frames, weight
and space budgets, 10 slots) fitted with an **engine** (power vs. total weight, else
strain), **power supply** (energy pool + recharge that gates weapon fire), **computer**
(complexity budget), **sensors** (extend weapon range), **armor** (class vs. damage
type), and **weapons** (separate ground/air fire modes). The 12 shipped designs are
all built and validated through that pipeline — see `data/` and
`src/sim/unitStats.ts`.

Divisions: **Infantry**, **Mechanized** (SG: Mobile), **Aerial** (Aviation),
**Bioforms** (Organics).

## Architecture

- `src/sim` — headless, deterministic 20 Hz simulation (no pixi imports, enforced by
  test). Seeded RNG + command queue: same seed + same commands = identical battle.
- `src/ai` — utility-scoring AI commanders (objective selection, staging, retreat,
  focus fire, kiting) used by both teams.
- `src/render`, `src/input`, `src/ui` — PixiJS v8 renderer, RTS controls, HTML HUD.
- `data/` — JSON content (chassis, parts, weapons, designs), zod-validated at load.

## Develop

```sh
npm test               # full suite incl. determinism + headless AI-vs-AI battles
npm run check          # biome lint
npm run build          # type-check + production build
node scripts/smoke.mjs # headless browser smoke test (needs dev server running)

# gated slow reports
$env:BALANCE='1'; npx vitest run tests/balance.test.ts   # win-rate across seeds
$env:DIAG='1';    npx vitest run tests/diag.test.ts      # battle timeline probe
```
