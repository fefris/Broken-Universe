import type { BattleRunner } from '../game/runner';
import type { GameRenderer } from '../render/renderer';
import { type UnitState, type Vec2, dist } from '../sim/types';

const CLICK_DRAG_THRESHOLD = 5;
const ARROW_PAN_SPEED = 900; // px/s

/** Held keys that pan the camera (normalized to lowercase). */
const PAN_KEYS = new Set(['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd']);

// Command-ping colours: green = move, amber = attack-move, red = attack a target.
const PING_MOVE = 0x6fe06f;
const PING_ATTACK_MOVE = 0xffb142;
const PING_ATTACK = 0xff5252;

/**
 * Player input: selection is restricted to the player's own squad (SG rule —
 * you command only your units). WASD/arrows/middle-drag pan, wheel zooms,
 * Q+click attack-moves, X stops, Ctrl+1-9 / 1-9 are control groups.
 */
export class Controls {
  readonly selection = new Set<number>();
  attackMoveArmed = false;

  private readonly groups = new Map<number, number[]>();
  private dragStart: Vec2 | null = null;
  private dragNow: Vec2 | null = null;
  private panning = false;
  private lastPan: Vec2 = { x: 0, y: 0 };
  private readonly keys = new Set<string>();
  private readonly disposers: (() => void)[] = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly renderer: GameRenderer,
    private readonly runner: BattleRunner,
    private readonly playerCommanderId: number | null,
    private readonly selBox: HTMLElement,
  ) {
    const on = <K extends keyof WindowEventMap>(
      target: Window | HTMLElement,
      type: K,
      fn: (e: WindowEventMap[K]) => void,
      opts?: AddEventListenerOptions,
    ) => {
      target.addEventListener(type, fn as EventListener, opts);
      this.disposers.push(() => target.removeEventListener(type, fn as EventListener, opts));
    };

    on(canvas, 'pointerdown', (e) => this.onPointerDown(e as PointerEvent));
    on(window, 'pointermove', (e) => this.onPointerMove(e));
    on(window, 'pointerup', (e) => this.onPointerUp(e));
    on(canvas, 'wheel', (e) => this.onWheel(e as WheelEvent), { passive: false });
    on(canvas, 'contextmenu', (e) => e.preventDefault());
    on(window, 'keydown', (e) => this.onKeyDown(e));
    on(window, 'keyup', (e) => this.keys.delete(e.key.toLowerCase()));
  }

  dispose(): void {
    for (const d of this.disposers) d();
  }

  private get isPlaying(): boolean {
    return this.playerCommanderId !== null && this.runner.world.result === null;
  }

  private myUnits(): UnitState[] {
    if (this.playerCommanderId === null) return [];
    const commander = this.runner.world.commanders[this.playerCommanderId];
    if (!commander) return [];
    return commander.squad
      .map((id) => this.runner.world.units[id])
      .filter((u): u is UnitState => u?.alive === true);
  }

  /** Drop dead units; called every frame before HUD/renderer use selection. */
  pruneSelection(): void {
    for (const id of this.selection) {
      if (!this.runner.world.units[id]?.alive) this.selection.delete(id);
    }
  }

  selectOnly(unitId: number): void {
    this.selection.clear();
    this.selection.add(unitId);
  }

  /** WASD / arrow-key panning; call once per frame. */
  update(dtMs: number): void {
    const px = (ARROW_PAN_SPEED * dtMs) / 1000;
    const k = this.keys;
    if (k.has('arrowleft') || k.has('a')) this.renderer.camera.pan(-px, 0);
    if (k.has('arrowright') || k.has('d')) this.renderer.camera.pan(px, 0);
    if (k.has('arrowup') || k.has('w')) this.renderer.camera.pan(0, -px);
    if (k.has('arrowdown') || k.has('s')) this.renderer.camera.pan(0, px);
    this.canvas.style.cursor = this.attackMoveArmed ? 'crosshair' : 'default';
  }

  /** Drop a command ping at a world point (player order feedback). */
  private ping(pos: Vec2, color: number): void {
    this.renderer.fx.ping(pos, performance.now(), color);
  }

  private screenPos(e: MouseEvent): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private unitAt(world: Vec2, predicate: (u: UnitState) => boolean): UnitState | null {
    let best: UnitState | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const u of this.runner.world.units) {
      if (!u.alive || !predicate(u)) continue;
      const d = dist(u.pos, world);
      if (d < u.stats.radius + 0.8 && d < bestD) {
        bestD = d;
        best = u;
      }
    }
    return best;
  }

  private issue(type: 'move' | 'attackMove', goal: Vec2): void {
    if (!this.isPlaying || this.selection.size === 0 || this.playerCommanderId === null) return;
    this.runner.enqueue({
      type,
      commanderId: this.playerCommanderId,
      unitIds: [...this.selection],
      goal,
    });
    this.ping(goal, type === 'attackMove' ? PING_ATTACK_MOVE : PING_MOVE);
  }

  private onPointerDown(e: PointerEvent): void {
    const s = this.screenPos(e);
    if (e.button === 1) {
      e.preventDefault();
      this.panning = true;
      this.lastPan = s;
      return;
    }
    if (e.button === 0) {
      if (this.renderer.minimap.handleClick(s.x, s.y)) return;
      const world = this.renderer.camera.screenToWorld(s.x, s.y);
      if (this.attackMoveArmed) {
        this.issue('attackMove', world);
        this.attackMoveArmed = false;
        return;
      }
      this.dragStart = s;
      this.dragNow = s;
      return;
    }
    if (e.button === 2 && this.isPlaying && this.playerCommanderId !== null) {
      const world = this.renderer.camera.screenToWorld(s.x, s.y);
      const playerTeam = this.runner.world.commanders[this.playerCommanderId]?.team;
      const enemy = this.unitAt(world, (u) => u.team !== playerTeam);
      if (enemy && this.selection.size > 0) {
        this.runner.enqueue({
          type: 'attackTarget',
          commanderId: this.playerCommanderId,
          unitIds: [...this.selection],
          targetId: enemy.id,
        });
        this.ping(enemy.pos, PING_ATTACK);
      } else {
        this.issue('move', world);
      }
    }
  }

  private onPointerMove(e: PointerEvent): void {
    const s = this.screenPos(e);
    if (this.panning) {
      this.renderer.camera.pan(this.lastPan.x - s.x, this.lastPan.y - s.y);
      this.lastPan = s;
      return;
    }
    if (this.dragStart) {
      this.dragNow = s;
      const dx = Math.abs(s.x - this.dragStart.x);
      const dy = Math.abs(s.y - this.dragStart.y);
      if (dx > CLICK_DRAG_THRESHOLD || dy > CLICK_DRAG_THRESHOLD) {
        const left = Math.min(this.dragStart.x, s.x);
        const top = Math.min(this.dragStart.y, s.y);
        this.selBox.style.display = 'block';
        this.selBox.style.left = `${left}px`;
        this.selBox.style.top = `${top}px`;
        this.selBox.style.width = `${Math.abs(dx)}px`;
        this.selBox.style.height = `${Math.abs(dy)}px`;
      }
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (e.button === 1) {
      this.panning = false;
      return;
    }
    if (e.button !== 0 || !this.dragStart || !this.dragNow) return;
    const start = this.dragStart;
    const end = this.dragNow;
    this.dragStart = null;
    this.dragNow = null;
    this.selBox.style.display = 'none';
    if (this.playerCommanderId === null) return;

    const additive = e.shiftKey;
    if (!additive) this.selection.clear();

    const wasDrag =
      Math.abs(end.x - start.x) > CLICK_DRAG_THRESHOLD ||
      Math.abs(end.y - start.y) > CLICK_DRAG_THRESHOLD;

    if (wasDrag) {
      const a = this.renderer.camera.screenToWorld(start.x, start.y);
      const b = this.renderer.camera.screenToWorld(end.x, end.y);
      const minX = Math.min(a.x, b.x);
      const maxX = Math.max(a.x, b.x);
      const minY = Math.min(a.y, b.y);
      const maxY = Math.max(a.y, b.y);
      for (const u of this.myUnits()) {
        if (u.pos.x >= minX && u.pos.x <= maxX && u.pos.y >= minY && u.pos.y <= maxY) {
          this.selection.add(u.id);
        }
      }
    } else {
      const world = this.renderer.camera.screenToWorld(end.x, end.y);
      const mine = this.unitAt(world, (u) => u.commanderId === this.playerCommanderId);
      if (mine) this.selection.add(mine.id);
    }
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const s = this.screenPos(e);
    this.renderer.camera.zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, s.x, s.y);
  }

  private onKeyDown(e: KeyboardEvent): void {
    const key = e.key.toLowerCase();
    // Held camera-pan keys: WASD + arrows.
    if (PAN_KEYS.has(key)) {
      if (key.startsWith('arrow')) e.preventDefault();
      this.keys.add(key);
      return;
    }
    const digit = Number.parseInt(e.key, 10);
    if (digit >= 1 && digit <= 9) {
      if (e.ctrlKey) {
        e.preventDefault();
        this.groups.set(digit, [...this.selection]);
      } else {
        const group = this.groups.get(digit);
        if (group) {
          this.selection.clear();
          for (const id of group) {
            if (this.runner.world.units[id]?.alive) this.selection.add(id);
          }
        }
      }
      return;
    }
    switch (key) {
      case 'q':
        if (this.selection.size > 0) this.attackMoveArmed = true;
        break;
      case 'x':
        if (this.isPlaying && this.selection.size > 0 && this.playerCommanderId !== null) {
          this.runner.enqueue({
            type: 'stop',
            commanderId: this.playerCommanderId,
            unitIds: [...this.selection],
          });
        }
        break;
      case 'escape':
        if (this.attackMoveArmed) this.attackMoveArmed = false;
        else this.selection.clear();
        break;
      case ' ': {
        e.preventDefault();
        const units = this.selection.size
          ? [...this.selection]
              .map((id) => this.runner.world.units[id])
              .filter((u): u is UnitState => !!u)
          : this.myUnits();
        if (units.length > 0) {
          const cx = units.reduce((s2, u) => s2 + u.pos.x, 0) / units.length;
          const cy = units.reduce((s2, u) => s2 + u.pos.y, 0) / units.length;
          this.renderer.camera.centerOn({ x: cx, y: cy });
        }
        break;
      }
    }
  }
}
