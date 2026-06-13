import type { ContentDB } from '../content/db';
import type { Profile, ProfileStore } from '../meta/profile';
import { deleteSquadGroup, groupValidUids, ownedToDesign, upsertSquadGroup } from '../meta/profile';
import { cpBudget, cpCost, fieldCap, reserveCap } from '../meta/rules';
import { unitLevel } from '../meta/xp';
import { designCost } from '../sim/unitStats';
import { esc, fromHtml, showOverlay } from './dom';

export interface SquadPick {
  squadUids: string[];
  reserveUids: string[];
}

/**
 * Pre-battle muster: pick which owned units deploy. The first `fieldCap`
 * picks form the fielded squad (limited by Tactics command points); the
 * rest wait in reserve. Saved squad groups let the player switch a whole
 * roster in with one click and persist presets across battles.
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
    const reserves = reserveCap(attrs);
    const budget = cpBudget(attrs);
    const costs = new Map(
      profile.units.map((u) => [u.uid, designCost(ownedToDesign(u), db)] as const),
    );

    let picks: string[] = profile.lastSquad.filter((uid) =>
      profile.units.some((u) => u.uid === uid),
    );
    let pendingDeleteGroup: string | null = null;

    const root = fromHtml(`
      <div class="picker">
        <h2>${esc(title)}</h2>
        <p class="hint">Click units to muster them. The first ${field} fight from the start; up to ${reserves} more wait in reserve. Fielded squad is limited to ${budget} command points.</p>
        <div class="picker-groups">
          <span class="pg-label">Groups:</span>
          <div class="pg-list" id="p-groups"></div>
          <button id="p-savegroup" class="secondary">Save current as group…</button>
          <div class="pg-save" id="p-saveform" hidden>
            <input id="p-groupname" maxlength="24" placeholder="Group name" />
            <button id="p-groupsave">Save</button>
            <button id="p-groupcancel" class="secondary">Cancel</button>
          </div>
        </div>
        <div class="picker-status" id="p-status"></div>
        <div class="picker-grid" id="p-grid"></div>
        <div class="picker-actions">
          <button id="p-launch" class="big">Launch battle</button>
          <button id="p-auto" class="secondary">Auto-muster</button>
          <button id="p-clear" class="secondary">Clear</button>
          <button id="p-cancel" class="secondary">Cancel</button>
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

    const squadOf = () => picks.slice(0, field);
    const reservesOf = () => picks.slice(field);
    const squadCp = () => squadOf().reduce((s, uid) => s + cpCost(costs.get(uid) ?? 0), 0);
    const isValid = () =>
      picks.length > 0 && reservesOf().length <= reserves && squadCp() <= budget;

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
          <span class="pg-chip" title="${valid.length} units${missing > 0 ? `, ${missing} no longer owned` : ''}">
            <button class="pg-load">${esc(group.name)} (${valid.length})</button>
            <button class="pg-del ${confirmingDelete ? 'confirm' : ''}" title="${confirmingDelete ? 'Confirm delete' : 'Delete group'}">${confirmingDelete ? 'Delete?' : '✕'}</button>
          </span>
        `);
        chip.querySelector<HTMLButtonElement>('.pg-load')!.onclick = () => {
          pendingDeleteGroup = null;
          picks = groupValidUids(group, profile);
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
        const role = index < 0 ? '' : index < field ? 'FIELD' : 'RESERVE';
        const cp = cpCost(costs.get(unit.uid) ?? 0);
        const card = fromHtml(`
          <div class="p-card ${role ? `picked ${role.toLowerCase()}` : ''}">
            <div class="p-card-top"><b>${esc(unit.name)}</b><span>${role}</span></div>
            <div class="p-card-info">Lv ${unitLevel(unit.xp)} · ${cp} CP · ${costs.get(unit.uid)} cr</div>
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
      const overRes = reservesOf().length > reserves;
      status.innerHTML = `
        <span class="${overCp ? 'over' : ''}">Squad ${squadOf().length}/${field} · ${squadCp()}/${budget} CP</span>
        <span class="${overRes ? 'over' : ''}">Reserves ${reservesOf().length}/${reserves}</span>
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
      // Highest-level units first, greedily filling CP then reserves.
      const sorted = [...profile.units].sort((a, b) => b.xp - a.xp);
      picks = [];
      let cp = 0;
      for (const u of sorted) {
        if (picks.length < field) {
          const c = cpCost(costs.get(u.uid) ?? 0);
          if (cp + c <= budget) {
            picks.push(u.uid);
            cp += c;
          }
        } else if (picks.length - field < reserves) {
          picks.push(u.uid);
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
      resolve({ squadUids: squadOf(), reserveUids: reservesOf() });
    };

    renderGroups();
    render();
    showOverlay(root);
  });
}
