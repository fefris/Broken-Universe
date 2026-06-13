import type { ContentDB } from '../content/db';
import type { Profile, ProfileStore } from '../meta/profile';
import { deleteSquadGroup, groupValidUids, ownedToDesign, upsertSquadGroup } from '../meta/profile';
import { cpBudget, cpCost, fieldCap } from '../meta/rules';
import { unitLevel } from '../meta/xp';
import { designCost } from '../sim/unitStats';
import { esc, fromHtml, showOverlay } from './dom';
import { divisionIcon, icon } from './icons';

export interface SquadPick {
  /** The first group to take the field. Everything else you own stays in
   *  reserve and is deployed as later waves from the battle HUD. */
  squadUids: string[];
}

/**
 * Pre-battle muster: pick the FIRST group to deploy, limited by Clout's field
 * cap and Tactics' command points. The rest of your army is the reinforcement
 * pool — when this group falls you choose the next wave from the field. Saved
 * squad groups drop a whole roster in with one click and persist as presets.
 */
export function showSquadPicker(
  profile: Profile,
  db: ContentDB,
  title: string,
  store: ProfileStore,
): Promise<SquadPick | null> {
  return new Promise((resolve) => {
    const attrs = profile.attributes;
    const field = fieldCap(attrs);
    const budget = cpBudget(attrs);
    const costs = new Map(
      profile.units.map((u) => [u.uid, designCost(ownedToDesign(u), db)] as const),
    );

    // Restore the last first-group, trimmed to what currently fits.
    let picks: string[] = profile.lastSquad
      .filter((uid) => profile.units.some((u) => u.uid === uid))
      .slice(0, field);
    let pendingDeleteGroup: string | null = null;

    const root = fromHtml(`
      <div class="picker panel frame cut">
        <h2 class="heading">${esc(title)}</h2>
        <p class="hint">Pick your first group — up to ${field} units within ${budget} command points. The rest of your army stays in reserve; when this group falls you deploy the next wave from the battle HUD.</p>
        <div class="picker-groups well">
          <span class="pg-label">${icon('save', { size: 13 })} Squad presets</span>
          <div class="pg-list" id="p-groups"></div>
          <button id="p-savegroup" class="secondary">${icon('plus', { size: 13 })} Save current…</button>
          <div class="pg-save" id="p-saveform" hidden>
            <input id="p-groupname" maxlength="24" placeholder="Group name" />
            <button id="p-groupsave">${icon('save', { size: 13 })} Save</button>
            <button id="p-groupcancel" class="secondary">Cancel</button>
          </div>
        </div>
        <div class="picker-status" id="p-status"></div>
        <div class="picker-grid" id="p-grid"></div>
        <div class="picker-actions">
          <button id="p-launch" class="big">${icon('attack', { size: 16 })} Launch battle</button>
          <button id="p-auto" class="secondary">Auto-muster</button>
          <button id="p-clear" class="secondary">Clear</button>
          <button id="p-cancel" class="secondary">${icon('close', { size: 13 })} Cancel</button>
        </div>
      </div>
    `);

    const grid = root.querySelector<HTMLElement>('#p-grid')!;
    const status = root.querySelector<HTMLElement>('#p-status')!;
    const groupsEl = root.querySelector<HTMLElement>('#p-groups')!;
    const launchBtn = root.querySelector<HTMLButtonElement>('#p-launch')!;
    const saveGroupBtn = root.querySelector<HTMLButtonElement>('#p-savegroup')!;
    const saveForm = root.querySelector<HTMLElement>('#p-saveform')!;
    const saveName = root.querySelector<HTMLInputElement>('#p-groupname')!;
    const saveBtn = root.querySelector<HTMLButtonElement>('#p-groupsave')!;

    const squadCp = () => picks.reduce((s, uid) => s + cpCost(costs.get(uid) ?? 0), 0);
    const isValid = () => picks.length > 0 && picks.length <= field && squadCp() <= budget;

    const renderGroups = () => {
      groupsEl.innerHTML = '';
      if (profile.squadGroups.length === 0) {
        groupsEl.innerHTML = '<span class="pg-empty">none saved yet</span>';
        return;
      }
      for (const group of profile.squadGroups) {
        const valid = groupValidUids(group, profile);
        const missing = group.uids.length - valid.length;
        const confirmingDelete = pendingDeleteGroup === group.name;
        const chip = fromHtml(`
          <span class="pg-chip cut-sm" title="${valid.length} units${missing > 0 ? `, ${missing} no longer owned` : ''}">
            <button class="pg-load">${esc(group.name)} <i>${valid.length}</i></button>
            <button class="pg-del ${confirmingDelete ? 'confirm' : ''}" title="${confirmingDelete ? 'Confirm delete' : 'Delete group'}">${confirmingDelete ? 'Delete?' : icon('trash', { size: 12 })}</button>
          </span>
        `);
        chip.querySelector<HTMLButtonElement>('.pg-load')!.onclick = () => {
          pendingDeleteGroup = null;
          // A group fills the first wave, trimmed to the field cap.
          picks = groupValidUids(group, profile).slice(0, field);
          render();
          renderGroups();
        };
        chip.querySelector<HTMLButtonElement>('.pg-del')!.onclick = () => {
          if (pendingDeleteGroup !== group.name) {
            pendingDeleteGroup = group.name;
            renderGroups();
            return;
          }
          deleteSquadGroup(profile, group.name);
          pendingDeleteGroup = null;
          store.save(profile);
          renderGroups();
        };
        groupsEl.appendChild(chip);
      }
    };

    const render = () => {
      grid.innerHTML = '';
      for (const unit of profile.units) {
        const index = picks.indexOf(unit.uid);
        const picked = index >= 0;
        const cp = cpCost(costs.get(unit.uid) ?? 0);
        const division = db.chassis(unit.chassisId)?.division;
        const card = fromHtml(`
          <div class="p-card cut-sm ${picked ? 'picked field' : ''}">
            <div class="p-card-top">
              <span class="p-card-div" title="${division ?? 'unit'}">${division ? divisionIcon(division) : ''}</span>
              <b class="p-card-name">${esc(unit.name)}</b>
              <span class="p-card-role">${picked ? 'FIELD' : ''}</span>
            </div>
            <div class="p-card-info">
              <span class="p-stat"><i>Lv</i> ${unitLevel(unit.xp)}</span>
              <span class="p-stat">${icon('cp', { size: 12 })} ${cp}</span>
              <span class="p-stat">${icon('credits', { size: 12 })} ${costs.get(unit.uid)}</span>
            </div>
          </div>
        `);
        card.onclick = () => {
          if (index >= 0) picks.splice(index, 1);
          else picks.push(unit.uid);
          render();
        };
        grid.appendChild(card);
      }
      const overCp = squadCp() > budget;
      const overField = picks.length > field;
      const poolLeft = profile.units.length - picks.length;
      status.innerHTML = `
        <span class="chip ${overField ? 'bad' : 'amber'}">${icon('faction-player', { size: 13 })} Group ${picks.length}/${field}</span>
        <span class="chip ${overCp ? 'bad' : 'cyan'}">${icon('cp', { size: 13 })} ${squadCp()}/${budget} CP</span>
        <span class="chip">${icon('defend', { size: 13 })} ${poolLeft} in reserve</span>
      `;
      launchBtn.disabled = !isValid();
    };

    const hideSaveForm = () => {
      saveForm.hidden = true;
      saveGroupBtn.hidden = false;
      saveName.value = '';
    };

    const showSaveForm = () => {
      if (picks.length === 0) {
        alert('Muster some units first, then save them as a group.');
        return;
      }
      const suggested = profile.squadGroups.length > 0 ? '' : 'Strike Team';
      saveName.value = suggested;
      saveGroupBtn.hidden = true;
      saveForm.hidden = false;
      saveName.focus();
      saveName.select();
    };

    const saveCurrentGroup = () => {
      const trimmed = saveName.value.trim();
      if (!trimmed) return;
      upsertSquadGroup(profile, trimmed, picks);
      store.save(profile);
      hideSaveForm();
      renderGroups();
    };

    saveGroupBtn.onclick = showSaveForm;
    saveBtn.onclick = saveCurrentGroup;
    saveName.onkeydown = (e) => {
      if (e.key === 'Enter') saveCurrentGroup();
      if (e.key === 'Escape') hideSaveForm();
    };
    root.querySelector<HTMLButtonElement>('#p-groupcancel')!.onclick = hideSaveForm;

    root.querySelector<HTMLButtonElement>('#p-auto')!.onclick = () => {
      // Highest-level units first, greedily filling the field within the CP budget.
      const sorted = [...profile.units].sort((a, b) => b.xp - a.xp);
      picks = [];
      let cp = 0;
      for (const u of sorted) {
        if (picks.length >= field) break;
        const c = cpCost(costs.get(u.uid) ?? 0);
        if (cp + c <= budget) {
          picks.push(u.uid);
          cp += c;
        }
      }
      render();
    };
    root.querySelector<HTMLButtonElement>('#p-clear')!.onclick = () => {
      picks = [];
      render();
    };
    root.querySelector<HTMLButtonElement>('#p-cancel')!.onclick = () => resolve(null);
    launchBtn.onclick = () => {
      if (!isValid()) return;
      resolve({ squadUids: [...picks] });
    };

    renderGroups();
    render();
    showOverlay(root);
  });
}
