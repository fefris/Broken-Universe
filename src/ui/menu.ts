import type { DifficultyLevel } from '../ai/difficulty';
import type { BattleOptions } from '../game/setup';
import { ATTACKER, DEFENDER, type Team } from '../sim/types';

export interface MenuResult {
  options: BattleOptions;
  difficulty: DifficultyLevel;
}

/** Show the battle config screen; resolves when the player hits Deploy. */
export function showMenu(): Promise<MenuResult> {
  const menu = document.getElementById('menu')!;
  menu.style.display = 'flex';
  return new Promise((resolve) => {
    const btn = document.getElementById('btn-start') as HTMLButtonElement;
    btn.onclick = () => {
      const side = (document.querySelector('input[name="side"]:checked') as HTMLInputElement)
        ?.value;
      const playerTeam: Team | null =
        side === 'attacker' ? ATTACKER : side === 'defender' ? DEFENDER : null;
      const allies = Number((document.getElementById('opt-allies') as HTMLInputElement).value);
      const enemies = Number((document.getElementById('opt-enemies') as HTMLInputElement).value);
      const difficulty = (document.getElementById('opt-difficulty') as HTMLSelectElement)
        .value as DifficultyLevel;
      const seedRaw = (document.getElementById('opt-seed') as HTMLInputElement).value.trim();
      const seed = seedRaw ? Number(seedRaw) >>> 0 : (Math.random() * 0xffffffff) >>> 0;

      const attackerCommanders = playerTeam === ATTACKER ? allies : enemies;
      const defenderCommanders = playerTeam === ATTACKER ? enemies : allies;
      menu.style.display = 'none';
      resolve({
        options: {
          seed,
          attackerCommanders: playerTeam === null ? allies : attackerCommanders,
          defenderCommanders: playerTeam === null ? enemies : defenderCommanders,
          playerTeam,
        },
        difficulty,
      });
    };
  });
}
