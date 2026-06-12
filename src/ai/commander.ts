import type { Command } from '../sim/commands';
import { spawnZoneFor } from '../sim/map/maps';
import { type Rng, createRng } from '../sim/rng';
import { bestRangeAgainst } from '../sim/systems/movement';
import { canDeploy } from '../sim/systems/reserves';
import {
  ATTACKER,
  type Commander,
  type CommanderIntent,
  type UnitState,
  type Vec2,
  type World,
  dist,
  domainOf,
} from '../sim/types';
import type { DifficultyProfile } from './difficulty';

const POC_INFLUENCE_RADIUS = 50;
const FOCUS_RANGE = 30;
const KITE_DISTANCE = 4;

/** Cost-weighted fighting strength, discounted as a unit loses health. */
function combatPower(unit: UnitState): number {
  return unit.stats.cost * (0.3 + 0.7 * (unit.hp / unit.stats.maxHealth));
}

interface ScoredIntent {
  intent: CommanderIntent;
  goal: Vec2;
  score: number;
}

/**
 * One utility-scoring AI per non-player commander, for both teams.
 * Reads world state, emits the same commands a player could issue.
 * Kiting writes unit.microGoal directly (deterministic: fixed call order,
 * own seeded rng).
 */
export class AICommander {
  private readonly rng: Rng;
  private lastDecisionTick = -1;

  constructor(
    readonly commanderId: number,
    private readonly profile: DifficultyProfile,
    seed: number,
  ) {
    this.rng = createRng(seed);
  }

  update(world: World): Command[] {
    const commander = world.commanders[this.commanderId];
    if (!commander || world.result) return [];

    const commands: Command[] = [];
    const myUnits = commander.squad
      .map((id) => world.units[id])
      .filter((u): u is UnitState => u?.alive === true);

    // Micro runs on a fast cadence, staggered per commander.
    if ((world.tick + this.commanderId * 3) % 5 === 0 && myUnits.length > 0) {
      this.micro(world, commander, myUnits, commands);
    }

    // Intent decisions on the slow cadence.
    const interval = this.profile.decisionIntervalTicks;
    if ((world.tick + this.commanderId * 7) % interval !== 0) return commands;
    if (world.tick === this.lastDecisionTick) return commands;
    this.lastDecisionTick = world.tick;

    // Reinforce whenever a slot is free (difficulty may hesitate).
    if (canDeploy(world, commander) && this.rng.next() >= this.profile.deploySkipChance) {
      const designId = commander.reserves[0];
      if (designId) commands.push({ type: 'deploy', commanderId: commander.id, designId });
    }

    if (myUnits.length === 0) return commands;

    const choice = this.chooseIntent(world, commander, myUnits);
    if (choice) {
      commander.intent = choice.intent;
      const unitIds = myUnits.map((u) => u.id);
      commands.push({
        type: choice.intent.kind === 'retreat' ? 'move' : 'attackMove',
        commanderId: commander.id,
        unitIds,
        goal: choice.goal,
      });
    }
    return commands;
  }

  private chooseIntent(
    world: World,
    commander: Commander,
    myUnits: UnitState[],
  ): ScoredIntent | null {
    const centroid = { x: 0, y: 0 };
    for (const u of myUnits) {
      centroid.x += u.pos.x;
      centroid.y += u.pos.y;
    }
    centroid.x /= myUnits.length;
    centroid.y /= myUnits.length;

    const candidates: ScoredIntent[] = [];
    const isAttacker = commander.team === ATTACKER;

    for (const poc of world.pocs) {
      const relevant = isAttacker ? poc.owner !== commander.team : poc.owner === commander.team;
      if (!relevant) continue;

      let friendly = 0;
      let enemy = 0;
      for (const u of world.units) {
        if (!u.alive) continue;
        if (dist(u.pos, poc.pos) > POC_INFLUENCE_RADIUS) continue;
        if (u.team === commander.team) friendly += combatPower(u);
        else enemy += combatPower(u);
      }

      let score = 100;
      // Urgency: a PoC mid-capture matters to both sides.
      score += (poc.progress / poc.captureTicks) * 80;
      score -= dist(centroid, poc.pos) * 0.3;
      const advantage = (friendly + 1) / (enemy + 1);
      score += Math.max(-60, Math.min(40, (advantage - 1) * 40));
      // Defenders prioritize zones with enemies bearing down on them.
      if (!isAttacker && enemy > 0) score += 50;
      // Spread the team: penalize objectives teammates already took.
      for (const other of world.commanders) {
        if (other.id === commander.id || other.team !== commander.team) continue;
        if (other.intent && other.intent.pocId === poc.id) score -= 25;
      }
      if (
        commander.intent &&
        commander.intent.pocId === poc.id &&
        commander.intent.kind !== 'retreat'
      ) {
        score *= 1.2;
      }
      score *= 1 + this.rng.range(-this.profile.scoreNoise, this.profile.scoreNoise);

      // Attackers mass at a staging point short of a defended PoC instead of
      // trickling in. Staged units sit inside the influence radius, so once
      // enough force gathers, `friendly` overtakes `enemy` and the goal
      // flips to the PoC itself.
      let goal = { ...poc.pos };
      if (isAttacker && enemy > friendly * 0.9) {
        const zone = spawnZoneFor(world.spawnZones, commander.team);
        const dx = zone.center.x - poc.pos.x;
        const dy = zone.center.y - poc.pos.y;
        const d = Math.hypot(dx, dy);
        if (d > 1) {
          const stage = poc.radius + 22;
          goal = { x: poc.pos.x + (dx / d) * stage, y: poc.pos.y + (dy / d) * stage };
        }
      }

      candidates.push({
        intent: { kind: isAttacker ? 'attackPoc' : 'defendPoc', pocId: poc.id },
        goal,
        score,
      });
    }

    // Retreat when mauled and locally outgunned.
    const avgHp = myUnits.reduce((sum, u) => sum + u.hp / u.stats.maxHealth, 0) / myUnits.length;
    if (avgHp < 0.35) {
      let localFriendly = 0;
      let localEnemy = 0;
      for (const u of world.units) {
        if (!u.alive || dist(u.pos, centroid) > 40) continue;
        if (u.team === commander.team) localFriendly += combatPower(u);
        else localEnemy += combatPower(u);
      }
      if (localEnemy > localFriendly * 1.2) {
        // Fall back to the nearest friendly-held PoC; only run all the way
        // home when nothing is held (a death march never rejoins the fight).
        const owned = world.pocs.filter((p) => p.owner === commander.team);
        let goal = { ...spawnZoneFor(world.spawnZones, commander.team).center };
        let bestD = Number.POSITIVE_INFINITY;
        for (const p of owned) {
          const d = dist(centroid, p.pos);
          if (d < bestD) {
            bestD = d;
            goal = { ...p.pos };
          }
        }
        candidates.push({
          intent: { kind: 'retreat', pocId: -1 },
          goal,
          score: 150,
        });
      }
    }

    if (candidates.length === 0) return null;
    let best = candidates[0]!;
    for (const c of candidates) {
      if (c.score > best.score) best = c;
    }
    return best;
  }

  private micro(
    world: World,
    commander: Commander,
    myUnits: UnitState[],
    commands: Command[],
  ): void {
    // Squad focus fire: fastest expected kill among enemies near the squad.
    if (this.profile.focusFireEnabled) {
      const centroid = myUnits[0]!.pos;
      let bestId = -1;
      let bestScore = Number.POSITIVE_INFINITY;
      for (const u of world.units) {
        if (!u.alive || u.team === commander.team) continue;
        const d = dist(u.pos, centroid);
        if (d > FOCUS_RANGE) continue;
        const score = u.hp + u.stats.armor * 30 + d * 8;
        if (score < bestScore) {
          bestScore = score;
          bestId = u.id;
        }
      }
      if (bestId !== commander.focusTargetId) {
        commands.push({ type: 'setFocusTarget', commanderId: commander.id, targetId: bestId });
      }
    }

    // Cooldown kiting: ranged units step away while their gun reloads.
    if (this.profile.kitingEnabled) {
      for (const unit of myUnits) {
        if (unit.microGoal) continue;
        const target = unit.targetId >= 0 ? world.units[unit.targetId] : undefined;
        if (!target?.alive) continue;
        const range = bestRangeAgainst(unit, domainOf(target));
        if (range === null || range < 8) continue;
        const maxCd = Math.max(...unit.weaponCooldowns, 0);
        if (maxCd < 6) continue;
        const d = dist(unit.pos, target.pos);
        if (d > range * 0.6 || target.stats.speed > unit.stats.speed * 1.05) continue;
        const away = {
          x: unit.pos.x + ((unit.pos.x - target.pos.x) / d) * KITE_DISTANCE,
          y: unit.pos.y + ((unit.pos.y - target.pos.y) / d) * KITE_DISTANCE,
        };
        unit.microGoal = away;
        unit.microUntilTick = world.tick + maxCd;
      }
    }
  }
}
