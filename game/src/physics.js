// Flight physics for the Kestrel: throttle, climb, bank, wind, fuel
// and damage. One clear job: turn the pilot's stick into a new plane
// state each tick, and report what the flight hit.

import { CONFIG } from './config.js';
import { clamp } from './random.js';

export class Plane {
  constructor(world, missionIndex) {
    this.reset(world, missionIndex);
  }

  reset(world, missionIndex) {
    const mission = world.mission;
    this.x = 0;
    this.y = 3; // parked on the home strip
    this.z = -60;
    this.speed = 0;
    this.heading = 0; // radians, 0 flies straight down +z
    this.bank = 0;
    this.pitchAngle = 0;
    this.throttle = 0;
    this.fuel = mission.fuelStart;
    this.damage = 0;
    this.score = 0;
    this.ringsPassed = 0;
    this.ringsMissed = 0;
    this.landings = 0;
    this.onGround = true;
    this.crashed = false;
    this.crashReason = '';
    this.graceUntil = 0;
    this.landed = false; // parked after a touchdown; cleared on takeoff
    this.landedRunways = new Set();
    this.stalled = false;
    this.missionIndex = missionIndex;
    this.elapsed = 0;
    this.events = []; // {kind, text} drained by the game each frame
  }

  // One fixed tick. Returns nothing; events land in this.events.
  step(dt, input, world, time) {
    if (this.crashed) return;
    this.elapsed += dt;
    const P = CONFIG.plane;

    // Throttle: held keys move it, wheel nudges ride along in input.
    this.throttle = clamp(this.throttle + input.throttleInput * dt * 0.55, 0, 1);

    // Speed chases the throttle's target, with drag at the top end.
    const targetSpeed = this.throttle * P.maxSpeed;
    const accel = targetSpeed > this.speed ? P.accel : P.accel * 1.6;
    this.speed += clamp(targetSpeed - this.speed, -accel * dt, accel * dt);

    // Bank follows the stick and eases back when the stick centres.
    // On the ground she rolls straight: no bank, no turn, no climb
    // until rotation speed.
    if (this.onGround) {
      this.bank += clamp(0 - this.bank, -P.rollRate * dt * 2.2, P.rollRate * dt * 2.2);
      this.pitchAngle = 0;
    } else {
      const targetBank = input.roll * P.maxBank;
      this.bank += clamp(targetBank - this.bank, -P.rollRate * dt * 2.2, P.rollRate * dt * 2.2);
      // Bank right turns right: heading grows, vx = sin(heading) * speed.
      this.heading += this.bank * P.turnRate * dt * (0.35 + 0.65 * (this.speed / P.maxSpeed));

      // Pitch: pull climbs, push dives, scaled by how fast she flies.
      const flying = this.speed > 8;
      const pitchAuthority = flying ? clamp(this.speed / P.cruiseSpeed, 0.25, 1) : 0;
      this.pitchAngle = input.pitch * 0.5 * pitchAuthority;
    }

    // Wind pushes the plane sideways, harder in the storm mission.
    const wind = world.windAt(this.z, time);
    const vx = Math.sin(this.heading) * this.speed + wind;
    const vz = Math.cos(this.heading) * this.speed;

    // Vertical speed: climb from pitch, sink from a stall.
    const flying = this.speed > 8;
    this.stalled = flying && this.speed < P.minFlySpeed && this.y > 8;
    let vy = this.pitchAngle * P.climbRate;
    if (this.stalled) vy -= (P.minFlySpeed - this.speed) * 0.55;
    if (!flying && this.y > 3) vy -= P.sinkRate * 0.5;

    this.x += vx * dt;
    this.z += vz * dt;
    this.y += vy * dt;

    // Takeoff roll: she lifts off once fast enough with any pull,
    // or on her own at cruise speed.
    if (this.onGround) {
      this.y = 3;
      if (this.speed > 34 && (input.pitch > 0.15 || this.speed > P.cruiseSpeed)) {
        this.onGround = false;
        this.landed = false;
        // Grace: she is still low over the strip she just left; the
        // ground check must not land her again on the way up.
        this.graceUntil = this.elapsed + 2;
        this.events.push({ kind: 'takeoff', text: 'Airborne — gear up, eyes on the rings.' });
      }
    }

    // Fuel burns with throttle; empty tanks glide her down.
    const burn = (P.fuelBurnIdle + this.throttle * (P.fuelBurnFull - P.fuelBurnIdle)) * dt;
    this.fuel = Math.max(0, this.fuel - burn);
    if (this.fuel <= 0 && this.throttle > 0) {
      this.throttle = Math.max(0, this.throttle - dt * 0.5);
      if (this.fuel <= 0 && this.events.filter((e) => e.kind === 'fuel').length === 0) {
        this.events.push({ kind: 'fuel', text: 'Fuel empty — gliding. Find a strip.' });
      }
    }

    this.checkRings(world);
    this.checkGround(world);
  }

  checkRings(world) {
    const R = CONFIG.rings;
    for (const ring of world.rings) {
      if (ring.passed || ring.missed) continue;
      if (this.z < ring.z) continue;
      // The plane has crossed the ring's plane: measure the offset.
      const dx = this.x - ring.x;
      const dy = this.y - ring.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= R.scoreRadius) {
        ring.passed = true;
        this.ringsPassed += 1;
        const bonus = this.speed > 70 ? CONFIG.scoring.ringSpeedBonus : 0;
        this.score += CONFIG.scoring.ring + bonus;
        this.events.push({ kind: 'ring', text: `Ring ${this.ringsPassed} clean! +${CONFIG.scoring.ring + bonus}` });
      } else if (dist <= R.radius + 2) {
        ring.passed = true;
        this.ringsPassed += 1;
        this.damage = Math.min(100, this.damage + CONFIG.plane.damagePerClip);
        this.score += Math.floor(CONFIG.scoring.ring / 2);
        this.events.push({ kind: 'clip', text: `Clipped the rim! +${Math.floor(CONFIG.scoring.ring / 2)} — damage ${Math.round(this.damage)}%` });
      } else {
        ring.missed = true;
        this.ringsMissed += 1;
        this.score = Math.max(0, this.score + CONFIG.scoring.miss);
        this.events.push({ kind: 'miss', text: `Ring missed ${CONFIG.scoring.miss}` });
      }
      if (this.damage >= 100) this.crash('The Kestrel came apart — damage 100%.');
      break; // one ring per crossing
    }
  }

  checkGround(world) {
    const ground = world.terrainHeight(this.x, this.z);
    // Runway touchdowns: flat, slow, centred and gentle. Not just
    // after takeoff, while she is still low over the strip. Strips
    // are flattened to 2.5 m, so a touchdown reads at y <= 6.5.
    for (let i = 0; i < world.runways.length; i++) {
      const r = world.runways[i];
      const dz = Math.abs(this.z - r.z);
      const dx = Math.abs(this.x - r.x);
      if (this.y <= 6.5 && !this.onGround && this.elapsed > (this.graceUntil || 0)) {
        if (dz < CONFIG.runways.length / 2 && dx < CONFIG.runways.width / 2 + 4) {
          const sink = -this.pitchAngle * CONFIG.plane.climbRate;
          const tooFast = this.speed > CONFIG.runways.landSpeedMax;
          const tooHard = sink > CONFIG.runways.landSinkMax;
          if (tooFast || tooHard) {
            const why = tooFast ? 'too fast' : 'too hard';
            this.crash(`Landing failed on ${r.name} — ${why}.`);
            return;
          }
          this.landOn(world, i, r, false);
          return;
        }
        // Rough field next to a strip: survivable, but it costs paint.
        if (dz < CONFIG.runways.length / 2 + 60 && dx < 70 && this.speed < CONFIG.runways.landSpeedMax) {
          this.damage = Math.min(100, this.damage + 10);
          this.landOn(world, i, r, true);
          return;
        }
      }
    }
    // Anywhere else, the ground is not a runway. The takeoff grace
    // covers this too: she leaves the ground at y = 3 and climbs away.
    if (this.y <= ground + 1.2 && !this.onGround && this.elapsed > (this.graceUntil || 0)) {
      if (this.speed > 20) {
        this.crash('Terrain strike — the isles are not forgiving.');
      } else {
        this.damage = Math.min(100, this.damage + CONFIG.plane.damagePerScrape);
        this.y = ground + 3;
        this.speed *= 0.4;
        this.events.push({ kind: 'scrape', text: `Brushed the ground — damage ${Math.round(this.damage)}%` });
        if (this.damage >= 100) this.crash('The Kestrel came apart — damage 100%.');
      }
    }
    if (this.y < 1.5) this.y = 1.5;
  }

  landOn(world, index, runway, rough) {
    this.onGround = true;
    this.landed = true;
    this.landedRunways.add(index);
    this.landings += 1;
    this.y = 3;
    this.speed *= 0.25;
    this.fuel = CONFIG.plane.fuelCapacity;
    this.score += CONFIG.scoring.landing;
    this.events.push({
      kind: 'land',
      text: rough
        ? `Rough landing beside ${runway.name} (+${CONFIG.scoring.landing}, damage +10%) — tanks refuelled.`
        : `Down safe on ${runway.name}! +${CONFIG.scoring.landing} — tanks refuelled.`,
    });
  }

  crash(reason) {
    if (this.crashed) return;
    this.crashed = true;
    this.crashReason = reason;
    this.speed = 0;
    this.events.push({ kind: 'crash', text: reason });
  }

  // The next objective in plain words for the HUD.
  objective(world) {
    const ring = world.nextRing();
    if (ring) {
      const n = world.rings.indexOf(ring) + 1;
      return `Ring ${n}/${world.rings.length} — ${Math.max(0, Math.round(ring.z - this.z))}m`;
    }
    // Next strip not yet landed on, skipping the home strip behind us.
    for (let i = 1; i < world.runways.length; i++) {
      if (!this.landedRunways.has(i)) {
        const r = world.runways[i];
        return `Land on ${r.name} — ${Math.max(0, Math.round(r.z - this.z))}m`;
      }
    }
    return 'Course complete';
  }

  drainEvents() {
    const out = this.events;
    this.events = [];
    return out;
  }
}
