import { Application } from 'pixi.js';
import { loadContentDB } from './content/db';
import { BattleRunner } from './game/runner';
import { buildBattleConfig } from './game/setup';
import { Controls } from './input/controls';
import { GameRenderer } from './render/renderer';
import { TICK_MS } from './sim/constants';
import { spawnZoneFor } from './sim/map/maps';
import { Hud } from './ui/hud';
import { type MenuResult, showMenu } from './ui/menu';

const db = loadContentDB();

async function runBattle(app: Application, { options, difficulty }: MenuResult): Promise<void> {
  const config = buildBattleConfig(options, db);
  const runner = new BattleRunner(config, difficulty);
  const playerCommanderId = options.playerTeam !== null ? 0 : null;

  const renderer = new GameRenderer(app, runner.world, playerCommanderId);
  const selBox = document.getElementById('selbox')!;
  const controls = new Controls(app.canvas, renderer, runner, playerCommanderId, selBox);

  // Open on the player's spawn (attacker spawn when spectating).
  const homeTeam = options.playerTeam ?? 0;
  renderer.camera.centerOn(spawnZoneFor(runner.world.spawnZones, homeTeam).center);

  // Debug/automation handle (smoke tests, console poking).
  (window as unknown as Record<string, unknown>).__bu = { runner, controls, renderer };

  await new Promise<void>((resolve) => {
    const hud = new Hud(runner, controls, playerCommanderId, options.playerTeam, () => {
      app.ticker.remove(frame);
      controls.dispose();
      hud.destroy();
      renderer.destroy();
      resolve();
    });

    let acc = 0;
    const onResize = () => renderer.resize();
    app.renderer.on('resize', onResize);

    const frame = () => {
      const dt = Math.min(app.ticker.deltaMS, 250);
      acc += dt;
      const now = performance.now();
      while (acc >= TICK_MS) {
        const events = runner.step();
        renderer.fx.ingest(events, runner.world, now);
        acc -= TICK_MS;
        if (runner.world.result) {
          acc = 0;
          break;
        }
      }
      controls.pruneSelection();
      controls.update(dt);
      renderer.draw(runner.world, acc / TICK_MS, controls.selection, now);
      hud.update(runner.world);
    };
    app.ticker.add(frame);
  });
}

async function main(): Promise<void> {
  const app = new Application();
  await app.init({
    resizeTo: window,
    background: 0x0c0f13,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  document.getElementById('game')!.appendChild(app.canvas);

  // Menu -> battle -> back to menu, forever.
  for (;;) {
    const result = await showMenu();
    await runBattle(app, result);
  }
}

main().catch((err) => {
  console.error(err);
  const div = document.createElement('div');
  div.style.cssText =
    'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;color:#ff8080;font:16px monospace;white-space:pre-wrap;padding:40px;';
  div.textContent = `Failed to start: ${err instanceof Error ? err.stack : String(err)}`;
  document.body.appendChild(div);
});
