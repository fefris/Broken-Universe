import type { ContentDB } from '../content/db';
import {
  type CampaignState,
  HOME_PROVINCE,
  PROVINCES,
  attackSources,
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
import {
  type Site,
  borderMidpoint,
  polygonPoints,
  roundedRectBoundary,
  voronoiCells,
} from './territory';

export type HubAction =
  | { kind: 'attack'; provinceId: string; fromProvinceId: string }
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
  const owners = campaign.owners;

  // Filled territory regions: Voronoi cells from the province centroids.
  const boundary = roundedRectBoundary(1.5, 1.5, 97, 97, 9);
  const sites: Site[] = PROVINCES.map((p) => ({ id: p.id, x: p.x, y: p.y }));
  const cells = voronoiCells(sites, boundary);

  const polys = PROVINCES.map((p) => {
    const cls = [
      'territory',
      `own-${owners[p.id]}`,
      targets.has(p.id) ? 'target' : '',
      pending?.provinceId === p.id ? 'threatened' : '',
    ].join(' ');
    return `<polygon class="${cls}" data-id="${p.id}" points="${polygonPoints(cells.get(p.id) ?? [])}" vector-effect="non-scaling-stroke" />`;
  }).join('');

  // One portal marker on each shared border (a crossing between two territories).
  const seen = new Set<string>();
  const portals: string[] = [];
  for (const p of PROVINCES) {
    for (const a of p.adj) {
      const key = [p.id, a].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const mid = borderMidpoint(p, provinceDef(a));
      const playerHeld = (owners[p.id] === 'player') !== (owners[a] === 'player');
      const hostileId = owners[p.id] === 'player' ? a : p.id;
      const friendId = owners[p.id] === 'player' ? p.id : a;
      const isThreat =
        !!pending &&
        ((pending.provinceId === p.id && pending.fromProvinceId === a) ||
          (pending.provinceId === a && pending.fromProvinceId === p.id));
      const cls = ['portal', playerHeld ? 'contested' : '', isThreat ? 'threat' : ''].join(' ');
      portals.push(
        `<div class="${cls}" style="left:${mid.x}%;top:${mid.y}%" data-target="${hostileId}" data-from="${friendId}"></div>`,
      );
    }
  }

  const nodes = PROVINCES.map((p) => {
    const badge = p.bonus
      ? `<div class="map-badge">${icon(BONUS_ICON[p.bonus], { size: 10 })}${p.bonus}</div>`
      : '';
    const star =
      p.id === HOME_PROVINCE || p.bonus === 'hq' ? '<span class="map-star">★</span>' : '';
    return `
      <div class="map-node own-${owners[p.id]}" data-id="${p.id}" style="left:${p.x}%;top:${p.y}%">
        <div class="map-dot">${icon(FACTION_ICON[owners[p.id]!], { size: 16 })}</div>
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
        <svg class="map-svg" viewBox="0 0 100 100" preserveAspectRatio="none">${polys}</svg>
        <div class="map-portals">${portals.join('')}</div>
        ${nodes}
      </div>
      <div class="map-side">
        <div id="map-detail" class="map-detail panel frame">
          <p class="hint">Select a hostile territory bordering Concord land, then choose a portal to assault through.</p>
        </div>
        ${
          pending
            ? `<div class="map-alert">
                <div class="map-alert-title">${icon('target')} ${esc(provinceDef(pending.provinceId).name)} under attack</div>
                <p>The Dominion crosses from <b>${esc(provinceDef(pending.fromProvinceId).name)}</b> — strike force <b>${pending.strength}</b> vs garrison <b>${provinceDef(pending.provinceId).garrison}</b>.</p>
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

  const selectProvince = (id: string): void => {
    for (const el of view.querySelectorAll('.territory.selected')) el.classList.remove('selected');
    for (const el of view.querySelectorAll('.portal.active')) el.classList.remove('active');
    view.querySelector(`.territory[data-id="${id}"]`)?.classList.add('selected');

    const def = provinceDef(id);
    const owner = owners[id]!;
    const attackable = targets.has(id);
    const sources = attackSources(campaign, id);
    const ownerCls = owner === 'player' ? 'cyan' : 'bad';
    const bonusChip = def.bonus
      ? `<span class="chip amber">${icon(BONUS_ICON[def.bonus], { size: 12 })}${def.bonus}</span>`
      : '';
    const action = attackable
      ? `<p class="hint">Assault through a border portal:</p>
         <div class="atk-sources">${sources
           .map(
             (s, i) =>
               `<button ${i === 0 ? 'id="btn-attack" ' : ''}class="big atk-src" data-src="${s.id}">${icon('attack', { size: 14 })} From ${esc(s.name)}</button>`,
           )
           .join('')}</div>`
      : `<p class="hint">${owner === 'player' ? 'Friendly territory.' : 'No friendly border — push the front line closer.'}</p>`;
    detail.innerHTML = `
      <h3>${esc(def.name)}</h3>
      <div class="map-detail-meta">
        <span class="chip ${ownerCls}">${icon(FACTION_ICON[owner], { size: 12 })}${FACTION_LABELS[owner]}</span>
        <span class="chip">${icon('credits', { size: 12 })}${def.income} cr</span>
        <span class="chip">${icon('cp', { size: 12 })}${def.garrison} garrison</span>
        ${bonusChip}
      </div>
      ${action}
    `;

    if (attackable) {
      for (const portal of view.querySelectorAll(`.portal.contested[data-target="${id}"]`)) {
        portal.classList.add('active');
      }
      for (const btn of detail.querySelectorAll<HTMLButtonElement>('.atk-src')) {
        btn.onclick = () =>
          done({ kind: 'attack', provinceId: id, fromProvinceId: btn.dataset.src! });
      }
    }
  };

  for (const poly of view.querySelectorAll<SVGElement>('.territory')) {
    poly.addEventListener('click', () => selectProvince(poly.dataset.id!));
  }
  for (const node of view.querySelectorAll<HTMLElement>('.map-node')) {
    node.onclick = () => selectProvince(node.dataset.id!);
  }
  for (const portal of view.querySelectorAll<HTMLElement>('.portal.contested')) {
    portal.onclick = () => {
      const target = portal.dataset.target!;
      if (targets.has(target)) {
        done({ kind: 'attack', provinceId: target, fromProvinceId: portal.dataset.from! });
      }
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
