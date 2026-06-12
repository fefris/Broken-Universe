import { AICommander } from '../ai/commander';
import { DIFFICULTIES, type DifficultyLevel } from '../ai/difficulty';
import type { Command } from '../sim/commands';
import type { SimEvent } from '../sim/events';
import { deriveSeed } from '../sim/rng';
import type { World } from '../sim/types';
import type { BattleConfig } from '../sim/world';
import { createBattle, tick } from '../sim/world';

/**
 * Owns the world plus its AI controllers and the player's command queue.
 * step() advances exactly one sim tick; the caller (render loop or test)
 * controls pacing.
 */
export class BattleRunner {
  readonly world: World;
  private readonly ais: AICommander[] = [];
  private readonly pending: Command[] = [];
  private readonly resolve: BattleConfig['resolve'];

  constructor(config: BattleConfig, difficulty: DifficultyLevel) {
    this.world = createBattle(config);
    this.resolve = config.resolve;
    const profile = DIFFICULTIES[difficulty];
    for (const commander of this.world.commanders) {
      if (commander.isPlayer) continue;
      this.ais.push(new AICommander(commander.id, profile, deriveSeed(config.seed, commander.id)));
    }
  }

  enqueue(command: Command): void {
    this.pending.push(command);
  }

  /** Advance one tick; returns the events the tick produced. */
  step(): readonly SimEvent[] {
    if (this.world.result) return [];
    const commands = this.pending.splice(0);
    for (const ai of this.ais) {
      commands.push(...ai.update(this.world));
    }
    tick(this.world, commands, this.resolve);
    return this.world.events;
  }
}
