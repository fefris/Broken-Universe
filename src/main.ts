import { Application } from 'pixi.js';
import type { DifficultyLevel } from './ai/difficulty';
import { loadContentDB } from './content/db';
import { BattleRunner } from './game/runner';
import {
  type CampaignBattleContext,
  buildBattleConfig,
  buildCampaignBattleConfig,
} from './game/setup';
import { Controls } from './input/controls';
import {
  PROVINCES,
  advanceTurn,
  campaignResult,
  delegateHoldChance,
  newCampaign,
  provinceDef,
  resolveDefense,
  resolvePlayerAttack,
  turnIncome,
  xpMult,
} from './meta/campaign';
import { applyOutcome, summarizeBattle } from './meta/outcome';
import { type Profile, type ProfileStore, createLocalStorageStore } from './meta/profile';
import { GameRenderer } from './render/renderer';
import { TICK_MS } from './sim/constants';
import { spawnZoneFor } from './sim/map/maps';
import { createRng, deriveSeed } from './sim/rng';
import { ATTACKER, DEFENDER, type Team, type World } from './sim/types';
import type { BattleConfig } from './sim/world';
import { hideOverlay } from './ui/dom';
import { showHub } from './ui/hub';
import { Hud } from './ui/hud';
import { showNotice, showResults } from './ui/results';
import { showSquadPicker } from './ui/squadPicker';
import { showTitle } from './ui/title';

const db = loadContentDB();
/** ?quick=1 shortens battles to 60s — used by the automated smoke test. */
const QUICK_BATTLES = new URLSearchParams(location.search).has('quick');

/** Run one battle to its end screen; resolves with the final world. */
async function runBattle(
  app: Application,
  baseConfig: BattleConfig,
  difficulty: DifficultyLevel,
  playerTeam: Team | null,
): Promise<World> {
  const config = QUICK_BATTLES ? { ...baseConfig, durationTicks: 1200 } : baseConfig;
  const runner = new BattleRunner(config, difficulty);
  const playerCommanderId = playerTeam !== null ? 0 : null;

  const renderer = new GameRenderer(app, runner.world, playerCommanderId);
  const selBox = document.getElementById('selbox')!;
  const controls = new Controls(app.canvas, renderer, runner, playerCommanderId, selBox);

  const homeTeam = playerTeam ?? ATTACKER;
  renderer.camera.centerOn(spawnZoneFor(runner.world.spawnZones, homeTeam).center);

  // Debug/automation handle (smoke tests, console poking).
  (window as unknown as Record<string, unknown>).__bu = { runner, controls, renderer };

  await new Promise<void>((resolve) => {
    const hud = new Hud(runner, controls, playerCommanderId, playerTeam, () => {
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
  return runner.world;
}

async function runCampaignBattle(
  app: Application,
  profile: Profile,
  store: ProfileStore,
  ctx: CampaignBattleContext,
  difficulty: DifficultyLevel,
): Promise<boolean> {
  const config = buildCampaignBattleConfig(ctx, profile, db);
  hideOverlay();
  const world = await runBattle(app, config, difficulty, ctx.side);
  const won = world.result?.winner === ctx.side;
  const summary = summarizeBattle(world, 0, profile, {
    won,
    xpMult: profile.campaign ? xpMult(profile.campaign) : 1,
  });
  const applied = applyOutcome(profile, summary);
  store.save(profile);
  await showResults(
    summary,
    applied,
    won ? 'The field is ours.' : 'The squad withdraws to fight another day.',
  );
  return won;
}

async function runCampaign(app: Application, profile: Profile, store: ProfileStore): Promise<void> {
  if (!profile.campaign) {
    profile.campaign = newCampaign((Math.random() * 0xffffffff) >>> 0);
    store.save(profile);
  }
  const campaign = profile.campaign;

  for (;;) {
    const result = campaignResult(campaign);
    if (result) {
      await showNotice(
        result === 'victory' ? 'CALDERIS LIBERATED' : 'AURORA BASTION HAS FALLEN',
        result === 'victory'
          ? `Vesper Keep is ours after ${campaign.turn} turns. Your army and hero carry on to the next campaign.`
          : 'The Dominion overruns the Concord. Your veterans regroup for a new campaign.',
        'Return to title',
      );
      profile.campaign = null;
      store.save(profile);
      hideOverlay();
      return;
    }

    const action = await showHub(profile, campaign, db, store);

    if (action.kind === 'exit') {
      hideOverlay();
      return;
    }

    if (action.kind === 'skip') {
      profile.credits += turnIncome(campaign);
      advanceTurn(campaign);
      store.save(profile);
      continue;
    }

    if (action.kind === 'delegate') {
      const rng = createRng(deriveSeed(campaign.seed, campaign.turn * 977));
      const held = rng.next() < delegateHoldChance(campaign);
      const name = campaign.pendingAttack
        ? provinceDef(campaign.pendingAttack.provinceId).name
        : '';
      resolveDefense(campaign, held);
      profile.credits += turnIncome(campaign);
      advanceTurn(campaign);
      store.save(profile);
      await showNotice(
        held ? `${name} holds` : `${name} has fallen`,
        held
          ? 'The garrison repelled the Dominion assault without you.'
          : 'Without your squad on the field, the garrison broke.',
      );
      continue;
    }

    if (action.kind === 'attack') {
      const def = provinceDef(action.provinceId);
      const faction = campaign.owners[action.provinceId] === 'brood' ? 'brood' : 'enemy';
      const pick = await showSquadPicker(profile, db, `Assault on ${def.name}`, store);
      if (!pick) continue;
      // The whole rest of the roster is the reinforcement pool for later waves.
      const reserveUids = profile.units
        .map((u) => u.uid)
        .filter((uid) => !pick.squadUids.includes(uid));
      profile.lastSquad = [...pick.squadUids];
      const provinceIndex = PROVINCES.findIndex((p) => p.id === def.id);
      // You bring matching allied strength; your squad is the edge.
      const won = await runCampaignBattle(
        app,
        profile,
        store,
        {
          side: ATTACKER,
          enemyFaction: faction,
          enemyCommanders: def.garrison,
          allyCommanders: def.garrison,
          seed: deriveSeed(campaign.seed, campaign.turn * 31 + provinceIndex),
          squadUids: pick.squadUids,
          reserveUids,
        },
        def.garrison >= 5 ? 'hard' : 'normal',
      );
      resolvePlayerAttack(campaign, action.provinceId, won);
      profile.credits += turnIncome(campaign);
      advanceTurn(campaign);
      store.save(profile);
      continue;
    }

    if (action.kind === 'defend' && campaign.pendingAttack) {
      const pending = campaign.pendingAttack;
      const def = provinceDef(pending.provinceId);
      const pick = await showSquadPicker(profile, db, `Defense of ${def.name}`, store);
      if (!pick) continue;
      const reserveUids = profile.units
        .map((u) => u.uid)
        .filter((uid) => !pick.squadUids.includes(uid));
      profile.lastSquad = [...pick.squadUids];
      const won = await runCampaignBattle(
        app,
        profile,
        store,
        {
          side: DEFENDER,
          enemyFaction: 'enemy',
          enemyCommanders: pending.strength,
          allyCommanders: Math.max(1, def.garrison - 1),
          seed: deriveSeed(campaign.seed, campaign.turn * 53),
          squadUids: pick.squadUids,
          reserveUids,
        },
        'normal',
      );
      resolveDefense(campaign, won);
      profile.credits += turnIncome(campaign);
      advanceTurn(campaign);
      store.save(profile);
    }
  }
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

  const store = createLocalStorageStore();

  for (;;) {
    const choice = await showTitle(store, db);
    if (choice.kind === 'skirmish') {
      await runBattle(
        app,
        buildBattleConfig(choice.options, db),
        choice.difficulty,
        choice.options.playerTeam,
      );
    } else {
      await runCampaign(app, choice.profile, store);
    }
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
