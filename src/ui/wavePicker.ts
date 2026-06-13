import type { BattleRunner } from '../game/runner';
import { canDeploy } from '../sim/systems/reserves';
import { esc, fromHtml, hideOverlay, showOverlay } from './dom';
import { divisionIcon, icon } from './icons';

/**
 * Mid-battle reinforcement: pick the next wave from the units still in reserve
 * (everything you brought but haven't deployed). Non-blocking — the battle keeps
 * running underneath. Resolves with the chosen ids (deployed in order) or [] if
 * cancelled. Selection is capped to the empty slots in your field (squadCap).
 */
export function showWavePicker(runner: BattleRunner, commanderId: number): Promise<string[]> {
  return new Promise((resolve) => {
    const world = runner.world;
    const commander = world.commanders[commanderId];
    if (!commander) {
      resolve([]);
      return;
    }

    const alive = commander.squad.filter((id) => world.units[id]?.alive).length;
    const slots = Math.max(0, commander.squadCap - alive);
    // Snapshot the reserve pool as { id, count } so duplicate design ids (skirmish)
    // collapse into one selectable row with a quantity.
    const pool = new Map<string, number>();
    for (const id of commander.reserves) pool.set(id, (pool.get(id) ?? 0) + 1);

    const selected: string[] = [];

    const root = fromHtml(`
      <div class="picker wave-picker panel frame cut">
        <h2 class="heading">${icon('defend', { size: 18 })} Deploy Reinforcements</h2>
        <p class="hint">Choose the next wave from your reserves. Up to <b>${slots}</b> can take the field now (the rest stay in reserve). Reinforcements close in the final 3 minutes.</p>
        <div class="picker-status" id="w-status"></div>
        <div class="picker-grid" id="w-grid"></div>
        <div class="picker-actions">
          <button id="w-deploy" class="big">${icon('attack', { size: 16 })} Deploy wave</button>
          <button id="w-cancel" class="secondary">${icon('close', { size: 13 })} Back to battle</button>
        </div>
      </div>
    `);

    const grid = root.querySelector<HTMLElement>('#w-grid')!;
    const status = root.querySelector<HTMLElement>('#w-status')!;
    const deployBtn = root.querySelector<HTMLButtonElement>('#w-deploy')!;

    const countSelected = (id: string) => selected.filter((s) => s === id).length;

    const render = () => {
      grid.innerHTML = '';
      if (pool.size === 0) {
        grid.innerHTML = '<p class="hint">No units left in reserve.</p>';
      }
      for (const [id, total] of pool) {
        const stats = runner.statsFor(id);
        const picked = countSelected(id);
        const card = fromHtml(`
          <div class="p-card cut-sm ${picked > 0 ? 'picked field' : ''}">
            <div class="p-card-top">
              <span class="p-card-div">${divisionIcon(stats.division)}</span>
              <b class="p-card-name">${esc(stats.name)}</b>
              <span class="p-card-role">${picked > 0 ? `x${picked}` : ''}</span>
            </div>
            <div class="p-card-info">
              <span class="p-stat">${icon('credits', { size: 12 })} ${stats.cost}</span>
              <span class="p-stat"><i>avail</i> ${total - picked}/${total}</span>
            </div>
          </div>
        `);
        card.onclick = () => {
          const already = countSelected(id);
          if (already < total && selected.length < slots) {
            selected.push(id);
          } else {
            // Tapping a maxed/again card removes one (toggle down).
            const idx = selected.indexOf(id);
            if (idx >= 0) selected.splice(idx, 1);
          }
          render();
        };
        grid.appendChild(card);
      }
      status.innerHTML = `<span class="chip amber">${icon('faction-player', { size: 13 })} Wave ${selected.length}/${slots}</span>`;
      deployBtn.disabled = selected.length === 0;
    };

    const finish = (ids: string[]) => {
      hideOverlay();
      resolve(ids);
    };

    deployBtn.onclick = () => finish([...selected]);
    root.querySelector<HTMLButtonElement>('#w-cancel')!.onclick = () => finish([]);

    // If reinforcements are closed or the field is full, there's nothing to do.
    if (slots === 0 || pool.size === 0 || !canDeploy(world, commander)) {
      // Still show the panel so the player understands why (read-only).
      render();
      deployBtn.disabled = true;
    } else {
      render();
    }
    showOverlay(root);
  });
}
