import type { BattleRunner } from '../game/runner';
import type { Controls } from '../input/controls';
import { ticksToSeconds } from '../sim/constants';
import { canDeploy } from '../sim/systems/reserves';
import { ATTACKER, type Team, type World } from '../sim/types';

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node as T;
}

function fmtTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export class Hud {
  private readonly timer = el('timer');
  private readonly cutoff = el('cutoff');
  private readonly pocStrip = el('pocstrip');
  private readonly squadBar = el('squadbar');
  private readonly reservePanel = el('reserves');
  private readonly reserveButtons = el('reserve-buttons');
  private readonly reserveInfo = el('reserve-info');
  private readonly endScreen = el('endscreen');
  private readonly endTitle = el('end-title');
  private readonly endSub = el('end-sub');

  private lastReserveSig = '';
  private lastPocSig = '';
  private squadSlots = new Map<number, { root: HTMLElement; fill: HTMLElement }>();
  private ended = false;

  constructor(
    private readonly runner: BattleRunner,
    private readonly controls: Controls,
    private readonly playerCommanderId: number | null,
    private readonly playerTeam: Team | null,
    onExit: () => void,
  ) {
    el('hud').style.display = 'block';
    this.endScreen.style.display = 'none';
    this.pocStrip.innerHTML = '';
    this.squadBar.innerHTML = '';
    this.reserveButtons.innerHTML = '';
    this.squadSlots.clear();
    this.lastReserveSig = '';
    this.lastPocSig = '';
    this.ended = false;
    const spectating = playerCommanderId === null;
    this.squadBar.style.display = spectating ? 'none' : 'flex';
    this.reservePanel.style.display = spectating ? 'none' : 'block';
    el('btn-menu').onclick = onExit;
  }

  update(world: World): void {
    // Timer + reinforcement cutoff.
    const remaining = ticksToSeconds(world.durationTicks - world.tick);
    this.timer.textContent = fmtTime(remaining);
    const cutoffLeft = ticksToSeconds(world.reinforceCutoffTick - world.tick);
    if (cutoffLeft <= 0) {
      this.cutoff.textContent = 'reinforcements closed';
      this.cutoff.classList.add('closed');
    } else if (cutoffLeft < 60) {
      this.cutoff.textContent = `reinforcements close in ${fmtTime(cutoffLeft)}`;
      this.cutoff.classList.remove('closed');
    } else {
      this.cutoff.textContent = '';
    }

    this.updatePocs(world);
    if (this.playerCommanderId !== null) {
      this.updateSquadBar(world);
      this.updateReserves(world);
    }
    if (world.result && !this.ended) this.showEnd(world);
  }

  private updatePocs(world: World): void {
    const sig = world.pocs
      .map((p) => `${p.owner}:${Math.round((p.progress / p.captureTicks) * 100)}`)
      .join('|');
    if (sig === this.lastPocSig) return;
    this.lastPocSig = sig;
    this.pocStrip.innerHTML = '';
    for (const poc of world.pocs) {
      const chip = document.createElement('div');
      chip.className = `poc-chip ${poc.owner === ATTACKER ? 'team-a' : 'team-d'}`;
      const pct = Math.round((poc.progress / poc.captureTicks) * 100);
      chip.textContent = pct > 0 && poc.owner !== ATTACKER ? `${poc.label} ${pct}%` : poc.label;
      this.pocStrip.appendChild(chip);
    }
  }

  private updateSquadBar(world: World): void {
    if (this.playerCommanderId === null) return;
    const commander = world.commanders[this.playerCommanderId];
    if (!commander) return;
    for (const unitId of commander.squad) {
      const unit = world.units[unitId];
      if (!unit) continue;
      let slot = this.squadSlots.get(unitId);
      if (!slot) {
        const root = document.createElement('div');
        root.className = 'squad-slot';
        const name = document.createElement('div');
        name.className = 'slot-name';
        name.textContent = unit.stats.name;
        const bar = document.createElement('div');
        bar.className = 'slot-bar';
        const fill = document.createElement('div');
        fill.className = 'slot-fill';
        bar.appendChild(fill);
        root.append(name, bar);
        root.onclick = () => this.controls.selectOnly(unitId);
        this.squadBar.appendChild(root);
        slot = { root, fill };
        this.squadSlots.set(unitId, slot);
      }
      const ratio = unit.alive ? unit.hp / unit.stats.maxHealth : 0;
      slot.fill.style.width = `${Math.round(ratio * 100)}%`;
      slot.fill.className = `slot-fill ${ratio > 0.6 ? 'hp-high' : ratio > 0.3 ? 'hp-mid' : 'hp-low'}`;
      slot.root.classList.toggle('dead', !unit.alive);
      slot.root.classList.toggle('selected', this.controls.selection.has(unitId));
    }
  }

  private updateReserves(world: World): void {
    if (this.playerCommanderId === null) return;
    const commander = world.commanders[this.playerCommanderId];
    if (!commander) return;
    const counts = new Map<string, number>();
    for (const id of commander.reserves) counts.set(id, (counts.get(id) ?? 0) + 1);
    const deployable = canDeploy(world, commander);
    const sig = `${[...counts.entries()].map(([k, v]) => `${k}:${v}`).join(',')}|${deployable}`;
    if (sig === this.lastReserveSig) return;
    this.lastReserveSig = sig;

    this.reserveButtons.innerHTML = '';
    for (const [designId, count] of counts) {
      const sample = world.units.find((u) => u.stats.designId === designId);
      const name = sample?.stats.name ?? designId.replace(/^d_/, '');
      const btn = document.createElement('button');
      btn.className = 'reserve-btn';
      btn.textContent = `${name} ×${count}`;
      btn.disabled = !deployable;
      btn.onclick = () => {
        if (this.playerCommanderId !== null) {
          this.runner.enqueue({
            type: 'deploy',
            commanderId: this.playerCommanderId,
            designId,
          });
        }
      };
      this.reserveButtons.appendChild(btn);
    }
    const alive = commander.squad.filter((id) => world.units[id]?.alive).length;
    this.reserveInfo.textContent = `squad ${alive}/${commander.squadCap} · reserves ${commander.reserves.length}`;
  }

  private showEnd(world: World): void {
    if (!world.result) return;
    this.ended = true;
    const { winner, reason } = world.result;
    let title: string;
    let cls: string;
    if (this.playerTeam === null) {
      title = winner === ATTACKER ? 'Attackers Win' : 'Defenders Win';
      cls = 'neutral';
    } else if (winner === this.playerTeam) {
      title = 'VICTORY';
      cls = 'victory';
    } else {
      title = 'DEFEAT';
      cls = 'defeat';
    }
    const reasonText =
      reason === 'allPocsCaptured'
        ? 'All Points of Contention captured.'
        : reason === 'timeExpired'
          ? 'The defenders held until the clock ran out.'
          : 'One side was wiped from the field.';
    this.endTitle.textContent = title;
    this.endTitle.className = cls;
    this.endSub.textContent = reasonText;
    this.endScreen.style.display = 'flex';
  }

  destroy(): void {
    el('hud').style.display = 'none';
    this.endScreen.style.display = 'none';
  }
}
