import type { ContentDB } from '../content/db';
import {
  type CampaignState,
  HOME_PROVINCE,
  PROVINCES,
  attackTargets,
  delegateHoldChance,
  provinceDef,
  turnIncome,
} from '../meta/campaign';
import type { Profile, ProfileStore } from '../meta/profile';
import { profileRank } from '../meta/profile';
import {
  ATTRIBUTE_LABELS,
  type HeroAttributes,
  chassisGate,
  cpBudget,
  fieldCap,
  maxWeightMult,
  reserveCap,
  techGate,
} from '../meta/rules';
import { POINTS_PER_RANK, heroXpForRank } from '../meta/xp';
import { esc, fromHtml, showOverlay } from './dom';
import { renderGarage } from './garage';
import { type IconName, icon } from './icons';

export type HubAction =
  | { kind: 'attack'; provinceId: string }
  | { kind: 'defend' }
  | { kind: 'delegate' }
  | { kind: 'skip' }
  | { kind: 'exit' };

const FACTION_LABELS = { player: 'Aurora Concord', enemy: 'Vesper Dominion', brood: 'Broodmind' };

// Faction marker icons for province nodes / detail readouts.
const FACTION_ICON: Record<'player' | 'enemy' | 'brood', IconName> = {
  player: 'faction-player',
  enemy: 'faction-enemy',
  brood: 'faction-brood',
};

// Province bonus → icon + label for the strategic badges.
const BONUS_ICON: Record<'hq' | 'factory' | 'simulator', IconName> = {
  hq: 'bonus-hq',
  factory: 'bonus-factory',
  simulator: 'bonus-simulator',
};

/**
 * Campaign hub: header + Map/Garage/Hero tabs. Garage and hero edits mutate
 * the profile in place (saved via store); the returned action ends the stay.
 */
export function showHub(
  profile: Profile,
  campaign: CampaignState,
  db: ContentDB,
  store: ProfileStore,
): Promise<HubAction> {
  return new Promise((resolve) => {
    const root = fromHtml(`
      <div class="hub">
        <div class="hub-header panel">
          <div class="hub-id">
            <span class="hub-name">${esc(profile.heroName)}</span>
            <span class="hub-rank">${icon('rank')} Rank <b id="hub-rank"></b></span>
            <span id="hub-points" class="hub-points chip amber"></span>
          </div>
          <div class="hub-res">
            <span class="hub-stat turn">${icon('timer')} Turn <b id="hub-turn"></b></span>
            <span class="hub-stat credits">${icon('credits')} <b id="hub-credits"></b> cr</span>
            <span class="hub-stat income">${icon('xp')} +<b id="hub-income"></b>/turn</span>
          </div>
          <div class="hub-tabs">
            <button data-tab="map" class="tab active">${icon('target')} War Map</button>
            <button data-tab="garage" class="tab">${icon('part-engine')} Garage</button>
            <button data-tab="hero" class="tab">${icon('rank')} Hero</button>
            <button id="hub-exit" class="tab exit">${icon('save')} Save &amp; Exit</button>
          </div>
        </div>
        <div class="hub-body" id="hub-body"></div>
      </div>
    `);

    const body = root.querySelector<HTMLElement>('#hub-body')!;
    let activeTab = 'map';

    const refreshHeader = () => {
      root.querySelector('#hub-rank')!.textContent = String(profileRank(profile));
      root.querySelector('#hub-turn')!.textContent = String(campaign.turn);
      root.querySelector('#hub-credits')!.textContent = String(profile.credits);
      root.querySelector('#hub-income')!.textContent = String(turnIncome(campaign));
      const pts = root.querySelector<HTMLElement>('#hub-points')!;
      pts.textContent = profile.attrPoints > 0 ? `${profile.attrPoints} attribute points!` : '';
    };

    const done = (action: HubAction) => {
      store.save(profile);
      resolve(action);
    };

    const renderTab = () => {
      refreshHeader();
      body.innerHTML = '';
      if (activeTab === 'map') renderMap(body, profile, campaign, done);
      else if (activeTab === 'garage')
        renderGarage(body, profile, campaign, db, store, refreshHeader);
      else renderHero(body, profile, store, refreshHeader);
    };

    for (const btn of root.querySelectorAll<HTMLButtonElement>('[data-tab]')) {
      btn.onclick = () => {
        activeTab = btn.dataset.tab!;
        for (const b of root.querySelectorAll('.tab')) b.classList.remove('active');
        btn.classList.add('active');
        store.save(profile);
        renderTab();
      };
    }
    root.querySelector<HTMLButtonElement>('#hub-exit')!.onclick = () => done({ kind: 'exit' });

    renderTab();
    showOverlay(root);
  });
}

function renderMap(
  body: HTMLElement,
  profile: Profile,
  campaign: CampaignState,
  done: (action: HubAction) => void,
): void {
  const targets = new Set(attackTargets(campaign).map((p) => p.id));
  const pending = campaign.pendingAttack;

  const edges: string[] = [];
  const seen = new Set<string>();
  for (const p of PROVINCES) {
    for (const a of p.adj) {
      const key = [p.id, a].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const q = provinceDef(a);
      edges.push(`<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" class="map-edge" />`);
    }
  }

  const nodes = PROVINCES.map((p) => {
    const owner = campaign.owners[p.id]!;
    const classes = [
      'map-node',
      `own-${owner}`,
      targets.has(p.id) ? 'target' : '',
      pending?.provinceId === p.id ? 'threatened' : '',
    ].join(' ');
    const badge = p.bonus
      ? `<div class="map-badge">${icon(BONUS_ICON[p.bonus], { size: 10 })}${p.bonus}</div>`
      : '';
    const star =
      p.id === HOME_PROVINCE || p.bonus === 'hq' ? '<span class="map-star">★</span>' : '';
    return `
      <div class="${classes}" data-id="${p.id}" style="left:${p.x}%;top:${p.y}%">
        <div class="map-dot">${icon(FACTION_ICON[owner], { size: 20 })}</div>
        <div class="map-label">${esc(p.name)}${star}</div>
        ${badge}
      </div>`;
  }).join('');

  const logHtml = campaign.log
    .slice(-6)
    .reverse()
    .map((line) => `<div>${esc(line)}</div>`)
    .join('');

  const view = fromHtml(`
    <div class="map-wrap">
      <div class="map-area">
        <svg class="map-svg" viewBox="0 0 100 100" preserveAspectRatio="none">${edges.join('')}</svg>
        ${nodes}
      </div>
      <div class="map-side">
        <div id="map-detail" class="map-detail panel frame">
          <p class="hint">Select a hostile province bordering Concord territory to plan an assault.</p>
        </div>
        ${
          pending
            ? `<div class="map-alert">
                <div class="map-alert-title">${icon('target')} ${esc(provinceDef(pending.provinceId).name)} under attack</div>
                <p>Dominion strike force: <b>${pending.strength}</b> commanders. Garrison: <b>${provinceDef(pending.provinceId).garrison}</b>.</p>
                <button id="btn-defend" class="big">${icon('defend')} Lead the defense</button>
                <button id="btn-delegate" class="secondary">Delegate (${Math.round(delegateHoldChance(campaign) * 100)}% hold)</button>
              </div>`
            : `<button id="btn-skip" class="secondary">${icon('timer')} Hold positions (collect income)</button>`
        }
        <div class="map-log well">${logHtml}</div>
      </div>
    </div>
  `);

  const detail = view.querySelector<HTMLElement>('#map-detail')!;
  for (const node of view.querySelectorAll<HTMLElement>('.map-node')) {
    node.onclick = () => {
      const def = provinceDef(node.dataset.id!);
      const owner = campaign.owners[def.id]!;
      const attackable = targets.has(def.id);
      const ownerCls = owner === 'player' ? 'cyan' : 'bad';
      const bonusChip = def.bonus
        ? `<span class="chip amber">${icon(BONUS_ICON[def.bonus], { size: 12 })}${def.bonus}</span>`
        : '';
      detail.innerHTML = `
        <h3>${esc(def.name)}</h3>
        <div class="map-detail-meta">
          <span class="chip ${ownerCls}">${icon(FACTION_ICON[owner], { size: 12 })}${FACTION_LABELS[owner]}</span>
          <span class="chip">${icon('credits', { size: 12 })}${def.income} cr</span>
          <span class="chip">${icon('cp', { size: 12 })}${def.garrison} garrison</span>
          ${bonusChip}
        </div>
        ${attackable ? `<button id="btn-attack" class="big">${icon('attack')} Launch assault</button>` : `<p class="hint">${owner === 'player' ? 'Friendly territory.' : 'No friendly border — push the front line closer.'}</p>`}
      `;
      const attackBtn = detail.querySelector<HTMLButtonElement>('#btn-attack');
      if (attackBtn) attackBtn.onclick = () => done({ kind: 'attack', provinceId: def.id });
    };
  }

  view
    .querySelector<HTMLButtonElement>('#btn-defend')
    ?.addEventListener('click', () => done({ kind: 'defend' }));
  view
    .querySelector<HTMLButtonElement>('#btn-delegate')
    ?.addEventListener('click', () => done({ kind: 'delegate' }));
  view
    .querySelector<HTMLButtonElement>('#btn-skip')
    ?.addEventListener('click', () => done({ kind: 'skip' }));

  body.appendChild(view);
  void profile;
}

function renderHero(
  body: HTMLElement,
  profile: Profile,
  store: ProfileStore,
  refreshHeader: () => void,
): void {
  const render = () => {
    const rank = profileRank(profile);
    const nextAt = heroXpForRank(rank + 1);
    const prevAt = heroXpForRank(rank);
    const pct = Math.min(100, Math.round(((profile.heroXp - prevAt) / (nextAt - prevAt)) * 100));
    const a = profile.attributes;

    const rows = (Object.keys(ATTRIBUTE_LABELS) as (keyof HeroAttributes)[])
      .map(
        (key) => `
        <div class="attr-row">
          <span class="attr-name">${ATTRIBUTE_LABELS[key]}</span>
          <span class="attr-val">${a[key]}</span>
          <button class="attr-plus" data-attr="${key}" ${profile.attrPoints > 0 ? '' : 'disabled'} aria-label="Raise ${ATTRIBUTE_LABELS[key]}">${icon('plus', { size: 16 })}</button>
        </div>`,
      )
      .join('');

    body.innerHTML = `
      <div class="hero-wrap">
        <div class="hero-card panel frame">
          <h3>${icon('rank')} ${esc(profile.heroName)} — Rank ${rank}</h3>
          <div class="xpbar"><div class="xpfill" style="width:${pct}%"></div></div>
          <p class="hint">${icon('xp', { size: 11 })} ${profile.heroXp} / ${nextAt} XP · next rank grants ${POINTS_PER_RANK} attribute points</p>
          <div class="attr-list">${rows}</div>
          <p class="hint">Unspent points: <b>${profile.attrPoints}</b></p>
        </div>
        <div class="hero-card panel frame">
          <h3>${icon('target')} Effects</h3>
          <ul class="fx-list">
            <li><b>Tactics ${a.tactics}</b> → ${cpBudget(a)} command points for your fielded squad</li>
            <li><b>Clout ${a.clout}</b> → field ${fieldCap(a)} units, ${reserveCap(a)} reserves, chassis up to tech ${chassisGate(rank, a)}</li>
            <li><b>Education ${a.education}</b> → units equip new parts up to tech level + ${Math.floor(a.education / 2)}; e.g. a level 1 unit reaches tech ${techGate(1, a)}</li>
            <li><b>Mech. Aptitude ${a.mech}</b> → chassis weight budgets ×${maxWeightMult(a).toFixed(2)}</li>
          </ul>
        </div>
      </div>
    `;

    for (const btn of body.querySelectorAll<HTMLButtonElement>('.attr-plus')) {
      btn.onclick = () => {
        if (profile.attrPoints <= 0) return;
        const key = btn.dataset.attr as keyof HeroAttributes;
        profile.attributes[key] += 1;
        profile.attrPoints -= 1;
        store.save(profile);
        refreshHeader();
        render();
      };
    }
  };
  render();
}
