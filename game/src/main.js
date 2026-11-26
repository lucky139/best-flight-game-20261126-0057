// Sky Courier: Ember Isles — bootstrap and game loop.
// One clear job: own the canvas, the clock and the state machine,
// and hand each frame to physics, missions, sound and the renderer.

import { CONFIG, MISSIONS } from './config.js';
import { World } from './world.js';
import { Plane } from './physics.js';
import { MissionRunner } from './missions.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { Renderer } from './render.js';
import { applyShot, shotFromQuery } from './shots.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const ctx = canvas.getContext('2d');

const query = shotFromQuery(window.location.search);
const seed = Number.isFinite(query.seed) ? query.seed : 11;

const mission = new MissionRunner();
mission.select(Number.isFinite(query.mission) ? query.mission : 0);

let world = new World(seed, mission.index);
const plane = new Plane(world, mission.index);
const input = new Input(canvas);
const sound = new Sound();
const renderer = new Renderer();

const game = {
  world,
  plane,
  mission,
  input,
  sound,
  time: 0,
  width: CONFIG.viewWidth,
  height: CONFIG.viewHeight,
  frozen: false,
};

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  game.width = window.innerWidth;
  game.height = window.innerHeight;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// Screenshot staging: a fixed state, frozen in time, so a capture
// at any moment after load shows the same frame.
if (query.shot) {
  applyShot(game, query.shot, seed);
  game.frozen = true;
}

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

function playEventSounds(events) {
  for (const e of events) {
    if (e.kind === 'ring') sound.ringChime();
    else if (e.kind === 'land') sound.landChime();
    else if (e.kind === 'crash') sound.crash();
    else if (e.kind === 'clip' || e.kind === 'scrape' || e.kind === 'fuel') sound.warning();
  }
}

function handleKeys() {
  // Mission select on the title screen.
  if (input.consume('Digit1')) mission.select(0);
  if (input.consume('Digit2')) mission.select(1);
  if (input.consume('Digit3')) mission.select(2);
  if (input.consume('KeyM')) {
    const muted = sound.toggleMute();
    announce(muted ? 'Sound off.' : 'Sound on.');
  }

  if (input.consume('KeyP')) {
    if (mission.state === 'flying') mission.pause();
    else if (mission.state === 'paused') mission.resume();
  }

  if (input.consume('Enter') || input.consume('PointerDown')) {
    sound.unlock();
    if (mission.state === 'title') {
      mission.start(world, plane);
      announce(`${mission.mission.name} started. ${mission.mission.goal}`);
    } else if (mission.state === 'landed') {
      mission.resumeFlying();
      announce('Rolling again — throttle up.');
    }
  }

  if (input.consume('KeyR')) {
    if (mission.state === 'crashed' || mission.state === 'complete') {
      mission.start(world, plane);
      announce('New sortie started.');
    }
  }

  if (input.consume('Space') && mission.state === 'title') {
    sound.unlock();
    mission.start(world, plane);
  }
}

// Rebuild the world when the pilot picks another sortie on the title
// screen; the seed stays, so each mission keeps its own course.
let lastMissionIndex = mission.index;
function syncMissionWorld() {
  if (mission.index !== lastMissionIndex && mission.state === 'title') {
    lastMissionIndex = mission.index;
    world = new World(seed, mission.index);
    game.world = world;
    plane.reset(world, mission.index);
  }
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (game.frozen) {
    renderer.render(ctx, game);
    return;
  }
  game.time += dt;

  input.update();
  handleKeys();
  syncMissionWorld();

  if (mission.state === 'flying') {
    const before = plane.elapsed;
    plane.step(dt, input, world, game.time);
    const events = plane.drainEvents();
    if (events.length) {
      playEventSounds(events);
      mission.handleEvents(events, game.time, plane, game.world);
      announce(events[events.length - 1].text);
    }
    if (plane.elapsed !== before && plane.crashed) sound.crash();
  }

  sound.update(plane.throttle, plane.speed / CONFIG.plane.maxSpeed, mission.state === 'flying' && !plane.onGround);
  renderer.render(ctx, game);
}

requestAnimationFrame(frame);
