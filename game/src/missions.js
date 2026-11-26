// Missions for Sky Courier: which sortie, what counts as done,
// and the score at the end. One clear job: the rules of winning.

import { CONFIG, MISSIONS } from './config.js';

export class MissionRunner {
  constructor() {
    this.index = 0;
    this.state = 'title'; // title | flying | landed | crashed | complete | paused
    this.message = '';
    this.messageUntil = 0;
    this.best = 0;
    this.finalBreakdown = null;
    this.pausedFrom = 'flying';
  }

  get mission() {
    return MISSIONS[this.index];
  }

  select(index) {
    this.index = ((index % MISSIONS.length) + MISSIONS.length) % MISSIONS.length;
  }

  start(world, plane) {
    plane.reset(world, this.index);
    this.state = 'flying';
    this.message = `${this.mission.name} — ${this.mission.goal}`;
    this.messageUntil = 8;
    this.finalBreakdown = null;
  }

  // Drain plane events into messages, sounds and state changes.
  handleEvents(events, now, plane, world) {
    for (const e of events) {
      if (e.kind === 'land') {
        this.message = e.text;
        this.messageUntil = now + 6;
        if (this.isComplete(plane, world)) {
          this.state = 'complete';
          this.message = '';
        } else {
          this.state = 'landed';
        }
      } else if (e.kind === 'crash') {
        this.state = 'crashed';
        this.message = e.text;
      } else {
        this.message = e.text;
        this.messageUntil = now + 4;
      }
    }
  }

  // Complete when every ring is flown and every leg strip is landed on.
  isComplete(plane, world) {
    const ringsDone = world.rings.every((r) => r.passed || r.missed);
    const legsDone = world.runways.slice(1).every((_, i) => plane.landedRunways.has(i + 1));
    return ringsDone && legsDone;
  }

  // Score breakdown for the end screen. Called once when complete.
  breakdown(plane, world) {
    if (this.finalBreakdown) return this.finalBreakdown;
    const mission = this.mission;
    const timeLeft = Math.max(0, mission.parSeconds - plane.elapsed);
    const timeBonus = Math.round(timeLeft * CONFIG.scoring.timeBonusPerSecond);
    const ringScore = plane.ringsPassed * CONFIG.scoring.ring;
    const landScore = plane.landings * CONFIG.scoring.landing;
    const damagePenalty = Math.round(plane.damage * 0.5);
    const total = Math.max(0, ringScore + landScore + timeBonus - damagePenalty);
    plane.score = total;
    this.best = Math.max(this.best, total);
    this.finalBreakdown = {
      rings: `${plane.ringsPassed}/${world.rings.length} rings — ${ringScore}`,
      landings: `${plane.landings} landing${plane.landings === 1 ? '' : 's'} — ${landScore}`,
      time: `${Math.round(timeLeft)}s under par — +${timeBonus}`,
      damage: `${Math.round(plane.damage)}% damage — -${damagePenalty}`,
      total,
      best: this.best,
    };
    return this.finalBreakdown;
  }

  crashTotal(plane) {
    this.best = Math.max(this.best, plane.score);
    return { total: plane.score, best: this.best };
  }

  pause() {
    if (this.state === 'flying') {
      this.pausedFrom = 'flying';
      this.state = 'paused';
    }
  }

  resume() {
    if (this.state === 'paused') this.state = this.pausedFrom;
  }

  // The pilot is sitting on a strip mid-sortie; take off again.
  resumeFlying() {
    if (this.state === 'landed') this.state = 'flying';
  }
}
