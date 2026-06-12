import type { AppliedOutcome, BattleSummary } from '../meta/outcome';
import { esc, fromHtml, showOverlay } from './dom';

/** Post-battle debrief: per-unit XP, credits, rank-ups. */
export function showResults(
  summary: BattleSummary,
  applied: AppliedOutcome,
  extraLine: string,
): Promise<void> {
  return new Promise((resolve) => {
    const rows = summary.unitOutcomes
      .map(
        (o) => `
        <tr class="${o.survived ? '' : 'dead'}">
          <td>${esc(o.name)}</td>
          <td>${o.damageDealt}</td>
          <td>${o.kills}</td>
          <td>${o.survived ? '—' : 'destroyed'}</td>
          <td>+${o.xpGained}</td>
          <td>${o.levelAfter > o.levelBefore ? `Lv ${o.levelBefore} → <b>${o.levelAfter}</b>` : `Lv ${o.levelAfter}`}</td>
        </tr>`,
      )
      .join('');

    const net = summary.creditsEarned - summary.repairCost;
    const root = fromHtml(`
      <div class="results">
        <h2 class="${summary.won ? 'victory' : 'defeat'}">${summary.won ? 'VICTORY' : 'DEFEAT'}</h2>
        <p class="hint">${esc(extraLine)}</p>
        <table class="results-table">
          <thead><tr><th>Unit</th><th>Damage</th><th>Kills</th><th>Status</th><th>XP</th><th>Level</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="results-totals">
          <span>Earnings ${summary.creditsEarned} cr</span>
          <span>Repairs −${summary.repairCost} cr</span>
          <span><b>Net ${net >= 0 ? '+' : ''}${net} cr</b></span>
          <span>Hero +${summary.heroXpGained} XP${applied.ranksGained > 0 ? ` · <b>RANK UP → ${applied.newRank}!</b>` : ''}</span>
        </div>
        <button id="r-continue" class="big">Continue</button>
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
      <div class="results">
        <h2>${esc(title)}</h2>
        <p>${esc(message)}</p>
        <button id="n-ok" class="big">${esc(button)}</button>
      </div>
    `);
    root.querySelector<HTMLButtonElement>('#n-ok')!.onclick = () => resolve();
    showOverlay(root);
  });
}
