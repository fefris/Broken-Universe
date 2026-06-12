import type { DifficultyLevel } from '../ai/difficulty';
import type { ContentDB } from '../content/db';
import type { BattleOptions } from '../game/setup';
import { type Profile, type ProfileStore, defaultProfile } from '../meta/profile';
import { ATTACKER, DEFENDER, type Team } from '../sim/types';
import { el } from './dom';

export type TitleChoice =
  | { kind: 'skirmish'; options: BattleOptions; difficulty: DifficultyLevel }
  | { kind: 'campaign'; profile: Profile };

/** Title screen: continue/new campaign, or a quick skirmish. */
export function showTitle(store: ProfileStore, db: ContentDB): Promise<TitleChoice> {
  const menu = el('menu');
  menu.style.display = 'flex';

  const continueBtn = el<HTMLButtonElement>('btn-campaign-continue');
  const existing = store.load();
  continueBtn.disabled = existing === null;
  continueBtn.textContent = existing
    ? `Continue Campaign (${existing.heroName}, turn ${existing.campaign?.turn ?? 1})`
    : 'Continue Campaign';

  return new Promise((resolve) => {
    const done = (choice: TitleChoice) => {
      menu.style.display = 'none';
      continueBtn.onclick = null;
      el('btn-campaign-new').onclick = null;
      el('btn-start').onclick = null;
      resolve(choice);
    };

    continueBtn.onclick = () => {
      const profile = store.load();
      if (profile) done({ kind: 'campaign', profile });
    };

    el('btn-campaign-new').onclick = () => {
      if (existing && !confirm('Start a new campaign? Your current commander will be erased.')) {
        return;
      }
      const profile = defaultProfile(db);
      store.save(profile);
      done({ kind: 'campaign', profile });
    };

    el('btn-start').onclick = () => {
      const side = (document.querySelector('input[name="side"]:checked') as HTMLInputElement)
        ?.value;
      const playerTeam: Team | null =
        side === 'attacker' ? ATTACKER : side === 'defender' ? DEFENDER : null;
      const allies = Number(el<HTMLInputElement>('opt-allies').value);
      const enemies = Number(el<HTMLInputElement>('opt-enemies').value);
      const difficulty = el<HTMLSelectElement>('opt-difficulty').value as DifficultyLevel;
      const seedRaw = el<HTMLInputElement>('opt-seed').value.trim();
      const seed = seedRaw ? Number(seedRaw) >>> 0 : (Math.random() * 0xffffffff) >>> 0;
      done({
        kind: 'skirmish',
        options: {
          seed,
          attackerCommanders: playerTeam === DEFENDER ? enemies : allies,
          defenderCommanders: playerTeam === DEFENDER ? allies : enemies,
          playerTeam,
        },
        difficulty,
      });
    };
  });
}
