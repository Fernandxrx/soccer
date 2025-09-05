// Soccer Pro — game.js
// Autor: Você :) — Sem bibliotecas externas. Canvas 2D puro.
// Recursos: físicas simples, IA, goleiros, partículas, sombras, HUD, toque, pausa, opções.
// Publicável no GitHub Pages.


// ===== Utilities =====
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const now = () => performance.now() / 1000;
const key = {};
addEventListener('keydown', e => { key[e.key.toLowerCase()] = true; if([' ','escape'].includes(e.key.toLowerCase())) e.preventDefault(); });
addEventListener('keyup', e => { key[e.key.toLowerCase()] = false; });

// Mobile detection
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// Sound (procedural via WebAudio)
class Sound {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.muted = false;
  }
  beep(type='sine', dur=0.12, freq=440, vol=0.05){
    if (this.muted) return;
    const t0 = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.ctx.destination); o.start(t0); o.stop(t0 + dur);
  }
  kick(){ this.beep('triangle', .08, 190, 0.08); }
  pass(){ this.beep('sine', .06, 520, 0.05); }
  whistle(){ this.beep('square', .3, 1400, .06); setTimeout(()=>this.beep('square', .3, 1200, .06), 320); }
  crowd(){ this.beep('sawtooth', .25, 220, .02); }
}
const SFX = new Sound();

// ===== Colors / Themes =====
const TEAMS = {
  blue:   { name:'AZUL',    primary:'#47a3ff', dark:'#1e52a6' },
  green:  { name:'VERDE',   primary:'#52ff9d', dark:'#1a7a4a' },
  purple: { name:'ROXO',    primary:'#b18cff', dark:'#50349a' },
  orange: { name:'LARANJA', primary:'#ffb457', dark:'#ad5a14' },
  red:    { name:'VERMELHO',primary:'#ff6b6b', dark:'#9a1f1f' },
  yellow: { name:'AMARELO', primary:'#ffe066', dark:'#a88b00' },
  teal:   { name:'CIANO',   primary:'#5ee3ff', dark:'#0b6f87' },
  pink:   { name:'ROSA',    primary:'#ff9bd2', dark:'#a33f7b' },
};

// ===== Game State =====
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const W = 1280, H = 720;
const PITCH = {x:60, y:60, w: W-120, h: H-140};

let settings = { vsync:true, particles:true, shadows:true };
let game = null;

// UI elements
const $$ = sel => document.querySelector(sel);
const $btnStart = $('#btnStart'); function $(id){ return document.getElementById(id.slice(1)); } // helper just for above line quirk
// We’ll bind all buttons by id:
const btnPause = document.getElementById('btnPause');
const btnReset = document.getElementById('btnReset');
const btnSettings = document.getElementById('btnSettings');
const btnHelp = document.getElementById('btnHelp');
const btnResume = document.getElementById('btnResume');
const btnQuit = document.getElementById('btnQuit');
const btnCloseHelp = document.getElementById('btnCloseHelp');
const btnCloseSettings = document.getElementById('btnCloseSettings');
const btnApplySettings = document.getElementById('btnApplySettings');
const overlayStart = document.getElementById('overlayStart');
const overlayPause = document.getElementById('overlayPause');
const overlayGoal = document.getElementById('overlayGoal');
const overlayHelp = document.getElementById('overlayHelp');
const overlaySettings = document.getElementById('overlaySettings');
const goalText = document.getElementById('goalText');
const homeName = document.getElementById('homeName');
const awayName = document.getElementById('awayName');
const homeScoreEl = document.getElementById('homeScore');
const awayScoreEl = document.getElementById('awayScore');
const matchClockEl = document.getElementById('matchClock');
const selHome = document.getElementById('selHome');
const selAway = document.getElementById('selAway');
const selDifficulty = document.getElementById('selDifficulty');
const selDuration = document.getElementById('selDuration');
const linkHowTo = document.getElementById('linkHowTo');
const dlgPublish = document.getElementById('dlgPublish');
const btnCloseDlg = document.getElementById('btnCloseDlg');

// Touch controls
const touchWrap = document.querySelector('.touch-controls');
const joy = document.getElementById('joy');
const joyStick = joy.querySelector('.stick');
const btnKick = document.getElementById('btnKick');
const btnSwitch = document.getElementById('btnSwitch');
const btnSprint = document.getElementById('btnSprint');

linkHowTo.addEventListener('click', (e)=>{ e.preventDefault(); dlgPublish.showModal(); });
btnCloseDlg.addEventListener('click', ()=> dlgPublish.close());

// Button bindings
document.getElementById('btnStart').addEventListener('click', ()=> {
  startMatch();
  overlayStart.classList.remove('visible');
});

btnHelp.addEventListener('click', ()=> overlayHelp.classList.add('visible'));
btnCloseHelp.addEventListener('click', ()=> overlayHelp.classList.remove('visible'));
btnSettings.addEventListener('click', ()=> overlaySettings.classList.add('visible'));
btnCloseSettings.addEventListener('click', ()=> overlaySettings.classList.remove('visible'));
btnApplySettings.addEventListener('click', ()=> {
  settings.vsync = document.getElementById('chkVsync').checked;
  settings.particles = document.getElementById('chkParticles').checked;
  settings.shadows = document.getElementById('chkShadows').checked;
  overlaySettings.classList.remove('visible');
});

btnPause.addEventListener('click', ()=> pauseGame(true));
btnReset.addEventListener('click', ()=> resetMatch());
btnResume.addEventListener('click', ()=> pauseGame(false));
btnQuit.addEventListener('click', ()=> endMatch());

// Keyboard
addEventListener('keydown', e => {
  if (e.key === 'Escape') pauseGame(!game?.paused);
  if (e.key.toLowerCase() === 'q') requestSwitch = true;
  if (e.key === ' ') requestKick = true;
});

// Touch setup
if (isTouch) {
  touchWrap.style.display = 'flex';
  const rect = ()=> joy.getBoundingClientRect();
  let dragging = false;
  let origin = {x:0, y:0};
  let vec = {x:0, y:0};
  const setStick = (dx, dy)=>{
    const r = 50;
    const mag = Math.hypot(dx, dy);
    const m = Math.min(mag, r);
    const nx = dx / (mag || 1), ny = dy/(mag || 1);
    joyStick.style.transform = `translate(${nx*m}px, ${ny*m}px)`;
    vec.x = nx * (m/r); vec.y = ny * (m/r);
  };
  joy.addEventListener('pointerdown', (e)=>{
    dragging = true; const r = rect(); origin.x = e.clientX - (r.left + r.width/2); origin.y = e.clientY - (r.top + r.height/2);
    setStick(0,0);
  });
  addEventListener('pointermove', (e)=>{
    if (!dragging) return;
    const r = rect(); const dx = e.clientX - (r.left + r.width/2); const dy = e.clientY - (r.top + r.height/2);
    setStick(dx, dy);
  });
  addEventListener('pointerup', ()=>{ dragging = false; setStick(0,0); });
  // Map to input
  setInterval(()=>{
    input.moveX = vec.x;
    input.moveY = vec.y;
  }, 16);

  btnKick.addEventListener('click', ()=> requestKick = true);
  btnSwitch.addEventListener('click', ()=> requestSwitch = true);
  btnSprint.addEventListener('pointerdown', ()=> input.sprint = true);
  btnSprint.addEventListener('pointerup', ()=> input.sprint = false);
}


// ===== Core Entities =====
const input = { moveX:0, moveY:0, sprint:false };
let requestKick = false, requestSwitch = false;

class Ball {
  constructor(){
    this.x = W/2; this.y = H/2; this.vx = 0; this.vy = 0; this.r = 10;
    this.spin = 0; // for effect
  }
  reset(center=true){
    this.x = W/2; this.y = H/2; this.vx = 0; this.vy = 0; this.spin = 0;
  }
  update(dt){
    // friction
    const f = 0.995;
    this.vx *= f; this.vy *= f;
    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;
    // bounds (pitch edges)
    const lx = PITCH.x + this.r, rx = PITCH.x + PITCH.w - this.r;
    const ty = PITCH.y + this.r, by = PITCH.y + PITCH.h - this.r;
    if (this.x < lx) { this.x = lx; this.vx *= -0.7; }
    if (this.x > rx) { this.x = rx; this.vx *= -0.7; }
    if (this.y < ty) { this.y = ty; this.vy *= -0.7; }
    if (this.y > by) { this.y = by; this.vy *= -0.7; }
  }
  draw(){
    ctx.save();
    // shadow
    if (settings.shadows){
      ctx.shadowColor = 'rgba(0,0,0,.5)';
      ctx.shadowBlur = 15; ctx.shadowOffsetY = 4;
    }
    // ball
    const g = ctx.createRadialGradient(this.x-4, this.y-4, 2, this.x, this.y, 14);
    g.addColorStop(0, '#fff');
    g.addColorStop(1, '#bbb');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI*2); ctx.fill();

    // pentagon pattern (simple)
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.spin);
    ctx.fillStyle = '#111';
    for (let i=0;i<5;i++){
      ctx.beginPath();
      ctx.moveTo(0,-6);
      ctx.lineTo(5,-2); ctx.lineTo(3,5); ctx.lineTo(-3,5); ctx.lineTo(-5,-2);
      ctx.closePath(); ctx.fill();
      ctx.rotate(Math.PI*2/5);
    }
    ctx.restore();
    ctx.restore();
  }
}

class Player {
  constructor(team, x, y, isHuman=false, role='field'){
    this.team = team;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.speed = 2.2;
    this.maxSpeed = 3.4;
    this.stamina = 1; // 0..1
    this.isHuman = isHuman;
    this.role = role; // 'gk' | 'field'
    this.heading = 0;
    this.cooldown = 0;
    this.indicatorPulse = 0;
  }
  update(dt){
    const accel = 0.5;
    let mx=0, my=0, sprint=false;
    if (this.isHuman){
      // keyboard
      mx = (key['arrowright']||key['d']?1:0) - (key['arrowleft']||key['a']?1:0);
      my = (key['arrowdown']||key['s']?1:0) - (key['arrowup']||key['w']?1:0);
      if (isTouch){ mx = input.moveX; my = input.moveY; }
      sprint = !!(key['shift'] || input.sprint);
    } else {
      // simple AI
      const target = aiTarget(this);
      mx = target.x - this.x; my = target.y - this.y;
      const m = Math.hypot(mx,my) || 1; mx/=m; my/=m;
      // hold position a bit for defense
      if (this.role==='gk'){
        // GK patrol on small box
        const box = this.team.side==='left' ? {x:PITCH.x+60, y: H/2} : {x:PITCH.x+PITCH.w-60, y:H/2};
        if (dist(ball,this)>70){
          mx = box.x - this.x; my = box.y - this.y; const m2 = Math.hypot(mx,my)||1; mx/=m2; my/=m2;
        }
      }
      sprint = Math.random()<0.4 && this.stamina>0.3;
    }

    const spd = lerp(this.speed, this.maxSpeed, sprint? this.stamina : 0);
    this.vx = lerp(this.vx, mx*spd, accel*dt*60);
    this.vy = lerp(this.vy, my*spd, accel*dt*60);
    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;
    this.x = clamp(this.x, PITCH.x+20, PITCH.x+PITCH.w-20);
    this.y = clamp(this.y, PITCH.y+20, PITCH.y+PITCH.h-20);
    if (this.vx||this.vy) this.heading = Math.atan2(this.vy, this.vx);

    // stamina
    const drain = sprint? 0.25 : 0.08;
    this.stamina = clamp(this.stamina + (sprint? -drain : 0.12) * dt, 0, 1);

    // cooldown
    if (this.cooldown>0) this.cooldown-=dt;
    this.indicatorPulse += dt;
  }
  draw(){
    ctx.save();
    // shadow
    if (settings.shadows){
      ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
    }
    // body
    const color = this.team.color.primary;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.heading);
    // glow
    if (settings.shadows){
      const glow = ctx.createRadialGradient(0,0,5, 0,0,22);
      glow.addColorStop(0, color);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0,0,22,0,Math.PI*2); ctx.fill();
    }
    // jersey
    ctx.fillStyle = color; ctx.strokeStyle = this.team.color.dark; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(-14,-12,28,24,6); ctx.fill(); ctx.stroke();
    // head
    ctx.fillStyle = '#f8ddb5'; ctx.beginPath(); ctx.arc(10,-14,7,0,Math.PI*2); ctx.fill();
    // legs
    ctx.fillStyle = '#111'; ctx.fillRect(-12,10,9,6); ctx.fillRect(3,10,9,6);
    // indicator for human
    if (this.isHuman && Math.sin(this.indicatorPulse*6) > 0.2){
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0,-26,6,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }
}

function dist(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }

class Team {
  constructor(side, color, name){
    this.side = side; // 'left' or 'right'
    this.color = color;
    this.name = name;
    this.players = [];
    this.score = 0;
  }
  spawn(human=false){
    this.players.length = 0;
    const baseX = this.side==='left'? PITCH.x+150 : PITCH.x+PITCH.w-150;
    const dir = this.side==='left'? 1 : -1;
    // 4 field + 1 GK
    const positions = [
      {x:baseX,       y:H/2-120},
      {x:baseX,       y:H/2+120},
      {x:baseX+120*dir, y:H/2-30},
      {x:baseX+120*dir, y:H/2+30},
    ];
    positions.forEach((p,i)=>{
      this.players.push(new Player(this, p.x, p.y, human && i===2, 'field'));
    });
    // GK
    const gx = this.side==='left'? PITCH.x+70 : PITCH.x+PITCH.w-70;
    const gk = new Player(this, gx, H/2, false, 'gk');
    gk.maxSpeed = 3.0; gk.speed = 2.2;
    this.players.push(gk);
  }
  nearestTo(obj){
    return this.players.reduce((best,p)=> dist(p,obj) < dist(best,obj) ? p : best, this.players[0]);
  }
}

// Global instances
let home, away, ball;

// Match
let match = { running:false, paused:false, time:0, duration: 4*60, lastGoalTime:-10 };

function startMatch(){
  const hc = TEAMS[selHome.value]; const ac = TEAMS[selAway.value];
  home = new Team('left', hc, hc.name); away = new Team('right', ac, ac.name);
  home.spawn(true); away.spawn(false);
  ball = new Ball();
  game = { human: home.players.find(p=>p.isHuman) };
  updateHUD();
  match.time = 0; match.running = true; match.paused = false;
  match.duration = parseInt(selDuration.value,10) * 60;
  switch (selDifficulty.value){
    case 'easy': AI.skill = 0.5; break;
    case 'normal': AI.skill = 0.85; break;
    case 'hard': AI.skill = 1.15; break;
  }
  SFX.whistle();
}

function resetMatch(){
  if (!match.running) return;
  home.score = 0; away.score = 0;
  home.spawn(true); away.spawn(false);
  ball.reset();
  match.time = 0;
  updateHUD();
}

function endMatch(){
  match.running = false;
  overlayStart.classList.add('visible');
  overlayPause.classList.remove('visible');
}

function pauseGame(v){
  if (!match.running) return;
  match.paused = v;
  overlayPause.classList.toggle('visible', v);
}

// ===== AI =====
const AI = { skill: 0.85 };

function aiTarget(player){
  // Aim for ball; defenders bias to own half; attackers push forward.
  const t = {x: ball.x, y: ball.y};
  const sideMul = player.team.side==='left' ? 1 : -1;
  const half = PITCH.x + PITCH.w/2;
  const biasX = player.role==='gk' ? (player.team.side==='left'? PITCH.x+80 : PITCH.x+PITCH.w-80) :
               (player.team.side==='left'? lerp(half-100, half+40, AI.skill) : lerp(half+100, half-40, AI.skill));
  t.x = lerp(ball.x, biasX, 0.3);
  // Keep in vertical bounds slightly centered
  t.y = clamp(ball.y + rand(-50,50)*(1-AI.skill), PITCH.y+40, PITCH.y+PITCH.h-40);
  return t;
}

// ===== Rendering Pitch =====
function drawPitch(){
  // Grass
  const g = ctx.createLinearGradient(0,PITCH.y,0,PITCH.y+PITCH.h);
  g.addColorStop(0,'#136e2c'); g.addColorStop(1,'#0a3d1c');
  ctx.fillStyle = g; ctx.fillRect(PITCH.x, PITCH.y, PITCH.w, PITCH.h);

  // stripes
  ctx.globalAlpha = 0.12;
  for (let i=0;i<10;i++){
    ctx.fillStyle = i%2? '#000' : '#fff';
    ctx.fillRect(PITCH.x, PITCH.y + i*(PITCH.h/10), PITCH.w, PITCH.h/10);
  }
  ctx.globalAlpha = 1;

  // boundary
  ctx.strokeStyle = '#e8f1ff'; ctx.lineWidth = 3;
  ctx.strokeRect(PITCH.x, PITCH.y, PITCH.w, PITCH.h);

  // center circle + line
  ctx.beginPath(); ctx.arc(W/2, H/2, 70, 0, Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W/2, PITCH.y); ctx.lineTo(W/2, PITCH.y+PITCH.h); ctx.stroke();

  // penalty boxes and goals
  drawBox('left'); drawBox('right');

  // crowd/background
  drawCrowd();
}

function drawBox(side){
  const px = side==='left'? PITCH.x : PITCH.x+PITCH.w;
  ctx.strokeStyle = '#e8f1ff'; ctx.lineWidth = 3;
  // big box
  const big = {w: 150, h: 300};
  const small = {w: 70, h: 160};
  if (side==='left'){
    ctx.strokeRect(PITCH.x, H/2-big.h/2, big.w, big.h);
    ctx.strokeRect(PITCH.x, H/2-small.h/2, small.w, small.h);
  } else {
    ctx.strokeRect(PITCH.x+PITCH.w-big.w, H/2-big.h/2, big.w, big.h);
    ctx.strokeRect(PITCH.x+PITCH.w-small.w, H/2-small.h/2, small.w, small.h);
  }
  // goal (net)
  const gx = side==='left'? PITCH.x-16 : PITCH.x+PITCH.w+16;
  ctx.save();
  ctx.translate(gx, H/2);
  ctx.strokeStyle = 'rgba(255,255,255,.8)';
  ctx.lineWidth = 2;
  // net animation (simple sway)
  const sway = Math.sin(perf*2 + (side==='left'?0:Math.PI))*4;
  for (let i=0;i<=6;i++){
    ctx.beginPath(); ctx.moveTo(0, -70+i*23); ctx.lineTo(side==='left'? 16+sway : -16+sway, -70+i*23); ctx.stroke();
  }
  for (let i=0;i<=4;i++){
    ctx.beginPath(); ctx.moveTo(0, -70); ctx.lineTo(side==='left'? 16+sway : -16+sway, -70+ i*35); ctx.stroke();
  }
  // posts
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0,-70); ctx.lineTo(0,70); ctx.stroke();
  ctx.restore();
}

function drawCrowd(){
  ctx.save();
  // upper stands
  const y = PITCH.y - 30;
  ctx.fillStyle = '#0d1328';
  ctx.fillRect(PITCH.x-40, y-50, PITCH.w+80, 60);
  // dots as crowd
  ctx.globalAlpha = 0.3;
  for (let i=0;i<600;i++){
    const cx = PITCH.x-40 + (i*17 % (PITCH.w+80));
    const cy = y-50 + Math.floor(i/30)*6 + (i%2?2:0);
    ctx.fillRect(cx, cy, 2, 2);
  }
  ctx.globalAlpha = 1;
  // banners (animated)
  ctx.fillStyle = '#ffb457'; ctx.fillRect(PITCH.x+200, y-44 + Math.sin(perf*2)*2, 120, 10);
  ctx.fillStyle = '#5ee3ff'; ctx.fillRect(PITCH.x+PITCH.w-320, y-44 + Math.cos(perf*2)*2, 120, 10);
  ctx.restore();
}

// ===== Particles =====
const particles = [];
function spawnParticle(x,y, vx,vy, life=0.5, size=2){
  if (!settings.particles) return;
  particles.push({x,y,vx,vy,life,size});
}
function updateParticles(dt){
  for (let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    p.life -= dt; if (p.life<=0){ particles.splice(i,1); continue; }
    p.x += p.vx*dt*60; p.y += p.vy*dt*60;
  }
}
function drawParticles(){
  ctx.save();
  ctx.fillStyle = '#fff';
  particles.forEach(p=>{ ctx.globalAlpha = clamp(p.life,0,1); ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill(); });
  ctx.globalAlpha = 1; ctx.restore();
}

// ===== Input Helpers =====
function handleHumanActions(human){
  if (requestKick){
    doKickOrPass(human);
    requestKick=false;
  }
  if (requestSwitch){
    // switch to nearest to ball
    const candidates = home.players.filter(p=>p.role!=='gk');
    const nearest = candidates.reduce((best,p)=> dist(p,ball) < dist(best,ball)? p:best, candidates[0]);
    home.players.forEach(p=>p.isHuman=false);
    nearest.isHuman = true;
    game.human = nearest;
    requestSwitch=false;
  }
}

function doKickOrPass(player){
  const d = dist(player, ball);
  if (d < 28){
    // direction
    const dir = Math.atan2(ball.y - player.y, ball.x - player.x);
    const kickDir = player.isHuman ? player.heading : dir;
    // power depends on stamina
    const power = 9 + 7*player.stamina;
    ball.vx = Math.cos(kickDir) * power;
    ball.vy = Math.sin(kickDir) * power;
    ball.spin += (Math.random()-.5)*0.6;
    // particles
    for (let i=0;i<14;i++) spawnParticle(ball.x,ball.y, rand(-1,1), rand(-1,1), rand(.2,.6), rand(1,2));
    SFX.kick();
  } else if (d < 56){
    // pass gently towards ball direction
    ball.vx += Math.cos(player.heading)*4;
    ball.vy += Math.sin(player.heading)*4;
    SFX.pass();
  }
}

// ===== Collisions =====
function handleCollisions(){
  const allPlayers = [...home.players, ...away.players];
  // player-ball
  for (const p of allPlayers){
    const d = dist(p, ball);
    const minDist = 20;
    if (d < minDist){
      const nx = (ball.x - p.x) / (d || 1);
      const ny = (ball.y - p.y) / (d || 1);
      const push = (minDist - d) * 0.6;
      ball.x += nx * push; ball.y += ny * push;
      // slight control
      ball.vx += nx * 0.6; ball.vy += ny * 0.6;
    }
  }

  // goals
  const goalW = 10, goalH = 140;
  const leftGoal = {x:PITCH.x-6, y:H/2 - goalH/2, w:6, h:goalH};
  const rightGoal = {x:PITCH.x+PITCH.w, y:H/2 - goalH/2, w:6, h:goalH};

  // check crossing
  if (ball.x - ball.r < leftGoal.x + leftGoal.w && ball.y > leftGoal.y && ball.y < leftGoal.y+leftGoal.h){
    // AWAY scores
    score(away);
  }
  if (ball.x + ball.r > rightGoal.x && ball.y > rightGoal.y && ball.y < rightGoal.y+rightGoal.h){
    // HOME scores
    score(home);
  }
}

function score(team){
  const t = now();
  if (t - match.lastGoalTime < 1.5) return; // avoid double
  match.lastGoalTime = t;
  team.score++;
  updateHUD();
  // Goal overlay
  overlayGoal.classList.add('visible');
  goalText.textContent = `Time ${team.name} marcou!`;
  setTimeout(()=> overlayGoal.classList.remove('visible'), 1400);
  // confetti
  for (let i=0;i<120;i++){
    const a = rand(0, Math.PI*2), s = rand(2,6);
    spawnParticle(W/2 + Math.cos(a)*20, 120 + Math.sin(a)*10, Math.cos(a)*s, Math.sin(a)*s, rand(.6,1.2), rand(2,3));
  }
  SFX.crowd();
  SFX.whistle();
  // reset positions
  home.spawn(true); away.spawn(false); ball.reset();
}

// ===== HUD =====
function updateHUD(){
  homeName.textContent = home.name; awayName.textContent = away.name;
  homeScoreEl.textContent = home.score; awayScoreEl.textContent = away.score;
}

// ===== Loop =====
let prev = now(), perf = 0;
function loop(){
  const t = now(); let dt = t - prev; prev = t; perf = t;
  if (settings.vsync) dt = Math.min(dt, 1/60);
  if (match.running && !match.paused){
    // input mapping
    const human = game.human;
    input.sprint = key['shift'] || input.sprint;
    handleHumanActions(human);

    // update entities
    const all = [...home.players, ...away.players];
    all.forEach(p=>p.update(dt));
    ball.update(dt);
    handleCollisions();

    // time
    match.time += dt;
    const remain = Math.max(0, match.duration - match.time);
    const m = Math.floor(remain/60).toString().padStart(2,'0');
    const s = Math.floor(remain%60).toString().padStart(2,'0');
    matchClockEl.textContent = `${m}:${s}`;
    if (remain<=0){
      match.running = false;
      setTimeout(()=>{
        overlayStart.classList.add('visible');
        alert(`Fim de jogo! ${home.name} ${home.score} · ${away.score} ${away.name}`);
      }, 100);
    }
  }

  // render
  ctx.clearRect(0,0,W,H);
  drawPitch();
  updateParticles(dt);
  drawParticles();
  // draw players
  [...home.players, ...away.players].forEach(p=>p.draw());
  // draw ball above
  ball.draw();

  requestAnimationFrame(loop);
}

// ===== Boot =====
function boot(){
  canvas.width = W; canvas.height = H;
  if (isTouch) { document.querySelector('.hint').textContent = 'No mobile: use joystick e botões'; }
  requestAnimationFrame(loop);
}
boot();

// simple helper for querySelector by id
function $q(id){ return document.querySelector(id); }
