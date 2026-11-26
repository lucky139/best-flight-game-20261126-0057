// The world of the Ember Isles: terrain, rings, runways and weather.
// One clear job: answer where the ground, the sky rings and the strips
// are, and project any world point onto the screen.

import { CONFIG, MISSIONS } from './config.js';
import { clamp, fbm2, hash2, mulberry32 } from './random.js';

// Distance from a point to a runway's rectangle, so the strip and
// its apron sit on level ground.
function stripDistance(x, z, r) {
  const dx = Math.max(Math.abs(x - r.x) - CONFIG.runways.width / 2, 0);
  const dz = Math.max(Math.abs(z - r.z) - CONFIG.runways.length / 2, 0);
  return Math.sqrt(dx * dx + dz * dz);
}

// A flattened apron around every runway: fully flat out to 30 m
// past the strip, easing back to the wild ground by 130 m.
function runwayFlatten(x, z, runways) {
  let flat = 0;
  for (const r of runways) {
    const d = stripDistance(x, z, r);
    if (d < 130) {
      const w = d < 30 ? 1 : 1 - (d - 30) / 100;
      flat = Math.max(flat, w);
    }
  }
  return flat;
}

export class World {
  constructor(seed, missionIndex) {
    this.seed = seed;
    this.mission = MISSIONS[missionIndex];
    this.rng = mulberry32(seed * 7919 + missionIndex * 131);
    this.runways = this.buildRunways();
    this.islands = this.buildIslands();
    this.rings = this.buildRings();
    this.clouds = this.buildClouds();
    this.windPhase = this.rng() * Math.PI * 2;
  }

  buildRunways() {
    // Home strip at the start line, then one per mission leg. A course
    // with no legs still needs somewhere to end: a final strip past
    // the last ring.
    const list = [{ x: 0, z: 0, name: 'Home Strip' }];
    const legs = this.mission.runways;
    legs.forEach((z, i) => {
      const x = (this.rng() - 0.5) * 260;
      list.push({ x, z, name: `Isle ${i + 1} Strip` });
    });
    if (legs.length === 0) {
      const lastRing = CONFIG.rings.firstAt + (this.mission.ringCount - 1) * CONFIG.rings.spacing;
      list.push({ x: (this.rng() - 0.5) * 120, z: lastRing + 520, name: 'Return Strip' });
    }
    return list;
  }

  buildRings() {
    const rings = [];
    const n = this.mission.ringCount;
    let x = 0;
    let y = 95;
    for (let i = 0; i < n; i++) {
      const z = CONFIG.rings.firstAt + i * CONFIG.rings.spacing;
      // The course weaves gently: a slow sine plus a seeded nudge.
      const targetX = Math.sin(i * 0.55 + this.seed) * 150 + (this.rng() - 0.5) * 60;
      x += (targetX - x) * 0.6;
      // High enough to clear the ground beneath it, low enough to
      // make the pilot work for it.
      const ground = this.terrainHeight(x, z);
      y = Math.min(200, Math.max(60, ground + 30 + this.rng() * 45));
      rings.push({ x, y, z, passed: false, missed: false });
    }
    return rings;
  }

  buildClouds() {
    const clouds = [];
    for (let i = 0; i < 26; i++) {
      clouds.push({
        x: (this.rng() - 0.5) * 1600,
        y: 230 + this.rng() * 130,
        z: 350 + this.rng() * 4900,
        w: 120 + this.rng() * 220,
        speed: 1.5 + this.rng() * 3,
      });
    }
    return clouds;
  }

  buildIslands() {
    // A handful of named isles the course threads between.
    const names = ['Ember', 'Gull', 'Tide', 'Ash', 'Lantern', 'Coral'];
    const isles = [];
    for (let i = 0; i < names.length; i++) {
      isles.push({
        name: names[i],
        x: (this.rng() - 0.5) * 700,
        z: 500 + i * 1250 + this.rng() * 300,
        r: 130 + this.rng() * 120,
      });
    }
    return isles;
  }

  // Height of the ground at (x, z) in metres above the sea.
  terrainHeight(x, z) {
    const s = this.seed;
    const hills = fbm2(x * 0.004, z * 0.004, s, 3) * CONFIG.world.hillAmp;
    const broad = fbm2(x * 0.0011 + 7.3, z * 0.0011 + 2.9, s + 5, 2);
    let h = 14 + hills + broad * 34;
    // Mountain ridges: noise crests above the threshold grow tall peaks.
    const ridge = fbm2(x * 0.0016 + 31, z * 0.0016 + 17, s + 11, 3);
    if (ridge > CONFIG.world.mountainThreshold) {
      h += (ridge - CONFIG.world.mountainThreshold) * CONFIG.world.mountainAmp * 2.4;
    }
    // Islands rise out of the sea as soft domes.
    for (const isle of this.islands) {
      const dx = x - isle.x;
      const dz = z - isle.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < isle.r) {
        const t = 1 - d / isle.r;
        h += t * t * 46;
      }
    }
    // Flatten the ground under every runway.
    const flat = runwayFlatten(x, z, this.runways);
    if (flat > 0) h = h * (1 - flat) + 2.5 * flat;
    // The course runs through a valley: cap the ground low near the
    // centreline so a climbing plane can always clear it, while the
    // peaks stand tall off to the sides.
    const ax = Math.abs(x);
    if (ax < 320) {
      const cap = 14 + (ax / 320) * 70;
      if (h > cap) h = cap;
    }
    // A clearway past every strip: flat ground to climb away over,
    // so a takeoff never meets a hillside just past the runway end.
    for (const r of this.runways) {
      const dx = Math.abs(x - r.x);
      if (dx < 70 && z > r.z - 200 && z < r.z + 500) {
        const w = (1 - dx / 70)
          * Math.min(1, (z - (r.z - 200)) / 80)
          * Math.min(1, (r.z + 500 - z) / 80);
        if (w > 0) h = h * (1 - w) + 3 * w;
      }
    }
    return h;
  }

  // Gusting crosswind, -1..1, stronger in the storm mission.
  windAt(z, time) {
    const strength = this.mission.wind;
    if (strength <= 0) return 0;
    const gust = Math.sin(z * 0.004 + time * 0.7 + this.windPhase) * 0.6
      + Math.sin(z * 0.013 - time * 1.3) * 0.4;
    return gust * strength * 7; // m/s of lateral push
  }

  // The next ring the pilot has not passed yet, or null.
  nextRing() {
    for (const ring of this.rings) {
      if (!ring.passed && !ring.missed) return ring;
    }
    return null;
  }

  // The next runway the pilot has not landed on yet, or null.
  nextRunway(landedCount) {
    return this.runways[landedCount] ?? null;
  }

  // Deterministic tree scatter: a cell of the ground grid either holds
  // a pine or it does not, by its hash, so trees never shimmer.
  treeAt(cellX, cellZ) {
    const h = hash2(cellX, cellZ, this.seed + 77);
    if (h < 0.62) return null;
    return {
      x: cellX * 55 + hash2(cellX, cellZ, this.seed + 78) * 40,
      z: cellZ * 55 + hash2(cellX, cellZ, this.seed + 79) * 40,
      size: 7 + hash2(cellX, cellZ, this.seed + 80) * 9,
    };
  }
}

// Project a world point to screen pixels. cam is {x, y, z}; scale folds
// the canvas size into the reference focal length. Returns null behind.
export function project(wx, wy, wz, cam, width, height) {
  const dz = wz - cam.z;
  if (dz < 4) return null;
  const focal = CONFIG.focal * (height / CONFIG.viewHeight);
  const s = focal / dz;
  const cx = width / 2;
  const horizon = CONFIG.horizonY * (height / CONFIG.viewHeight);
  return {
    x: cx + (wx - cam.x) * s,
    y: horizon - (wy - cam.y) * s,
    s,
  };
}

// Where the horizon sits on screen for a camera at height camY.
export function horizonScreenY(camY, height) {
  return CONFIG.horizonY * (height / CONFIG.viewHeight) - camY * 0.4;
}
