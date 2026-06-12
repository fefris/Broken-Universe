import type { ContentDB } from '../content/db';
import type { ChassisDef, PartDef, UnitDesign } from '../content/schema';
import { type CampaignState, priceMult } from '../meta/campaign';
import type { OwnedUnit, Profile, ProfileStore } from '../meta/profile';
import { ownedToDesign, profileRank } from '../meta/profile';
import { SELL_FRACTION, chassisGate, maxWeightMult, techGate } from '../meta/rules';
import { unitLevel, unitXpForLevel } from '../meta/xp';
import { designCost, resolveUnit, validateDesign } from '../sim/unitStats';
import { esc, fromHtml } from './dom';

const KIND_LABELS: Record<string, string> = {
  engine: 'Engine',
  powerSupply: 'Power Supply',
  computer: 'Computer',
  sensor: 'Sensor',
  armor: 'Armor',
  weapon: 'Weapon',
  misc: 'Equipment',
};

function draftDesign(unit: OwnedUnit, partIds: string[]): UnitDesign {
  return { id: unit.uid, name: unit.name, chassisId: unit.chassisId, partIds };
}

/** Cheapest functional loadout for a chassis: engine, computer, weapon, power. */
export function autoKit(chassis: ChassisDef, db: ContentDB): string[] {
  const cheapest = (filter: (p: PartDef) => boolean): PartDef | null => {
    let best: PartDef | null = null;
    for (const p of db.allParts) {
      if (!filter(p)) continue;
      if (!best || p.cost < best.cost) best = p;
    }
    return best;
  };
  const wantBio = chassis.bodyType === 'biological';
  const engine = cheapest((p) => p.kind === 'engine' && p.biodrive === wantBio);
  const computer = cheapest((p) => p.kind === 'computer');
  const weapon = cheapest((p) => p.kind === 'weapon' && p.frames.includes(chassis.frame));
  const parts = [engine, computer, weapon].filter((p): p is PartDef => p !== null);
  if (weapon && weapon.kind === 'weapon' && weapon.energyPerShot > 0) {
    const supply = cheapest((p) => p.kind === 'powerSupply');
    if (supply) parts.push(supply);
  }
  return parts.map((p) => p.id);
}

export function renderGarage(
  body: HTMLElement,
  profile: Profile,
  campaign: CampaignState,
  db: ContentDB,
  store: ProfileStore,
  refreshHeader: () => void,
): void {
  let selectedUid = profile.units[0]?.uid ?? null;
  let draft: string[] = [];
  const priceFactor = priceMult(campaign);

  const view = fromHtml(`
    <div class="garage">
      <div class="garage-roster">
        <div class="garage-roster-list" id="g-roster"></div>
        <div class="garage-buy">
          <select id="g-chassis"></select>
          <button id="g-buy">Commission</button>
        </div>
      </div>
      <div class="garage-editor" id="g-editor"></div>
    </div>
  `);
  body.appendChild(view);
  const rosterEl = view.querySelector<HTMLElement>('#g-roster')!;
  const editorEl = view.querySelector<HTMLElement>('#g-editor')!;

  const selected = (): OwnedUnit | null => profile.units.find((u) => u.uid === selectedUid) ?? null;

  const renderRoster = () => {
    rosterEl.innerHTML = '';
    for (const unit of profile.units) {
      const chassis = db.chassis(unit.chassisId);
      const row = fromHtml(`
        <div class="g-row ${unit.uid === selectedUid ? 'selected' : ''}">
          <span class="g-row-name">${esc(unit.name)}</span>
          <span class="g-row-info">Lv ${unitLevel(unit.xp)} · ${esc(chassis?.name ?? '?')}</span>
        </div>
      `);
      row.onclick = () => {
        selectedUid = unit.uid;
        draft = [...unit.partIds];
        renderRoster();
        renderEditor();
      };
      rosterEl.appendChild(row);
    }
  };

  const renderBuy = () => {
    const sel = view.querySelector<HTMLSelectElement>('#g-chassis')!;
    const gate = chassisGate(profileRank(profile), profile.attributes);
    sel.innerHTML = db.allChassis
      .map((c) => {
        const kit = autoKit(c, db);
        const price = Math.ceil(
          designCost(
            draftDesign({ uid: 'new', name: c.name, chassisId: c.id, partIds: kit, xp: 0 }, kit),
            db,
          ) * priceFactor,
        );
        const locked = c.techLevel > gate;
        return `<option value="${c.id}" ${locked ? 'disabled' : ''}>${esc(c.name)} — ${price} cr${locked ? ` (needs influence ${c.techLevel})` : ''}</option>`;
      })
      .join('');
    view.querySelector<HTMLButtonElement>('#g-buy')!.onclick = () => {
      const chassis = db.chassis(sel.value);
      if (!chassis || chassis.techLevel > gate) return;
      const kit = autoKit(chassis, db);
      const design = draftDesign(
        { uid: 'new', name: chassis.name, chassisId: chassis.id, partIds: kit, xp: 0 },
        kit,
      );
      const price = Math.ceil(designCost(design, db) * priceFactor);
      if (profile.credits < price) {
        alert(`Not enough credits (${price} cr).`);
        return;
      }
      profile.credits -= price;
      const unit: OwnedUnit = {
        uid: `u${profile.nextUid++}`,
        name: chassis.name.replace(/ (Frame|Chassis|Airframe|Husk)$/, ''),
        chassisId: chassis.id,
        partIds: kit,
        xp: 0,
      };
      profile.units.push(unit);
      selectedUid = unit.uid;
      draft = [...unit.partIds];
      store.save(profile);
      refreshHeader();
      renderRoster();
      renderEditor();
    };
  };

  const renderEditor = () => {
    const unit = selected();
    if (!unit) {
      editorEl.innerHTML = '<p class="hint">No units owned. Commission one on the left.</p>';
      return;
    }
    const chassis = db.chassis(unit.chassisId);
    if (!chassis) return;
    const level = unitLevel(unit.xp);
    const gate = techGate(level, profile.attributes);
    const mods = { maxWeightMult: maxWeightMult(profile.attributes) };
    const design = draftDesign(unit, draft);
    const issues = validateDesign(design, db, mods);
    const errors = issues.filter((i) => i.severity === 'error');
    const valid = errors.length === 0;

    const oldCost = designCost(ownedToDesign(unit), db);
    const newCost = designCost(design, db);
    const delta = newCost - oldCost;
    const price = delta > 0 ? Math.ceil(delta * priceFactor) : -Math.floor(-delta * SELL_FRACTION);
    const dirty = JSON.stringify(draft) !== JSON.stringify(unit.partIds);

    const parts = draft.map((id) => db.part(id)).filter((p): p is PartDef => p !== undefined);
    const weight = parts.reduce((s, p) => s + p.weight, 0);
    const space = parts.reduce((s, p) => s + p.space, 0);
    const cx = parts.filter((p) => p.kind !== 'computer').reduce((s, p) => s + p.complexity, 0);
    const computer = parts.find((p) => p.kind === 'computer');
    const engine = parts.find((p) => p.kind === 'engine');
    const weightBudget = Math.round(chassis.maxWeight * mods.maxWeightMult);
    const totalWeight = chassis.unitWeight + weight;

    const partRows = draft
      .map((id, index) => {
        const p = db.part(id);
        if (!p) return '';
        return `
          <div class="g-part">
            <span class="g-part-kind">${KIND_LABELS[p.kind]}</span>
            <span class="g-part-name">${esc(p.name)} <i>T${p.techLevel}</i></span>
            <span class="g-part-cost">${p.cost} cr</span>
            <button class="g-part-remove" data-index="${index}">✕</button>
          </div>`;
      })
      .join('');

    const addable = db.allParts
      .filter((p) => p.kind !== 'weapon' || p.frames.includes(chassis.frame))
      .map((p) => {
        const locked = p.techLevel > gate;
        return `<option value="${p.id}" ${locked ? 'disabled' : ''}>${KIND_LABELS[p.kind]}: ${esc(p.name)} (T${p.techLevel}, ${p.cost} cr)${locked ? ' 🔒' : ''}</option>`;
      })
      .join('');

    let statsHtml = '';
    if (valid) {
      const r = resolveUnit(design, db, mods);
      const weaponLines = r.weapons
        .map((w) => {
          const g = w.ground ? `G ${w.ground.damage}/${w.ground.range}m/${w.ground.cooldown}s` : '';
          const a = w.air ? `A ${w.air.damage}/${w.air.range}m/${w.air.cooldown}s` : '';
          return `<li>${esc(w.name)}: ${[g, a].filter(Boolean).join(' · ')}</li>`;
        })
        .join('');
      statsHtml = `
        <ul class="g-stats">
          <li>HP <b>${r.maxHealth}</b> · Armor <b>${r.armor}</b> (${r.armorClass})</li>
          <li>Speed <b>${r.speed.toFixed(1)}</b> m/s · View <b>${r.viewRange.toFixed(1)}</b> m</li>
          <li>Energy <b>${r.energyMax}</b> (+${r.energyRecharge}/s, −${r.passiveDrain.toFixed(0)}/s drain)</li>
          ${weaponLines}
          ${r.repair ? `<li>Repairs ${r.repair.hps} HP/s at ${r.repair.range} m</li>` : ''}
          ${r.regenHps ? `<li>Regenerates ${r.regenHps} HP/s</li>` : ''}
        </ul>`;
    }

    editorEl.innerHTML = `
      <div class="g-head">
        <input id="g-name" value="${esc(unit.name)}" maxlength="20" />
        <span class="g-level">Lv ${level} · ${unit.xp}/${unitXpForLevel(level + 1)} XP · new parts ≤ T${gate}</span>
        <button id="g-sell" class="secondary">Scrap (+${Math.floor(oldCost * SELL_FRACTION)} cr)</button>
      </div>
      <div class="g-chassis-line">${esc(chassis.name)} · ${chassis.slots} slots · tech ${chassis.techLevel}</div>
      <div class="g-budgets">
        <span class="${weight > weightBudget ? 'over' : ''}">Weight ${weight}/${weightBudget}</span>
        <span class="${space > chassis.maxSpace ? 'over' : ''}">Space ${space}/${chassis.maxSpace}</span>
        <span class="${computer && cx > computer.maxComplexity ? 'over' : ''}">Complexity ${cx}/${computer?.kind === 'computer' ? computer.maxComplexity : '—'}</span>
        <span class="${engine && engine.kind === 'engine' && engine.power < totalWeight ? 'over' : ''}">Engine ${engine?.kind === 'engine' ? engine.power : '—'}/${totalWeight} kg</span>
      </div>
      <div class="g-parts">${partRows}</div>
      <div class="g-add">
        <select id="g-add-select">${addable}</select>
        <button id="g-add-btn">Fit part</button>
      </div>
      <div class="g-issues">${issues.map((i) => `<div class="${i.severity}">${esc(i.message)}</div>`).join('')}</div>
      ${statsHtml}
      <div class="g-apply">
        ${
          dirty
            ? `<span>${price >= 0 ? `Cost: ${price} cr` : `Refund: ${-price} cr`}</span>
        <button id="g-apply" ${valid && profile.credits + Math.max(0, -price) >= Math.max(0, price) ? '' : 'disabled'}>Apply refit</button>
        <button id="g-revert" class="secondary">Revert</button>`
            : ''
        }
      </div>
    `;

    editorEl.querySelector<HTMLInputElement>('#g-name')!.onchange = (e) => {
      const value = (e.target as HTMLInputElement).value.trim();
      if (value) {
        unit.name = value;
        store.save(profile);
        renderRoster();
      }
    };
    editorEl.querySelector<HTMLButtonElement>('#g-sell')!.onclick = () => {
      if (!confirm(`Scrap ${unit.name} for ${Math.floor(oldCost * SELL_FRACTION)} cr?`)) return;
      profile.credits += Math.floor(oldCost * SELL_FRACTION);
      profile.units = profile.units.filter((u) => u.uid !== unit.uid);
      profile.lastSquad = profile.lastSquad.filter((uid) => uid !== unit.uid);
      selectedUid = profile.units[0]?.uid ?? null;
      draft = selectedUid ? [...(selected()?.partIds ?? [])] : [];
      store.save(profile);
      refreshHeader();
      renderRoster();
      renderEditor();
    };
    for (const btn of editorEl.querySelectorAll<HTMLButtonElement>('.g-part-remove')) {
      btn.onclick = () => {
        draft.splice(Number(btn.dataset.index), 1);
        renderEditor();
      };
    }
    editorEl.querySelector<HTMLButtonElement>('#g-add-btn')!.onclick = () => {
      const sel = editorEl.querySelector<HTMLSelectElement>('#g-add-select')!;
      if (sel.value) {
        draft.push(sel.value);
        renderEditor();
      }
    };
    editorEl.querySelector<HTMLButtonElement>('#g-apply')?.addEventListener('click', () => {
      if (!valid) return;
      if (price > 0 && profile.credits < price) return;
      profile.credits -= price;
      unit.partIds = [...draft];
      store.save(profile);
      refreshHeader();
      renderEditor();
      renderRoster();
    });
    editorEl.querySelector<HTMLButtonElement>('#g-revert')?.addEventListener('click', () => {
      draft = [...unit.partIds];
      renderEditor();
    });
  };

  draft = selected() ? [...selected()!.partIds] : [];
  renderRoster();
  renderBuy();
  renderEditor();
}
