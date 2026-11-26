// Rendering for Sky Courier: chase view, terrain, rings, the Kestrel
// and every instrument. One clear job: turn the game state into one
// painted frame, and the title, pause and end screens with it.

import { CONFIG, PALETTE, GAME_NAME, GAME_SUBTITLE, MISSIONS, PLANE_NAME } from './config.js';
import { clamp, lerp } from './random.js';
import { project, horizonScreenY } from './world.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function groundColor(h, seedNoise) {
  if (h < 3) return PALETTE.seaShallow;
  if (h < 6) return PALETTE.sand;
  if (h < 30) return seedNoise > 0.5 ? PALETTE.grass : PALETTE.grassDark;
  if (h < 90) return seedNoise > 0.6 ? PALETTE.forest : PALETTE.grassDark;
  if (h < 150) return PALETTE.rock;
  return PALETTE.snow;
}

export class Renderer {
  render(ctx, g) {
    const { width: W, height: H } = g;
    const k = H / CONFIG.viewHeight;
    const cam = this.camera(g);
    this.drawSky(ctx, g, cam, k);
    this.drawMountains(ctx, g, cam, k);
    this.drawGround(ctx, g, cam, k);
    this.drawClouds(ctx, g, cam, k);
    this.drawRunways(ctx, g, cam, k);
    this.drawRings(ctx, g, cam, k);
    this.drawTrees(ctx, g, cam, k);
    this.drawRunwayLabels(ctx, g, cam, k);
    if (g.mission.state !== 'title') this.drawPlane(ctx, g, k);
    else this.drawPlane(ctx, g, k, { x: g.width * 0.82, y: g.height * 0.86, scale: 0.55 });
    this.drawHud(ctx, g, k);
    if (g.mission.state === 'title') this.drawTitle(ctx, g, k);
    if (g.mission.state === 'paused') this.drawPaused(ctx, g, k);
    if (g.mission.state === 'landed') this.drawLanded(ctx, g, k);
    if (g.mission.state === 'crashed') this.drawCrashed(ctx, g, k);
    if (g.mission.state === 'complete') this.drawComplete(ctx, g, k);
  }

  camera(g) {
    const p = g.plane;
    return {
      x: p.x * 0.92,
      y: p.y + 7,
      z: p.z - 30,
    };
  }

  drawSky(ctx, g, cam, k) {
    const { width: W, height: H } = g;
    const horizon = horizonScreenY(cam.y, H);
    const grad = ctx.createLinearGradient(0, 0, 0, horizon + 40 * k);
    grad.addColorStop(0, PALETTE.skyTop);
    grad.addColorStop(0.62, PALETTE.skyMid);
    grad.addColorStop(1, PALETTE.skyHorizon);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, Math.max(horizon + 40 * k, 0));
    // Low sun, fixed in the sky so the light always reads the same way.
    const sunX = W * 0.78;
    const sunY = horizon - 150 * k;
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 130 * k);
    glow.addColorStop(0, PALETTE.sunCore);
    glow.addColorStop(0.35, PALETTE.sun);
    glow.addColorStop(1, 'rgba(255, 217, 138, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 140 * k, sunY - 140 * k, 280 * k, 280 * k);
    ctx.fillStyle = PALETTE.sunCore;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26 * k, 0, Math.PI * 2);
    ctx.fill();
  }

  drawMountains(ctx, g, cam, k) {
    const { width: W, height: H } = g;
    const horizon = horizonScreenY(cam.y, H);
    const farZ = cam.z + 980;
    ctx.beginPath();
    ctx.moveTo(0, horizon + 2);
    for (let sx = 0; sx <= W; sx += 16) {
      const focal = CONFIG.focal * (H / CONFIG.viewHeight);
      const wx = cam.x + ((sx - W / 2) / focal) * 980;
      const h = g.world.terrainHeight(wx, farZ);
      const p = project(wx, h, farZ, cam, W, H);
      ctx.lineTo(sx, p ? p.y : horizon);
    }
    ctx.lineTo(W, horizon + 2);
    ctx.closePath();
    ctx.fillStyle = '#6d7f92';
    ctx.fill();
    // Snow caps: the same ridge, thinner and higher, in pale blue-white.
    ctx.beginPath();
    ctx.moveTo(0, horizon + 2);
    for (let sx = 0; sx <= W; sx += 16) {
      const focal = CONFIG.focal * (H / CONFIG.viewHeight);
      const wx = cam.x + ((sx - W / 2) / focal) * 980;
      const h = g.world.terrainHeight(wx, farZ);
      const top = h > 120 ? h : horizon;
      const p = project(wx, Math.max(h, 120), farZ, cam, W, H);
      ctx.lineTo(sx, h > 120 && p ? p.y : horizon + 2);
    }
    ctx.lineTo(W, horizon + 2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(232, 238, 242, 0.85)';
    ctx.fill();
  }

  drawGround(ctx, g, cam, k) {
    const { width: W, height: H } = g;
    const horizon = horizonScreenY(cam.y, H);
    // The sea fills everything below the horizon first.
    const sea = ctx.createLinearGradient(0, horizon, 0, H);
    sea.addColorStop(0, PALETTE.seaShallow);
    sea.addColorStop(1, PALETTE.seaDeep);
    ctx.fillStyle = sea;
    ctx.fillRect(0, horizon, W, H - horizon);
    // Ground strips, far to near, each a flat quad at the strip's height.
    let z = cam.z + CONFIG.world.viewDistance;
    while (z > cam.z + 6) {
      const step = z > cam.z + 500 ? CONFIG.world.stripStepFar : CONFIG.world.stripStepNear;
      const zFar = z;
      const zNear = Math.max(cam.z + 6, z - step);
      const hFar = g.world.terrainHeight(cam.x, zFar);
      const hNear = g.world.terrainHeight(cam.x, zNear);
      const pFL = project(cam.x - 700, hFar, zFar, cam, W, H);
      const pFR = project(cam.x + 700, hFar, zFar, cam, W, H);
      const pNL = project(cam.x - 700, hNear, zNear, cam, W, H);
      const pNR = project(cam.x + 700, hNear, zNear, cam, W, H);
      if (pFL && pFR && pNL && pNR) {
        const mid = (hFar + hNear) / 2;
        if (mid >= 3) {
          const noise = Math.abs(Math.sin(zFar * 0.021 + cam.x * 0.013));
          ctx.fillStyle = groundColor(mid, noise);
          ctx.beginPath();
          ctx.moveTo(pFL.x, pFL.y);
          ctx.lineTo(pFR.x, pFR.y);
          ctx.lineTo(pNR.x, pNR.y);
          ctx.lineTo(pNL.x, pNL.y);
          ctx.closePath();
          ctx.fill();
        }
      }
      z = zNear;
    }
  }

  drawClouds(ctx, g, cam, k) {
    const { width: W, height: H } = g;
    for (const c of g.world.clouds) {
      const dz = c.z - cam.z;
      if (dz < 350) continue; // a cloud on the lens is a white wall
      const p = project(c.x, c.y, c.z, cam, W, H);
      if (!p) continue;
      if (p.x < -260 || p.x > W + 260 || p.y < -80 || p.y > H * 0.55) continue;
      const w = Math.min(c.w * p.s * 0.9, 180 * k);
      const h = w * 0.36;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, w, h, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x - w * 0.5, p.y + h * 0.25, w * 0.55, h * 0.7, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x + w * 0.5, p.y + h * 0.2, w * 0.6, h * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawRunways(ctx, g, cam, k) {
    const { width: W, height: H } = g;
    for (const r of g.world.runways) {
      const half = CONFIG.runways.width / 2;
      const len = CONFIG.runways.length / 2;
      const a = project(r.x - half, 3.2, r.z - len, cam, W, H);
      const b = project(r.x + half, 3.2, r.z - len, cam, W, H);
      const c = project(r.x + half, 3.2, r.z + len, cam, W, H);
      const d = project(r.x - half, 3.2, r.z + len, cam, W, H);
      if (!a || !b || !c || !d) continue;
      ctx.fillStyle = PALETTE.runway;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fill();
      // Centreline dashes down the strip.
      ctx.strokeStyle = PALETTE.runwayLine;
      ctx.lineWidth = Math.max(1, 2.5 * k);
      for (let zz = r.z - len + 18; zz < r.z + len - 10; zz += 36) {
        const p1 = project(r.x, 3.4, zz, cam, W, H);
        const p2 = project(r.x, 3.4, zz + 18, cam, W, H);
        if (!p1 || !p2) continue;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }
  }

  // Strip names, drawn after the trees so no pine hides them.
  drawRunwayLabels(ctx, g, cam, k) {
    const { width: W, height: H } = g;
    for (const r of g.world.runways) {
      const next = g.plane.objective(g.world).includes(r.name);
      if (!next) continue;
      const label = project(r.x, 30, r.z, cam, W, H);
      if (!label) continue;
      ctx.font = `bold ${Math.round(15 * k)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4 * k;
      ctx.strokeStyle = 'rgba(10, 26, 40, 0.7)';
      ctx.strokeText(r.name, label.x, label.y);
      ctx.fillStyle = PALETTE.hudInk;
      ctx.fillText(r.name, label.x, label.y);
    }
  }

  drawRings(ctx, g, cam, k) {
    const { width: W, height: H } = g;
    const next = g.world.nextRing();
    for (const ring of g.world.rings) {
      if (ring.passed) continue; // flown rings are behind the pilot
      const p = project(ring.x, ring.y, ring.z, cam, W, H);
      if (!p) continue;
      if (p.x < -120 || p.x > W + 120 || p.y < -80 || p.y > H + 80) continue;
      const radius = Math.max(3, CONFIG.rings.radius * p.s);
      const isNext = ring === next;
      // Guide line from the ring down to the ground, so height reads.
      const foot = project(ring.x, g.world.terrainHeight(ring.x, ring.z), ring.z, cam, W, H);
      if (foot) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.setLineDash([6 * k, 6 * k]);
        ctx.lineWidth = 1.5 * k;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(foot.x, foot.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.lineWidth = Math.max(2, radius * 0.14);
      if (ring.missed) {
        ctx.strokeStyle = 'rgba(180, 190, 200, 0.5)';
      } else if (isNext) {
        ctx.save();
        ctx.shadowColor = PALETTE.ringGlow;
        ctx.shadowBlur = 18 * k;
        ctx.strokeStyle = PALETTE.ring;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        // Distance tag on the next ring.
        ctx.font = `bold ${Math.round(14 * k)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = PALETTE.ring;
        ctx.fillText(`${Math.max(0, Math.round(ring.z - g.plane.z))}m`, p.x, p.y - radius - 10 * k);
        continue;
      } else {
        ctx.strokeStyle = 'rgba(255, 207, 63, 0.45)';
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  drawTrees(ctx, g, cam, k) {
    const { width: W, height: H } = g;
    const cell = 55;
    const x0 = Math.floor((cam.x - 520) / cell);
    const x1 = Math.floor((cam.x + 520) / cell);
    const z0 = Math.floor((cam.z + 10) / cell);
    const z1 = Math.floor((cam.z + 640) / cell);
    ctx.fillStyle = PALETTE.forest;
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        const tree = g.world.treeAt(cx, cz);
        if (!tree) continue;
        const ground = g.world.terrainHeight(tree.x, tree.z);
        if (ground < 6 || ground > 90) continue;
        const p = project(tree.x, ground, tree.z, cam, W, H);
        if (!p) continue;
        if (p.x < -20 || p.x > W + 20 || p.y < 0 || p.y > H) continue;
        const size = tree.size * p.s * 1.6;
        if (size < 2) continue;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - size);
        ctx.lineTo(p.x - size * 0.55, p.y);
        ctx.lineTo(p.x + size * 0.55, p.y);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  drawPlane(ctx, g, k, at) {
    const { width: W, height: H } = g;
    const p = g.plane;
    const cx = at ? at.x : W / 2;
    const cy = at ? at.y : H * 0.68;
    const s = k * (at ? at.scale : 1);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(p.bank * 0.55);
    // Tail fin and stabiliser.
    ctx.fillStyle = PALETTE.planeTrim;
    ctx.beginPath();
    ctx.moveTo(-8 * s, -34 * s);
    ctx.lineTo(8 * s, -34 * s);
    ctx.lineTo(4 * s, -58 * s);
    ctx.lineTo(-4 * s, -58 * s);
    ctx.closePath();
    ctx.fill();
    // Wings: wide, pale, with red tips.
    ctx.fillStyle = PALETTE.planeWing;
    ctx.beginPath();
    ctx.moveTo(-150 * s, 6 * s);
    ctx.lineTo(-16 * s, -6 * s);
    ctx.lineTo(-16 * s, 14 * s);
    ctx.lineTo(-150 * s, 20 * s);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(150 * s, 6 * s);
    ctx.lineTo(16 * s, -6 * s);
    ctx.lineTo(16 * s, 14 * s);
    ctx.lineTo(150 * s, 20 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.planeBody;
    ctx.fillRect(-150 * s, 4 * s, 14 * s, 16 * s);
    ctx.fillRect(136 * s, 4 * s, 14 * s, 16 * s);
    // Fuselage: tapered nose to tail, red with a pale stripe.
    ctx.fillStyle = PALETTE.planeBody;
    ctx.beginPath();
    ctx.moveTo(-14 * s, -58 * s);
    ctx.quadraticCurveTo(-20 * s, -10 * s, -12 * s, 34 * s);
    ctx.quadraticCurveTo(0, 46 * s, 12 * s, 34 * s);
    ctx.quadraticCurveTo(20 * s, -10 * s, 14 * s, -58 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.planeWing;
    ctx.fillRect(-13 * s, -30 * s, 26 * s, 7 * s);
    // Cockpit glass.
    ctx.fillStyle = PALETTE.planeGlass;
    ctx.beginPath();
    ctx.ellipse(0, -18 * s, 8 * s, 14 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Propeller: a faint spinning disc at the nose, with blade streaks.
    ctx.fillStyle = 'rgba(200, 220, 230, 0.18)';
    ctx.beginPath();
    ctx.ellipse(0, 42 * s, 15 * s, 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40, 60, 75, 0.85)';
    ctx.lineWidth = 3 * s;
    const spin = g.time * (6 + p.throttle * 26);
    ctx.beginPath();
    ctx.moveTo(0, 40 * s - Math.sin(spin) * 24 * s);
    ctx.lineTo(0, 40 * s + Math.sin(spin) * 24 * s);
    ctx.stroke();
    // Navigation lights.
    ctx.fillStyle = '#ff5d4d';
    ctx.beginPath();
    ctx.arc(-148 * s, 12 * s, 3.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7ee2a0';
    ctx.beginPath();
    ctx.arc(148 * s, 12 * s, 3.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawHud(ctx, g, k) {
    const { width: W, height: H } = g;
    if (g.mission.state === 'title') return;
    const p = g.plane;
    const pad = 14 * k;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Left instrument panel: altitude, speed, heading, throttle.
    const panelW = 218 * k;
    const panelH = 118 * k;
    ctx.fillStyle = PALETTE.hudPanel;
    roundRect(ctx, pad, pad, panelW, panelH, 10 * k);
    ctx.fill();
    ctx.fillStyle = PALETTE.hudInk;
    ctx.font = `bold ${Math.round(22 * k)}px system-ui, sans-serif`;
    const alt = Math.max(0, Math.round(p.y));
    const spdKt = Math.round(p.speed * 1.944);
    const hdg = Math.round(((p.heading * 180) / Math.PI % 360 + 360) % 360);
    ctx.fillText(`ALT ${alt} m`, pad + 12 * k, pad + 30 * k);
    ctx.fillText(`SPD ${spdKt} kt`, pad + 12 * k, pad + 58 * k);
    ctx.fillText(`HDG ${String(hdg).padStart(3, '0')}°`, pad + 12 * k, pad + 86 * k);
    ctx.fillStyle = p.throttle > 0.85 ? PALETTE.hudAmber : PALETTE.hudDim;
    ctx.font = `${Math.round(15 * k)}px system-ui, sans-serif`;
    ctx.fillText(`THR ${Math.round(p.throttle * 100)}%`, pad + 12 * k, pad + 108 * k);

    // Right panel: fuel, damage, score, rings, time.
    const rw = 218 * k;
    ctx.fillStyle = PALETTE.hudPanel;
    roundRect(ctx, W - pad - rw, pad, rw, panelH, 10 * k);
    ctx.fill();
    const bx = W - pad - rw + 12 * k;
    ctx.fillStyle = PALETTE.hudInk;
    ctx.font = `bold ${Math.round(18 * k)}px system-ui, sans-serif`;
    ctx.fillText(`SCORE ${p.score}`, bx, pad + 26 * k);
    ctx.fillText(`RINGS ${p.ringsPassed}/${g.world.rings.length}`, bx, pad + 50 * k);
    const mins = Math.floor(p.elapsed / 60);
    const secs = Math.floor(p.elapsed % 60);
    ctx.fillText(`TIME ${mins}:${String(secs).padStart(2, '0')}`, bx, pad + 74 * k);
    this.bar(ctx, bx, pad + 84 * k, rw - 62 * k, 10 * k, p.fuel / 100, p.fuel < 25 ? PALETTE.hudRed : '#7ec850', 'FUEL');
    this.bar(ctx, bx, pad + 100 * k, rw - 62 * k, 8 * k, p.damage / 100, PALETTE.hudRed, 'DMG');

    // Objective banner, top centre.
    ctx.font = `bold ${Math.round(17 * k)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    const objective = p.objective(g.world);
    const obW = ctx.measureText(objective).width + 36 * k;
    ctx.fillStyle = PALETTE.hudPanel;
    roundRect(ctx, W / 2 - obW / 2, pad, obW, 34 * k, 17 * k);
    ctx.fill();
    ctx.fillStyle = PALETTE.hudInk;
    ctx.fillText(objective, W / 2, pad + 23 * k);

    // Compass strip under the banner.
    this.drawCompass(ctx, g, k);

    // Message line under the compass.
    if (g.mission.message && g.time < g.mission.messageUntil) {
      ctx.font = `${Math.round(16 * k)}px system-ui, sans-serif`;
      ctx.fillStyle = PALETTE.hudAmber;
      ctx.fillText(g.mission.message, W / 2, pad + 92 * k);
    }

    // Warnings, centre screen.
    const warnings = [];
    if (p.stalled) warnings.push('STALL — NOSE DOWN, THROTTLE UP');
    if (p.fuel > 0 && p.fuel < 22 && !p.onGround) warnings.push('LOW FUEL');
    const ground = g.world.terrainHeight(p.x, p.z);
    if (!p.onGround && p.y - ground < 22 && p.speed > 10) warnings.push('TERRAIN');
    if (warnings.length) {
      ctx.font = `bold ${Math.round(20 * k)}px system-ui, sans-serif`;
      ctx.fillStyle = PALETTE.hudRed;
      const blink = Math.floor(g.time * 3) % 2 === 0;
      if (blink) ctx.fillText(warnings.join('  ·  '), W / 2, H * 0.3);
    }

    // Artificial horizon, bottom right.
    this.drawAttitude(ctx, g, k);

    // Controls hint, bottom left, on a dark pill so it reads over sand.
    const hint = 'Arrows / WASD fly · Shift/Ctrl throttle · Mouse steers · P pause · M mute';
    ctx.textAlign = 'left';
    ctx.font = `${Math.round(13 * k)}px system-ui, sans-serif`;
    const hintW = ctx.measureText(hint).width + 20 * k;
    ctx.fillStyle = PALETTE.hudPanel;
    roundRect(ctx, pad - 4 * k, H - pad - 20 * k, hintW, 26 * k, 13 * k);
    ctx.fill();
    ctx.fillStyle = PALETTE.hudDim;
    ctx.fillText(hint, pad + 6 * k, H - pad - 2 * k);

    // Next-ring edge arrow when the ring is off-screen sideways.
    const next = g.world.nextRing();
    if (next && g.mission.state === 'flying') {
      const proj = project(next.x, next.y, next.z, this.camera(g), W, H);
      if (proj && (proj.x < 40 || proj.x > W - 40)) {
        const ax = proj.x < 40 ? 44 : W - 44;
        ctx.fillStyle = PALETTE.ring;
        ctx.font = `bold ${Math.round(26 * k)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(proj.x < 40 ? '◀' : '▶', ax, H * 0.42);
      }
    }
  }

  bar(ctx, x, y, w, h, frac, color, label) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + w + 6, y + h - 1);
  }

  drawCompass(ctx, g, k) {
    const { width: W } = g;
    const p = g.plane;
    const cy = 66 * k;
    const half = 170 * k;
    const hdg = ((p.heading * 180) / Math.PI % 360 + 360) % 360;
    ctx.save();
    ctx.beginPath();
    ctx.rect(W / 2 - half, cy - 12 * k, half * 2, 24 * k);
    ctx.clip();
    ctx.font = `${Math.round(13 * k)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    for (let d = -90; d <= 90; d += 15) {
      const deg = Math.round(hdg + d);
      const x = W / 2 + (d / 90) * half;
      const norm = ((deg % 360) + 360) % 360;
      const isLabel = norm % 30 === 0;
      ctx.fillStyle = d === 0 ? PALETTE.hudAmber : PALETTE.hudDim;
      if (isLabel) {
        const label = norm === 0 ? 'N' : norm === 90 ? 'E' : norm === 180 ? 'S' : norm === 270 ? 'W' : String(norm);
        ctx.fillText(label, x, cy + 4 * k);
      } else {
        ctx.fillRect(x - 0.75 * k, cy - 4 * k, 1.5 * k, 8 * k);
      }
    }
    ctx.restore();
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.beginPath();
    ctx.moveTo(W / 2, cy - 14 * k);
    ctx.lineTo(W / 2 - 5 * k, cy - 22 * k);
    ctx.lineTo(W / 2 + 5 * k, cy - 22 * k);
    ctx.closePath();
    ctx.fill();
  }

  drawAttitude(ctx, g, k) {
    const { width: W, height: H } = g;
    const p = g.plane;
    const cx = W - 66 * k;
    const cy = H - 66 * k;
    const r = 44 * k;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(-p.bank * 0.6);
    const pitchPx = clamp(p.pitchAngle * 2.2, -0.8, 0.8) * r;
    ctx.fillStyle = '#7fb2dd';
    ctx.fillRect(-r, -r - pitchPx, r * 2, r + pitchPx);
    ctx.fillStyle = '#5d8f4a';
    ctx.fillRect(-r, -pitchPx, r * 2, r + pitchPx);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.5 * k;
    ctx.beginPath();
    ctx.moveTo(-r, -pitchPx);
    ctx.lineTo(r, -pitchPx);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = PALETTE.hudInk;
    ctx.lineWidth = 2 * k;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    // Fixed wings marker.
    ctx.strokeStyle = PALETTE.hudAmber;
    ctx.lineWidth = 2.5 * k;
    ctx.beginPath();
    ctx.moveTo(cx - 16 * k, cy);
    ctx.lineTo(cx + 16 * k, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 3 * k, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.fill();
  }

  panel(ctx, W, H, k, lines, title, accent) {
    const w = 520 * k;
    const h = (92 + lines.length * 30) * k;
    const x = W / 2 - w / 2;
    const y = H / 2 - h / 2;
    ctx.fillStyle = 'rgba(8, 22, 34, 0.82)';
    roundRect(ctx, x, y, w, h, 14 * k);
    ctx.fill();
    ctx.strokeStyle = accent || PALETTE.hudAmber;
    ctx.lineWidth = 2 * k;
    roundRect(ctx, x, y, w, h, 14 * k);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = accent || PALETTE.hudAmber;
    ctx.font = `bold ${Math.round(26 * k)}px system-ui, sans-serif`;
    ctx.fillText(title, W / 2, y + 44 * k);
    ctx.fillStyle = PALETTE.hudInk;
    ctx.font = `${Math.round(17 * k)}px system-ui, sans-serif`;
    lines.forEach((line, i) => ctx.fillText(line, W / 2, y + 82 * k + i * 30 * k));
  }

  drawTitle(ctx, g, k) {
    const { width: W, height: H } = g;
    ctx.fillStyle = 'rgba(8, 22, 34, 0.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.hudInk;
    ctx.font = `bold ${Math.round(64 * k)}px system-ui, sans-serif`;
    ctx.fillText(GAME_NAME, W / 2, H * 0.2);
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.font = `bold ${Math.round(26 * k)}px system-ui, sans-serif`;
    ctx.fillText(GAME_SUBTITLE, W / 2, H * 0.2 + 40 * k);
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = `${Math.round(17 * k)}px system-ui, sans-serif`;
    ctx.fillText('Fly the Kestrel over the Ember Isles — thread the rings, mind the fuel, land her gentle.', W / 2, H * 0.2 + 74 * k);
    // Mission cards.
    const cardW = 300 * k;
    const cardH = 118 * k;
    const gap = 24 * k;
    const total = cardW * 3 + gap * 2;
    const y = H * 0.42;
    MISSIONS.forEach((m, i) => {
      const x = W / 2 - total / 2 + i * (cardW + gap);
      const selected = i === g.mission.index;
      ctx.fillStyle = selected ? 'rgba(255, 197, 61, 0.16)' : PALETTE.hudPanel;
      roundRect(ctx, x, y, cardW, cardH, 12 * k);
      ctx.fill();
      ctx.strokeStyle = selected ? PALETTE.hudAmber : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = selected ? 3 * k : 1.5 * k;
      roundRect(ctx, x, y, cardW, cardH, 12 * k);
      ctx.stroke();
      ctx.fillStyle = selected ? PALETTE.hudAmber : PALETTE.hudInk;
      ctx.font = `bold ${Math.round(20 * k)}px system-ui, sans-serif`;
      ctx.fillText(`${i + 1} · ${m.name}`, x + cardW / 2, y + 32 * k);
      ctx.fillStyle = PALETTE.hudDim;
      ctx.font = `${Math.round(14 * k)}px system-ui, sans-serif`;
      this.wrapText(ctx, m.blurb, x + cardW / 2, y + 58 * k, cardW - 28 * k, 19 * k);
      ctx.fillStyle = PALETTE.hudDim;
      ctx.font = `${Math.round(13 * k)}px system-ui, sans-serif`;
      ctx.fillText(`${m.ringCount} rings · par ${m.parSeconds}s`, x + cardW / 2, y + cardH - 14 * k);
    });
    ctx.fillStyle = PALETTE.hudInk;
    ctx.font = `${Math.round(17 * k)}px system-ui, sans-serif`;
    ctx.fillText('Press 1–3 to choose a sortie, ENTER or click to fly', W / 2, y + cardH + 44 * k);
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = `${Math.round(15 * k)}px system-ui, sans-serif`;
    ctx.fillText('Arrows / WASD — fly · Shift / Ctrl — throttle · Mouse — steer · Wheel — throttle · P — pause · M — mute', W / 2, y + cardH + 72 * k);
    if (g.mission.best > 0) {
      ctx.fillStyle = PALETTE.hudAmber;
      ctx.fillText(`Best score so far: ${g.mission.best}`, W / 2, y + cardH + 100 * k);
    }
  }

  wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let yy = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, yy);
        line = word;
        yy += lineHeight;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, x, yy);
  }

  drawPaused(ctx, g, k) {
    const { width: W, height: H } = g;
    ctx.fillStyle = 'rgba(8, 22, 34, 0.5)';
    ctx.fillRect(0, 0, W, H);
    this.panel(ctx, W, H, k, ['Press P or click to keep flying.'], 'PAUSED');
  }

  drawLanded(ctx, g, k) {
    const { width: W, height: H } = g;
    const p = g.plane;
    this.panel(ctx, W, H, k, [
      `Score ${p.score} · Fuel refilled · Damage ${Math.round(p.damage)}%`,
      p.objective(g.world),
      'Press ENTER to take off again.',
    ], 'DOWN SAFE');
  }

  drawCrashed(ctx, g, k) {
    const { width: W, height: H } = g;
    const p = g.plane;
    const total = g.mission.crashTotal(p);
    this.panel(ctx, W, H, k, [
      g.mission.message || p.crashReason,
      `Score ${total.total} · Best ${total.best}`,
      'Press R to fly again, 1–3 to change sortie.',
    ], 'CRASHED', PALETTE.hudRed);
  }

  drawComplete(ctx, g, k) {
    const { width: W, height: H } = g;
    const b = g.mission.breakdown(g.plane, g.world);
    this.panel(ctx, W, H, k, [
      b.rings,
      b.landings,
      b.time,
      b.damage,
      `TOTAL ${b.total} · BEST ${b.best}`,
      'Press R to fly again, 1–3 to change sortie.',
    ], 'SORTIE COMPLETE', '#7ee2a0');
  }
}
