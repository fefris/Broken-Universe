# Broken Universe

A single-player homage to **Shattered Galaxy** (Nexon, 2001) — squad-scale RTS battles
fought over Points of Contention, with AI commanders filling out both your team and
the enemy's, wrapped in a persistent campaign for the planet Calderis.

## Play

```sh
npm install
npm run dev    # open http://localhost:5173
```

**Campaign** (the main mode): your hero commands a persistent army against the Vesper
Dominion. Each turn, assault a frontier province (or defend your own), fight the
battle yourself, and watch your units earn XP and levels. Spend credits in the
**Garage** refitting each unit individually — every owned unit is its own design built
from the chassis + parts system. Rank up your hero and spend attribute points on the
four SG stats: **Tactics** (command points), **Clout** (field/reserve caps, chassis
access), **Education** (tech gate for new parts), **Mechanical Aptitude** (weight
budgets). Brood-infested provinces offer PvE swarm battles; factories cut garage
prices, simulators boost XP. Capture Vesper Keep to win; lose Aurora Bastion and the
campaign ends. Progress saves to localStorage automatically.

**Skirmish**: a one-off battle — pick a side (or spectate an all-AI battle), set
commander counts / difficulty / seed, and hit **Deploy**.

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
- `src/meta` — campaign layer: hero rules/XP, owned-unit profiles (localStorage),
  province map + turn logic, battle outcome application. All pure and unit-tested.
- `src/render`, `src/input`, `src/ui` — PixiJS v8 renderer, RTS controls, HTML HUD,
  and the DOM campaign screens (war map, garage, hero, squad picker, results).
- `data/` — JSON content (chassis, parts, weapons, designs), zod-validated at load.

## Develop

```sh
npm test                        # full suite incl. determinism + headless battles
npm run check                   # biome lint
npm run build                   # type-check + production build
node scripts/smoke.mjs          # battle smoke test (needs dev server running)
node scripts/smoke-campaign.mjs # campaign flow smoke test (uses ?quick=1 battles)

# gated slow reports
$env:BALANCE='1'; npx vitest run tests/balance.test.ts   # win-rate across seeds
$env:DIAG='1';    npx vitest run tests/diag.test.ts      # battle timeline probe
```
