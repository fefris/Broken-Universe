import type { AppliedOutcome, BattleSummary } from '../meta/outcome';
import { esc, fromHtml, showOverlay } from './dom';
import { icon } from './icons';

/** Post-battle debrief: per-unit XP, credits, rank-ups. */
export function showResults(
  summary: BattleSummary,
  applied: AppliedOutcome,
  extraLine: string,
): Promise<void> {
  return new Promise((resolve) => {
    const rows = summary.unitOutcomes
      .map((o) => {
        const leveled = o.levelAfter > o.levelBefore;
        return `
        <tr class="${o.survived ? '' : 'dead'} ${leveled ? 'leveled' : ''}">
          <td class="r-unit">${o.survived ? icon('faction-player', { size: 14 }) : icon('close', { size: 14 })}<span>${esc(o.name)}</span></td>
          <td class="r-num">${o.damageDealt}</td>
          <td class="r-num">${o.kills}</td>
          <td class="r-status">${o.survived ? 'Active' : 'Destroyed'}</td>
          <td class="r-num r-xp">+${o.xpGained}</td>
          <td class="r-level">${leveled ? `Lv ${o.levelBefore} <span class="r-arrow">→</span> <b>${o.levelAfter}</b>` : `Lv ${o.levelAfter}`}</td>
        </tr>`;
      })
      .join('');

    const net = summary.creditsEarned - summary.repairCost;
    const root = fromHtml(`
      <div class="results panel frame cut ${summary.won ? 'won' : 'lost'}">
        <div class="results-head">
          <span class="results-crest">${icon(summary.won ? 'faction-player' : 'faction-enemy', { size: 40 })}</span>
          <div>
            <h2 class="${summary.won ? 'victory' : 'defeat'}">${summary.won ? 'VICTORY' : 'DEFEAT'}</h2>
            <p class="hint">${esc(extraLine)}</p>
          </div>
        </div>
        <table class="results-table">
          <thead><tr>
            <th>Unit</th>
            <th class="r-num">${icon('attack', { size: 13 })} Damage</th>
            <th class="r-num">${icon('target', { size: 13 })} Kills</th>
            <th>Status</th>
            <th class="r-num">${icon('xp', { size: 13 })} XP</th>
            <th>${icon('rank', { size: 13 })} Level</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="results-totals well">
          <span class="chip">${icon('credits', { size: 13 })} Earnings ${summary.creditsEarned}</span>
          <span class="chip bad">${icon('credits', { size: 13 })} Repairs −${summary.repairCost}</span>
          <span class="chip ${net >= 0 ? 'good' : 'bad'}"><b>Net ${net >= 0 ? '+' : ''}${net} cr</b></span>
          <span class="chip cyan">${icon('xp', { size: 13 })} Hero +${summary.heroXpGained} XP</span>
          ${applied.ranksGained > 0 ? `<span class="chip amber">${icon('rank', { size: 13 })} <b>RANK UP → ${applied.newRank}</b></span>` : ''}
        </div>
        <button id="r-continue" class="big">${icon('chevron', { size: 16 })} Continue</button>
      </div>
    `);
    root.querySelector<HTMLButtonElement>('#r-continue')!.onclick = () => resolve();
    showOverlay(root);
  });
}

/** Simple notice panel (delegated battles, campaign end). */
export function showNotice(title: string, message: string, button = 'Continue'): Promise<void> {
  return new Promise((resolve) => {
    const root = fromHtml(`
      <div class="results notice panel frame cut">
        <h2 class="heading">${esc(title)}</h2>
        <p class="hint">${esc(message)}</p>
        <button id="n-ok" class="big">${esc(button)}</button>
      </div>
    `);
    root.querySelector<HTMLButtonElement>('#n-ok')!.onclick = () => resolve();
    showOverlay(root);
  });
}
