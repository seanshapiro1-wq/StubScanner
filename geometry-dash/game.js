/* ============================================================
   GEOMETRIC DASH — a Geometry Dash style game
   Modes: cube, ship, ball, ufo, wave, spider
   Portals: mode, gravity (upside-down), mini/big
   Two levels: Breezy Lane (easy) & Neon Inferno (hard)
   Controls: click / tap / space / up-arrow.  Hold for ship & wave.
   R = restart, Esc = back to menu.
   ============================================================ */
'use strict';

const CV = document.getElementById('cv');
const CT = CV.getContext('2d');
const W = 960, H = 540;
const B = 40;            // grid block size
const FLOOR = 480;       // y of the floor surface
const CEIL = 40;         // y of the ceiling surface (corridor = 11 cells)
const ROWS = (FLOOR - CEIL) / B; // 11

/* ---------------- audio (tiny synth, no assets) ---------------- */
let AC = null;
function beep(freq, dur, type, vol) {
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.05, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
    o.connect(g); g.connect(AC.destination);
    o.start(); o.stop(AC.currentTime + dur);
  } catch (e) { /* audio unavailable */ }
}
const sndJump   = () => beep(420, 0.08, 'square', 0.03);
const sndPortal = () => beep(660, 0.18, 'triangle', 0.06);
const sndPad    = () => beep(520, 0.15, 'sawtooth', 0.05);
const sndOrb    = () => beep(760, 0.12, 'square', 0.05);
const sndDeath  = () => { beep(160, 0.3, 'sawtooth', 0.08); beep(110, 0.4, 'square', 0.06); };
const sndWin    = () => { beep(523, 0.15, 'square', 0.06); setTimeout(() => beep(659, 0.15, 'square', 0.06), 130); setTimeout(() => beep(784, 0.3, 'square', 0.06), 260); };

/* ---------------- level construction helpers ----------------
   Cell coords: column c (x = c*B), row r (0 = sitting on floor).   */
function blk(o, c, r, w, h) {            // solid block, w x h cells
  o.push({ k: 'block', x: c * B, y: FLOOR - (r + h) * B, w: w * B, h: h * B });
}
function spikes(o, c, n, r) {            // n ground spikes (point up)
  r = r || 0;
  for (let i = 0; i < n; i++) o.push({ k: 'spike', x: (c + i) * B, y: FLOOR - (r + 1) * B, d: 1 });
}
function cspikes(o, c, n) {              // n ceiling spikes (point down)
  for (let i = 0; i < n; i++) o.push({ k: 'spike', x: (c + i) * B, y: CEIL, d: -1 });
}
function pillar(o, c, gapRow, gapH) {    // full-height wall with a gap
  if (gapRow > 0) blk(o, c, 0, 1, gapRow);
  const topH = ROWS - gapRow - gapH;
  if (topH > 0) blk(o, c, gapRow + gapH, 1, topH);
}
function slabB(o, c, w, h) { blk(o, c, 0, w, h); }          // slab on floor
function slabT(o, c, w, h) { blk(o, c, ROWS - h, w, h); }   // slab on ceiling
function portal(o, c, kind) { o.push({ k: 'portal', x: c * B + 8, w: 24, kind: kind }); }
function pad(o, c) { o.push({ k: 'pad', x: c * B, y: FLOOR - 10 }); }
function orb(o, c, r) { o.push({ k: 'orb', x: c * B + B / 2, y: FLOOR - r * B - B / 2 }); }

const PORTAL_INFO = {
  cube:      { col: '#7CFC00', label: 'CUBE' },
  ship:      { col: '#ff66d9', label: 'SHIP' },
  ball:      { col: '#ff8c2e', label: 'BALL' },
  ufo:       { col: '#ffd84d', label: 'UFO' },
  wave:      { col: '#00eaff', label: 'WAVE' },
  spider:    { col: '#b266ff', label: 'SPIDER' },
  grav_up:   { col: '#ffe14d', label: 'FLIP' },
  grav_down: { col: '#4d79ff', label: 'FLIP' },
  mini:      { col: '#ff9ed2', label: 'MINI' },
  big:       { col: '#6dff6d', label: 'BIG' },
};

/* ---------------- LEVEL 1 : easy ---------------- */
function buildEasy() {
  const o = [];
  /* --- cube --- */
  spikes(o, 18, 1); spikes(o, 26, 1); spikes(o, 34, 1);
  spikes(o, 44, 2);
  blk(o, 54, 0, 2, 1); spikes(o, 59, 1);
  pad(o, 66);
  spikes(o, 75, 2);
  spikes(o, 84, 1); spikes(o, 90, 2); spikes(o, 100, 1);
  portal(o, 112, 'ship');
  /* --- ship --- */
  spikes(o, 120, 3); cspikes(o, 130, 3);
  pillar(o, 140, 4, 4);
  pillar(o, 152, 2, 4);
  pillar(o, 164, 5, 4);
  spikes(o, 172, 4); cspikes(o, 180, 4);
  portal(o, 192, 'ball');
  /* --- ball --- */
  cspikes(o, 202, 4);          // stay on floor
  spikes(o, 212, 4);           // flip to ceiling
  cspikes(o, 224, 4);          // back to floor
  spikes(o, 234, 4);           // ceiling again
  cspikes(o, 244, 3);          // floor
  portal(o, 249, 'grav_down');
  portal(o, 252, 'ufo');
  /* --- ufo --- */
  spikes(o, 262, 3); spikes(o, 274, 3);
  blk(o, 286, 0, 2, 2);
  cspikes(o, 296, 4);
  spikes(o, 306, 4);
  pillar(o, 316, 4, 5);
  portal(o, 322, 'wave');
  /* --- wave --- */
  slabB(o, 330, 11, 3);
  slabT(o, 345, 11, 3);
  slabB(o, 360, 11, 3);
  slabT(o, 375, 11, 3);
  portal(o, 392, 'spider');
  /* --- spider --- */
  spikes(o, 402, 3);           // hop to ceiling
  cspikes(o, 412, 3);          // back to floor
  spikes(o, 422, 4);
  cspikes(o, 432, 3);
  portal(o, 440, 'grav_down');
  portal(o, 442, 'cube');
  /* --- mini cube finale --- */
  portal(o, 447, 'mini');
  spikes(o, 452, 1); spikes(o, 457, 1); spikes(o, 462, 2);
  return { name: 'Breezy Lane', diff: 'EASY', stars: 2, speed: 6.0,
           hue: 205, col: '#2db4ff', objs: o, len: 472 * B };
}

/* ---------------- LEVEL 2 : hard ---------------- */
function buildHard() {
  const o = [];
  /* --- cube --- */
  spikes(o, 12, 1); spikes(o, 20, 2); spikes(o, 28, 2);
  spikes(o, 38, 3);
  blk(o, 48, 0, 1, 1); spikes(o, 51, 2); blk(o, 55, 0, 1, 1);
  portal(o, 60, 'grav_up');               // upside-down cube on ceiling
  cspikes(o, 66, 2); cspikes(o, 73, 2);
  portal(o, 80, 'grav_down');
  portal(o, 84, 'mini');                  // mini cube
  spikes(o, 90, 2); spikes(o, 96, 2); spikes(o, 103, 2);
  portal(o, 112, 'big');
  portal(o, 116, 'ship');
  /* --- ship slalom --- */
  pillar(o, 124, 6, 3);
  pillar(o, 132, 2, 3);
  pillar(o, 140, 5, 3);
  pillar(o, 148, 1, 3);
  pillar(o, 156, 4, 3);
  spikes(o, 162, 4); cspikes(o, 167, 4);
  spikes(o, 172, 3); cspikes(o, 176, 3);
  portal(o, 182, 'ball');
  /* --- ball --- */
  cspikes(o, 188, 3);
  spikes(o, 195, 3);
  cspikes(o, 202, 3);
  spikes(o, 209, 3);
  cspikes(o, 216, 3);
  spikes(o, 222, 2); cspikes(o, 225, 2);
  portal(o, 229, 'grav_down');
  portal(o, 232, 'ufo');
  /* --- ufo, including upside-down --- */
  portal(o, 238, 'grav_up');              // ufo along the ceiling
  cspikes(o, 244, 3);
  spikes(o, 252, 3);
  pillar(o, 262, 3, 3);
  portal(o, 270, 'grav_down');
  spikes(o, 276, 3); cspikes(o, 283, 3);
  portal(o, 288, 'mini');                 // mini wave next
  portal(o, 292, 'wave');
  /* --- mini wave --- */
  slabB(o, 298, 9, 5);
  slabT(o, 311, 9, 5);
  slabB(o, 324, 9, 5);
  slabT(o, 337, 9, 5);
  portal(o, 348, 'big');
  portal(o, 352, 'spider');
  /* --- spider spam --- */
  spikes(o, 358, 3);
  cspikes(o, 364, 3);
  spikes(o, 370, 3);
  cspikes(o, 376, 3);
  spikes(o, 382, 4);
  cspikes(o, 389, 3);
  portal(o, 395, 'grav_down');
  portal(o, 398, 'cube');
  /* --- cube finale --- */
  orb(o, 409, 3);
  spikes(o, 408, 3);
  spikes(o, 416, 2);
  spikes(o, 423, 1);
  return { name: 'Neon Inferno', diff: 'HARD', stars: 8, speed: 6.5,
           hue: 335, col: '#ff3d6e', objs: o, len: 430 * B };
}

const LEVELS = [buildEasy(), buildHard()];

/* ---------------- game state ---------------- */
let state = 'menu';      // menu | play | dead | win
let lvIdx = 0;
let LV = LEVELS[0];
let attempts = 1;
let deadT = 0, winT = 0, shakeT = 0, frame = 0;
let particles = [];
let trail = [];

const p = {
  x: 0, y: 0, vy: 0, mode: 'cube', grav: 1, mini: false,
  grounded: false, rot: 0, lastFlip: 0,
};

let holding = false, tapT = 0;

function best(i) { return parseInt(localStorage.getItem('gdclone_best_' + i) || '0', 10); }
function setBest(i, v) { if (v > best(i)) localStorage.setItem('gdclone_best_' + i, String(Math.floor(v))); }

function size() { return p.mode === 'wave' ? (p.mini ? 16 : 22) : (p.mini ? 24 : 36); }

function resetPlayer() {
  p.mode = 'cube'; p.grav = 1; p.mini = false;
  p.x = -2 * B; p.y = FLOOR - size() / 2; p.vy = 0;
  p.grounded = true; p.rot = 0;
  trail = []; particles = []; tapT = 0;
}

function startLevel(i) {
  lvIdx = i; LV = LEVELS[i];
  attempts = 1;
  resetPlayer();
  state = 'play';
}

function die() {
  if (state !== 'play') return;
  state = 'dead'; deadT = 50; shakeT = 18;
  sndDeath();
  setBest(lvIdx, p.x / LV.len * 100);
  for (let i = 0; i < 36; i++) {
    const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 6;
    particles.push({ x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                     life: 30 + Math.random() * 25, col: Math.random() < 0.5 ? '#37d2ff' : '#aaff00', sz: 3 + Math.random() * 4 });
  }
}

function win() {
  if (state !== 'play') return;
  state = 'win'; winT = 0;
  sndWin();
  setBest(lvIdx, 100);
  for (let i = 0; i < 80; i++) {
    particles.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 10, vy: -2 - Math.random() * 8,
                     life: 60 + Math.random() * 60, col: 'hsl(' + (Math.random() * 360 | 0) + ',90%,60%)', sz: 3 + Math.random() * 4 });
  }
}

/* ---------------- physics ---------------- */
function applyPortal(kind) {
  switch (kind) {
    case 'grav_up':   if (p.grav !== -1) { p.grav = -1; sndPortal(); } return;
    case 'grav_down': if (p.grav !== 1)  { p.grav = 1;  sndPortal(); } return;
    case 'mini':      if (!p.mini) { p.mini = true;  sndPortal(); } return;
    case 'big':       if (p.mini)  { p.mini = false; sndPortal(); } return;
    default:          if (p.mode !== kind) { p.mode = kind; p.rot = 0; sndPortal(); }
  }
}

function update() {
  frame++;
  if (tapT > 0) tapT--;
  const spd = LV.speed;
  const s = size() / 2;
  const wasGrounded = p.grounded;

  /* --- input / per-mode motion --- */
  switch (p.mode) {
    case 'cube': {
      const g = 0.95, jv = p.mini ? 11.2 : 13;
      if (wasGrounded && holding) { p.vy = -jv * p.grav; p.grounded = false; sndJump(); }
      p.vy += g * p.grav;
      break;
    }
    case 'ship': {
      const a = (holding ? -0.55 : 0.5) * (p.mini ? 1.25 : 1);
      p.vy += a * p.grav;
      p.vy = Math.max(-8.5, Math.min(8.5, p.vy));
      break;
    }
    case 'ball': {
      if (tapT > 0 && wasGrounded && frame - p.lastFlip > 8) {
        p.grav *= -1; p.grounded = false; p.lastFlip = frame; tapT = 0; sndJump();
      }
      p.vy += 1.05 * p.grav;
      break;
    }
    case 'ufo': {
      if (tapT > 0) { p.vy = (p.mini ? -7.4 : -8.6) * p.grav; tapT = 0; sndJump(); }
      p.vy += 0.55 * p.grav;
      p.vy = Math.max(-11, Math.min(11, p.vy));
      break;
    }
    case 'wave': {
      p.vy = (holding ? -1 : 1) * spd * (p.mini ? 1.7 : 1);
      break;
    }
    case 'spider': {
      if (tapT > 0) {
        p.grav *= -1; tapT = 0;
        const ns = size() / 2;
        // dash to the opposite surface of the corridor
        for (let i = 0; i < 10; i++) particles.push({ x: p.x, y: p.y + (Math.random() - .5) * 30, vx: -2 - Math.random() * 2, vy: (Math.random() - .5) * 2, life: 20, col: '#b266ff', sz: 3 });
        p.y = p.grav === 1 ? FLOOR - ns : CEIL + ns;
        p.vy = 0; p.grounded = true; sndJump();
      } else {
        p.vy += 1.6 * p.grav;
      }
      break;
    }
  }

  const prevY = p.y;
  p.x += spd;
  if (p.mode !== 'spider' || tapT === 0) p.y += p.vy;
  p.grounded = false;

  /* --- portals / pads / orbs / blocks --- */
  for (const o of LV.objs) {
    if (o.k === 'spike') continue;
    if (o.k === 'portal') {
      if (p.x + s > o.x && p.x - s < o.x + o.w) applyPortal(o.kind);
      continue;
    }
    if (o.k === 'pad') {
      if (p.x + s > o.x && p.x - s < o.x + B && p.y + s > FLOOR - 25 && p.grav === 1) {
        if (p.vy > -10) { p.vy = -16; sndPad(); }
      }
      continue;
    }
    if (o.k === 'orb') {
      if (tapT > 0 && Math.abs(p.x - o.x) < 36 && Math.abs(p.y - o.y) < 40) {
        p.vy = -13 * p.grav; tapT = 0; p.grounded = false; sndOrb();
      }
      continue;
    }
    /* block */
    if (p.x + s <= o.x || p.x - s >= o.x + o.w) continue;
    if (p.y + s <= o.y || p.y - s >= o.y + o.h) continue;
    if (p.mode === 'wave') { die(); return; }
    const top = o.y, bot = o.y + o.h;
    const tol = Math.abs(p.vy) + 6;
    if (p.grav === 1 && p.vy >= 0 && prevY + s <= top + tol) {
      p.y = top - s; p.vy = 0; p.grounded = true;            // landed on top
    } else if (p.grav === -1 && p.vy <= 0 && prevY - s >= bot - tol) {
      p.y = bot + s; p.vy = 0; p.grounded = true;            // landed on underside
    } else if (p.mode === 'ship' || p.mode === 'ufo') {
      if (p.grav === 1 && p.vy < 0 && prevY - s >= bot - tol) { p.y = bot + s; p.vy = 0; }
      else if (p.grav === -1 && p.vy > 0 && prevY + s <= top + tol) { p.y = top - s; p.vy = 0; }
      else { die(); return; }                                // side hit
    } else { die(); return; }                                // side / face hit
  }

  /* --- floor & ceiling --- */
  if (p.y + s > FLOOR) {
    p.y = FLOOR - s; p.vy = Math.min(p.vy, 0);
    if (p.grav === 1) { p.grounded = true; p.vy = 0; } else p.vy = 0;
  }
  if (p.y - s < CEIL) {
    p.y = CEIL + s; p.vy = Math.max(p.vy, 0);
    if (p.grav === -1) { p.grounded = true; p.vy = 0; } else p.vy = 0;
  }

  /* --- spikes (forgiving hitboxes) --- */
  const ps = s * 0.62;
  for (const o of LV.objs) {
    if (o.k !== 'spike') continue;
    const hx = o.x + 13, hw = 14;
    const hy = o.d === 1 ? o.y + 22 : o.y, hh = 18;
    if (p.x + ps > hx && p.x - ps < hx + hw && p.y + ps > hy && p.y - ps < hy + hh) { die(); return; }
  }

  /* --- rotation / trail --- */
  if (p.mode === 'cube') p.rot = p.grounded ? 0 : p.rot + 0.12 * p.grav;
  if (p.mode === 'ball') p.rot += 0.16;
  if (p.mode === 'ship') p.rot = p.vy * 0.05;
  if (p.mode === 'ufo') p.rot = p.vy * 0.02;
  if (p.mode === 'wave') {
    p.rot = Math.atan2(p.vy, spd);
    trail.push({ x: p.x, y: p.y });
    if (trail.length > 40) trail.shift();
  } else if (trail.length) trail.shift();

  if (p.x >= LV.len) win();
}

/* ---------------- rendering ---------------- */
function rrect(x, y, w, h, r) {
  CT.beginPath();
  CT.moveTo(x + r, y);
  CT.arcTo(x + w, y, x + w, y + h, r);
  CT.arcTo(x + w, y + h, x, y + h, r);
  CT.arcTo(x, y + h, x, y, r);
  CT.arcTo(x, y, x + w, y, r);
  CT.closePath();
}

function drawBG(camX) {
  const hue = (LV.hue + p.x / 80) % 360;
  const g = CT.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'hsl(' + hue + ',65%,16%)');
  g.addColorStop(1, 'hsl(' + (hue + 30) % 360 + ',70%,28%)');
  CT.fillStyle = g;
  CT.fillRect(0, 0, W, H);
  // parallax squares
  CT.fillStyle = 'rgba(255,255,255,0.045)';
  const px = camX * 0.35;
  for (let i = -1; i < 8; i++) {
    const bx = i * 160 - (px % 160);
    CT.fillRect(bx, 110 + ((i * 73) % 140), 90, 90);
  }
  // ground & ceiling
  CT.fillStyle = 'hsl(' + hue + ',60%,12%)';
  CT.fillRect(0, FLOOR, W, H - FLOOR);
  CT.fillRect(0, 0, W, CEIL);
  CT.strokeStyle = 'rgba(255,255,255,0.85)'; CT.lineWidth = 2;
  CT.beginPath(); CT.moveTo(0, FLOOR); CT.lineTo(W, FLOOR); CT.stroke();
  CT.beginPath(); CT.moveTo(0, CEIL); CT.lineTo(W, CEIL); CT.stroke();
  CT.strokeStyle = 'rgba(255,255,255,0.12)'; CT.lineWidth = 1;
  for (let i = 0; i <= W / B + 1; i++) {
    const lx = i * B - (camX % B);
    CT.beginPath(); CT.moveTo(lx, FLOOR); CT.lineTo(lx, H); CT.stroke();
    CT.beginPath(); CT.moveTo(lx, 0); CT.lineTo(lx, CEIL); CT.stroke();
  }
}

function drawObjects(camX) {
  for (const o of LV.objs) {
    const ox = (o.x !== undefined ? o.x : 0) - camX;
    if (o.k === 'block') {
      if (ox + o.w < -50 || ox > W + 50) continue;
      CT.fillStyle = '#101522';
      CT.fillRect(ox, o.y, o.w, o.h);
      CT.strokeStyle = '#9fd8ff'; CT.lineWidth = 2;
      CT.strokeRect(ox + 1, o.y + 1, o.w - 2, o.h - 2);
      CT.strokeStyle = 'rgba(159,216,255,0.25)'; CT.lineWidth = 1;
      for (let cx2 = B; cx2 < o.w; cx2 += B) { CT.beginPath(); CT.moveTo(ox + cx2, o.y); CT.lineTo(ox + cx2, o.y + o.h); CT.stroke(); }
      for (let cy2 = B; cy2 < o.h; cy2 += B) { CT.beginPath(); CT.moveTo(ox, o.y + cy2); CT.lineTo(ox + o.w, o.y + cy2); CT.stroke(); }
    } else if (o.k === 'spike') {
      if (ox + B < -50 || ox > W + 50) continue;
      CT.fillStyle = '#0d1018';
      CT.strokeStyle = '#ffffff'; CT.lineWidth = 2;
      CT.beginPath();
      if (o.d === 1) { CT.moveTo(ox + 2, o.y + B); CT.lineTo(ox + B / 2, o.y + 3); CT.lineTo(ox + B - 2, o.y + B); }
      else { CT.moveTo(ox + 2, o.y); CT.lineTo(ox + B / 2, o.y + B - 3); CT.lineTo(ox + B - 2, o.y); }
      CT.closePath(); CT.fill(); CT.stroke();
    } else if (o.k === 'portal') {
      if (ox + 200 < 0 || ox > W + 50) continue;
      const info = PORTAL_INFO[o.kind];
      const cx2 = ox + o.w / 2, cy2 = (CEIL + FLOOR) / 2;
      CT.save();
      CT.globalAlpha = 0.25; CT.fillStyle = info.col;
      rrect(cx2 - 16, CEIL + 6, 32, FLOOR - CEIL - 12, 16); CT.fill();
      CT.globalAlpha = 1; CT.strokeStyle = info.col; CT.lineWidth = 4;
      const pulse = 1 + Math.sin(frame * 0.15) * 0.04;
      CT.beginPath(); CT.ellipse(cx2, cy2, 17 * pulse, 95 * pulse, 0, 0, Math.PI * 2); CT.stroke();
      CT.beginPath(); CT.ellipse(cx2, cy2, 9, 80, 0, 0, Math.PI * 2);
      CT.fillStyle = info.col; CT.globalAlpha = 0.5; CT.fill();
      CT.globalAlpha = 1;
      CT.fillStyle = '#ffffff'; CT.font = 'bold 13px Arial'; CT.textAlign = 'center';
      CT.fillText(info.label, cx2, cy2 + 130);
      CT.restore();
    } else if (o.k === 'pad') {
      if (ox + B < -50 || ox > W + 50) continue;
      CT.fillStyle = '#ffd84d';
      CT.beginPath(); CT.ellipse(ox + B / 2, FLOOR, 18, 9, 0, Math.PI, 0); CT.fill();
      CT.strokeStyle = '#fff'; CT.lineWidth = 2; CT.stroke();
    } else if (o.k === 'orb') {
      if (ox + B < -50 || ox > W + 50) continue;
      const r2 = 13 + Math.sin(frame * 0.2) * 2;
      CT.strokeStyle = '#ffd84d'; CT.lineWidth = 3;
      CT.beginPath(); CT.arc(o.x - camX, o.y, r2, 0, Math.PI * 2); CT.stroke();
      CT.fillStyle = 'rgba(255,216,77,0.6)';
      CT.beginPath(); CT.arc(o.x - camX, o.y, 7, 0, Math.PI * 2); CT.fill();
    }
  }
  /* finish line */
  const fx = LV.len - camX;
  if (fx > -60 && fx < W + 60) {
    for (let yy = CEIL; yy < FLOOR; yy += 20) {
      CT.fillStyle = ((yy / 20) % 2 === 0) ? '#ffffff' : '#222222';
      CT.fillRect(fx, yy, 12, 20);
    }
  }
}

const MAIN = '#37d2ff', ACCENT = '#aaff00';

function drawPlayer(camX) {
  const s = size();
  const x = p.x - camX, y = p.y;
  /* wave trail */
  if (trail.length > 1) {
    CT.strokeStyle = 'rgba(55,210,255,0.6)'; CT.lineWidth = s * 0.8; CT.lineJoin = 'round';
    CT.beginPath();
    CT.moveTo(trail[0].x - camX, trail[0].y);
    for (const t of trail) CT.lineTo(t.x - camX, t.y);
    CT.stroke();
  }
  CT.save();
  CT.translate(x, y);
  if (p.grav === -1) CT.scale(1, -1);
  CT.rotate(p.rot * (p.grav === -1 ? -1 : 1));
  const h = s / 2;
  switch (p.mode) {
    case 'cube': {
      CT.fillStyle = MAIN; rrect(-h, -h, s, s, 5); CT.fill();
      CT.strokeStyle = '#063a4d'; CT.lineWidth = 3; rrect(-h, -h, s, s, 5); CT.stroke();
      CT.fillStyle = ACCENT; rrect(-h * 0.55, -h * 0.55, s * 0.55, s * 0.55, 3); CT.fill();
      CT.fillStyle = '#063a4d';
      CT.fillRect(-h * 0.35, -h * 0.3, s * 0.13, s * 0.22);
      CT.fillRect(h * 0.1, -h * 0.3, s * 0.13, s * 0.22);
      break;
    }
    case 'ship': {
      CT.fillStyle = MAIN;
      CT.beginPath(); CT.moveTo(h * 1.3, 0); CT.lineTo(-h * 1.1, -h * 0.7); CT.lineTo(-h * 1.3, h * 0.6); CT.lineTo(h * 0.2, h * 0.7); CT.closePath(); CT.fill();
      CT.strokeStyle = '#063a4d'; CT.lineWidth = 2.5; CT.stroke();
      CT.fillStyle = ACCENT;
      CT.beginPath(); CT.arc(-h * 0.2, -h * 0.5, h * 0.55, Math.PI, 0); CT.fill();
      if (holding) { CT.fillStyle = '#ffb12e'; CT.beginPath(); CT.moveTo(-h * 1.3, h * 0.1); CT.lineTo(-h * 2.1, h * 0.3 * (1 + Math.random())); CT.lineTo(-h * 1.2, h * 0.55); CT.closePath(); CT.fill(); }
      break;
    }
    case 'ball': {
      CT.fillStyle = MAIN; CT.beginPath(); CT.arc(0, 0, h, 0, Math.PI * 2); CT.fill();
      CT.fillStyle = ACCENT; CT.beginPath(); CT.arc(0, 0, h, 0, Math.PI); CT.fill();
      CT.strokeStyle = '#063a4d'; CT.lineWidth = 3;
      CT.beginPath(); CT.arc(0, 0, h, 0, Math.PI * 2); CT.stroke();
      CT.beginPath(); CT.moveTo(-h, 0); CT.lineTo(h, 0); CT.stroke();
      CT.fillStyle = '#063a4d'; CT.beginPath(); CT.arc(0, 0, h * 0.3, 0, Math.PI * 2); CT.fill();
      break;
    }
    case 'ufo': {
      CT.fillStyle = MAIN;
      CT.beginPath(); CT.ellipse(0, h * 0.25, h * 1.35, h * 0.55, 0, 0, Math.PI * 2); CT.fill();
      CT.strokeStyle = '#063a4d'; CT.lineWidth = 2.5; CT.stroke();
      CT.fillStyle = ACCENT;
      CT.beginPath(); CT.arc(0, -h * 0.1, h * 0.7, Math.PI, 0); CT.fill();
      CT.strokeStyle = '#063a4d'; CT.stroke();
      break;
    }
    case 'wave': {
      CT.fillStyle = MAIN;
      CT.beginPath(); CT.moveTo(h * 1.5, 0); CT.lineTo(-h * 1.2, -h); CT.lineTo(-h * 0.4, 0); CT.lineTo(-h * 1.2, h); CT.closePath(); CT.fill();
      CT.strokeStyle = '#063a4d'; CT.lineWidth = 2; CT.stroke();
      break;
    }
    case 'spider': {
      CT.fillStyle = MAIN; rrect(-h * 0.8, -h * 0.55, s * 0.8, s * 0.6, 4); CT.fill();
      CT.strokeStyle = '#063a4d'; CT.lineWidth = 2; rrect(-h * 0.8, -h * 0.55, s * 0.8, s * 0.6, 4); CT.stroke();
      CT.strokeStyle = MAIN; CT.lineWidth = 3;
      for (const lx of [-0.7, -0.25, 0.3, 0.7]) {
        CT.beginPath(); CT.moveTo(lx * h, h * 0.05);
        CT.lineTo(lx * h * 1.5, h * 0.6); CT.lineTo(lx * h * 1.9, h); CT.stroke();
      }
      CT.fillStyle = ACCENT;
      CT.fillRect(-h * 0.55, -h * 0.4, h * 0.3, h * 0.3);
      CT.fillRect(-h * 0.05, -h * 0.4, h * 0.3, h * 0.3);
      break;
    }
  }
  CT.restore();
}

function drawParticles() {
  for (const pt of particles) {
    CT.globalAlpha = Math.max(0, Math.min(1, pt.life / 30));
    CT.fillStyle = pt.col;
    CT.fillRect(pt.x - camXNow - pt.sz / 2, pt.y - pt.sz / 2, pt.sz, pt.sz);
  }
  CT.globalAlpha = 1;
}

let camXNow = 0;

function drawHUD() {
  const pct = Math.max(0, Math.min(100, p.x / LV.len * 100));
  // progress bar
  CT.fillStyle = 'rgba(0,0,0,0.45)';
  rrect(W / 2 - 160, 10, 320, 14, 7); CT.fill();
  CT.fillStyle = LV.col;
  if (pct > 1) { rrect(W / 2 - 158, 12, 316 * pct / 100, 10, 5); CT.fill(); }
  CT.fillStyle = '#fff'; CT.font = 'bold 13px Arial'; CT.textAlign = 'center';
  CT.fillText(Math.floor(pct) + '%', W / 2, 38);
  CT.textAlign = 'left'; CT.font = 'bold 16px Arial';
  CT.fillText('Attempt ' + attempts, 14, 28);
  CT.font = '12px Arial'; CT.fillStyle = 'rgba(255,255,255,0.7)';
  CT.fillText(LV.name + '  —  R restart · Esc menu', 14, 48);
}

/* ---------------- menu ---------------- */
const cards = [
  { x: 120, y: 170, w: 320, h: 270 },
  { x: 520, y: 170, w: 320, h: 270 },
];

function drawMenu() {
  const g = CT.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#101035'); g.addColorStop(1, '#27104a');
  CT.fillStyle = g; CT.fillRect(0, 0, W, H);
  CT.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 9; i++) {
    const bx = ((i * 199 + frame * 0.4) % (W + 140)) - 70;
    CT.fillRect(bx, (i * 131) % H, 60, 60);
  }
  CT.textAlign = 'center';
  CT.fillStyle = '#fff';
  CT.font = 'bold 58px Arial';
  CT.shadowColor = '#37d2ff'; CT.shadowBlur = 24;
  CT.fillText('GEOMETRIC DASH', W / 2, 95);
  CT.shadowBlur = 0;
  CT.font = '16px Arial'; CT.fillStyle = 'rgba(255,255,255,0.75)';
  CT.fillText('cube · ship · ball · ufo · wave · spider — pick a level', W / 2, 128);

  LEVELS.forEach((lv, i) => {
    const c = cards[i];
    const hov = mouse.x > c.x && mouse.x < c.x + c.w && mouse.y > c.y && mouse.y < c.y + c.h;
    CT.fillStyle = hov ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.08)';
    rrect(c.x, c.y, c.w, c.h, 16); CT.fill();
    CT.strokeStyle = lv.col; CT.lineWidth = hov ? 4 : 2;
    rrect(c.x, c.y, c.w, c.h, 16); CT.stroke();
    CT.fillStyle = lv.col; CT.font = 'bold 30px Arial';
    CT.fillText(lv.name, c.x + c.w / 2, c.y + 58);
    CT.fillStyle = '#fff'; CT.font = 'bold 18px Arial';
    CT.fillText(lv.diff, c.x + c.w / 2, c.y + 92);
    // difficulty face
    CT.beginPath(); CT.arc(c.x + c.w / 2, c.y + 150, 32, 0, Math.PI * 2);
    CT.fillStyle = lv.col; CT.fill();
    CT.fillStyle = '#101522';
    CT.fillRect(c.x + c.w / 2 - 14, c.y + 140, 8, 10);
    CT.fillRect(c.x + c.w / 2 + 6, c.y + 140, 8, 10);
    CT.strokeStyle = '#101522'; CT.lineWidth = 3;
    CT.beginPath();
    if (i === 0) CT.arc(c.x + c.w / 2, c.y + 158, 12, 0.2, Math.PI - 0.2);          // smile
    else CT.arc(c.x + c.w / 2, c.y + 175, 12, Math.PI + 0.3, Math.PI * 2 - 0.3);    // frown
    CT.stroke();
    CT.fillStyle = '#ffd84d'; CT.font = 'bold 17px Arial';
    CT.fillText('★ ' + lv.stars, c.x + c.w / 2, c.y + 210);
    // best bar
    const bp = best(i);
    CT.fillStyle = 'rgba(0,0,0,0.4)';
    rrect(c.x + 40, c.y + 228, c.w - 80, 12, 6); CT.fill();
    if (bp > 0) { CT.fillStyle = lv.col; rrect(c.x + 42, c.y + 230, (c.w - 84) * bp / 100, 8, 4); CT.fill(); }
    CT.fillStyle = 'rgba(255,255,255,0.8)'; CT.font = '13px Arial';
    CT.fillText('Best: ' + bp + '%', c.x + c.w / 2, c.y + 258);
  });

  CT.fillStyle = 'rgba(255,255,255,0.55)'; CT.font = '14px Arial';
  CT.fillText('click / tap / space to jump — hold for ship & wave', W / 2, 498);
  CT.textAlign = 'left';
}

function drawWin() {
  CT.fillStyle = 'rgba(0,0,0,0.55)'; CT.fillRect(0, 0, W, H);
  CT.textAlign = 'center';
  CT.fillStyle = '#ffd84d'; CT.font = 'bold 52px Arial';
  CT.shadowColor = '#ffd84d'; CT.shadowBlur = 26;
  CT.fillText('LEVEL COMPLETE!', W / 2, 220);
  CT.shadowBlur = 0;
  CT.fillStyle = '#fff'; CT.font = 'bold 24px Arial';
  CT.fillText(LV.name, W / 2, 268);
  CT.font = '19px Arial';
  CT.fillText('Attempts: ' + attempts, W / 2, 308);
  if (winT > 40) {
    CT.fillStyle = 'rgba(255,255,255,' + (0.6 + 0.4 * Math.sin(frame * 0.1)) + ')';
    CT.font = 'bold 17px Arial';
    CT.fillText('click to return to menu', W / 2, 360);
  }
  CT.textAlign = 'left';
}

/* ---------------- main loop ---------------- */
function tick() {
  if (state === 'play') update();

  if (state === 'dead') {
    deadT--;
    if (deadT <= 0) { attempts++; resetPlayer(); state = 'play'; }
  }
  if (state === 'win') winT++;

  for (const pt of particles) { pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.18; pt.life--; }
  particles = particles.filter(pt => pt.life > 0);

  /* render */
  if (state === 'menu') {
    frame++;
    drawMenu();
  } else {
    camXNow = p.x - 300;
    CT.save();
    if (shakeT > 0) { shakeT--; CT.translate((Math.random() - .5) * 8, (Math.random() - .5) * 8); }
    drawBG(camXNow);
    drawObjects(camXNow);
    if (state !== 'dead') drawPlayer(camXNow);
    drawParticles();
    CT.restore();
    drawHUD();
    if (state === 'win') drawWin();
  }
  requestAnimationFrame(tick);
}

/* ---------------- input ---------------- */
const mouse = { x: 0, y: 0 };

function canvasPos(e) {
  const r = CV.getBoundingClientRect();
  const cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
  const cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
  return { x: cx * W / r.width, y: cy * H / r.height };
}

function press(pos) {
  if (state === 'menu') {
    if (pos) cards.forEach((c, i) => {
      if (pos.x > c.x && pos.x < c.x + c.w && pos.y > c.y && pos.y < c.y + c.h) startLevel(i);
    });
    return;
  }
  if (state === 'win') { if (winT > 40) state = 'menu'; return; }
  holding = true; tapT = 5;
}
function release() { holding = false; }

CV.addEventListener('mousedown', e => { press(canvasPos(e)); });
CV.addEventListener('mouseup', release);
CV.addEventListener('mousemove', e => { const q = canvasPos(e); mouse.x = q.x; mouse.y = q.y; });
CV.addEventListener('touchstart', e => { e.preventDefault(); const q = canvasPos(e); mouse.x = q.x; mouse.y = q.y; press(q); }, { passive: false });
CV.addEventListener('touchend', e => { e.preventDefault(); release(); }, { passive: false });
window.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); if (!e.repeat) press(null); }
  if (e.code === 'KeyR' && (state === 'play' || state === 'dead')) { attempts++; resetPlayer(); state = 'play'; }
  if (e.code === 'Escape' && state !== 'menu') { state = 'menu'; holding = false; }
});
window.addEventListener('keyup', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp') release();
});

resetPlayer();
tick();
