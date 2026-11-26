// Screenshot staging for Sky Courier: ?shot=start|play|land&seed=N.
// One clear job: put the game into a fixed, photogenic state for each
// named shot, so the three dossier images are restageable and fair.

import { CONFIG } from './config.js';

export function applyShot(game, shot, seed) {
  const { world, plane, mission } = game;
  if (shot === 'start') {
    // Title screen: a hilltop vantage over the home strip, the isles
    // and the first rings ahead of her.
    mission.state = 'title';
    plane.reset(world, mission.index);
    plane.y = 80;
    plane.throttle = 0.35;
    return;
  }
  if (shot === 'play') {
    // Mid-flight: fast, on the ring line, the next hoop dead ahead
    // with the HUD lit — the game's working moment.
    mission.state = 'flying';
    plane.reset(world, mission.index);
    const ring = world.rings[2];
    plane.x = ring.x - 26;
    plane.y = ring.y + 6;
    plane.z = ring.z - 320;
    plane.speed = 78;
    plane.throttle = 0.72;
    plane.fuel = 81;
    plane.score = 240;
    plane.elapsed = 47;
    plane.ringsPassed = 2;
    world.rings[0].passed = true;
    world.rings[1].passed = true;
    plane.onGround = false;
    mission.message = 'Ring 3 of 12 — thread it clean!';
    mission.messageUntil = 9999;
    // Settle the frame: a few physics ticks so the bank and pitch read.
    for (let i = 0; i < 40; i++) {
      plane.step(1 / 60, { roll: 0.12, pitch: 0.05, throttleInput: 0 }, world, i / 60);
      plane.events = [];
    }
    return;
  }
  if (shot === 'land' || shot === 'end') {
    // Final approach: low over the water, the Return Strip ahead,
    // gear-down slow, every instrument in the green.
    mission.state = 'flying';
    plane.reset(world, mission.index);
    const strip = world.runways[world.runways.length - 1];
    plane.x = strip.x + 14;
    plane.y = 34;
    plane.z = strip.z - 380;
    plane.speed = 48;
    plane.throttle = 0.38;
    plane.fuel = 46;
    plane.score = 1240;
    plane.elapsed = 132;
    plane.ringsPassed = world.rings.length;
    for (const r of world.rings) r.passed = true;
    plane.onGround = false;
    mission.message = `Final — ${strip.name} ahead. Slow below 58 kt, centreline, gentle.`;
    mission.messageUntil = 9999;
    for (let i = 0; i < 30; i++) {
      plane.step(1 / 60, { roll: -0.05, pitch: -0.08, throttleInput: 0 }, world, i / 60);
      plane.events = [];
    }
    return;
  }
  // Unknown shot name: leave the title up.
  mission.state = 'title';
}

export function shotFromQuery(query) {
  const params = new URLSearchParams(query);
  return {
    shot: params.get('shot'),
    seed: Number(params.get('seed') || 11),
    mission: Number(params.get('mission') || 0),
  };
}

export { CONFIG };
