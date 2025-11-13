/* game.js — Super Platformer full-screen, desde cero.
   - Personaliza imagen del jugador y enemigos con URLs (overlay inicial).
   - Nivel largo, enemigos que patrullan, monedas, flag final, reinicio.
   - Las URLs se guardan en localStorage automáticamente.
*/

/* ---------------------------
   FALLBACK SVGs (base64) — usados si no pones URL o falla la carga
   --------------------------- */
const FALLBACK = {
  player: 'https://postimg.cc/DW1C6WqV',
  goomba: 'https://i.postimg.cc/pXGsg8dJ/descarga-8.png',
  koopa: 'https://i.postimg.cc/G3QRTMMH/descarga-10.png',
  block: 'https://media.istockphoto.com/id/1358409221/es/vector/fondo-de-juego-de-p%C3%ADxeles-hierba-de-bloque-patr%C3%B3n-de-suelo.jpg?s=612x612&w=0&k=20&c=z_jr9EICzSQcAv8acnzx3ADx2nPdoHN2qLWokGGeJz4=',
  coin: 'https://i.postimg.cc/4d8TqyHQ/descarga-11.png',
  bg: 'data:image/svg+xml;base64,' + btoa(`<svg xmlns='http://www.w3.org/2000/svg' width='800' height='200'><rect width='800' height='200' fill='#9be0ff'/></svg>`)
};

/* ---------------------------
   Canvas and sizing (full screen)
   --------------------------- */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
function resizeCanvas(){
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

/* ---------------------------
   UI nodes
   --------------------------- */
const overlay = document.getElementById('overlay');
const inpPlayer = document.getElementById('inpPlayer');
const inpGoomba = document.getElementById('inpGoomba');
const inpKoopa = document.getElementById('inpKoopa');
const inpBlock = document.getElementById('inpBlock');
const inpCoin = document.getElementById('inpCoin');
const inpBg = document.getElementById('inpBg');
const btnLoad = document.getElementById('btnLoad');
const btnDefaults = document.getElementById('btnDefaults');
const btnRestart = document.getElementById('btnRestart');
const btnImage = document.getElementById('btnImage');
const hudCoins = document.getElementById('hudCoins');
const hudScore = document.getElementById('hudScore');
const minimap = document.getElementById('minimap');

/* ---------------------------
   Asset loading helper
   --------------------------- */
async function loadImage(url){
  return new Promise(res=>{
    if(!url){ res(null); return; }
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = ()=> res(i);
    i.onerror = ()=> res(null);
    i.src = url;
  });
}

/* ---------------------------
   ASSETS object (Image instances)
   --------------------------- */
let ASSETS = { player: null, goomba: null, koopa: null, block: null, coin: null, bg: null };

/* ---------------------------
   Game world params
   --------------------------- */
const TILE = 48;
const ROWS = 10;
let COLS = 600;               // very long by default
let WORLD_W = COLS * TILE;
const WORLD_H = ROWS * TILE;

/* ---------------------------
   Entities & state
   --------------------------- */
let tiles = [];   // array of {r,c}
let coins = [];   // {x,y,r,collected}
let enemies = []; // {x,y,w,h,vx,type,alive}
let particles = [];

let player = { 
  x: 120, y: 0, w: 40, h: 56, vx: 0, vy: 0, onGround: false, dir: 1, frame: 0, frameTimer: 0,
  jumpCount: 0  // cuenta de saltos en el aire
};

const MAX_JUMPS = 2; // máximo 2 saltos (doble salto)

let cameraX = 0;
let score = 0, coinCount = 0;

/* ---------------------------
   Input handling
   --------------------------- */
const KEYS = {};
window.addEventListener('keydown', e => { KEYS[e.key.toLowerCase()] = true; if(['arrowup',' '].includes(e.key.toLowerCase())) e.preventDefault(); });
window.addEventListener('keyup', e => { KEYS[e.key.toLowerCase()] = false; });

/* ---------------------------
   LocalStorage keys
   --------------------------- */
const LS = {
  playerURL: 'spf_player_url_v1',
  goombaURL: 'spf_goomba_url_v1',
  koopaURL: 'spf_koopa_url_v1',
  blockURL: 'spf_block_url_v1',
  coinURL: 'spf_coin_url_v1',
  bgURL: 'spf_bg_url_v1'
};

/* ---------------------------
   Save / restore URLs
   --------------------------- */
function saveURLs(){
  localStorage.setItem(LS.playerURL, inpPlayer.value.trim());
  localStorage.setItem(LS.goombaURL, inpGoomba.value.trim());
  localStorage.setItem(LS.koopaURL, inpKoopa.value.trim());
  localStorage.setItem(LS.blockURL, inpBlock.value.trim());
  localStorage.setItem(LS.coinURL, inpCoin.value.trim());
  localStorage.setItem(LS.bgURL, inpBg.value.trim());
}
function restoreURLs(){
  inpPlayer.value = localStorage.getItem(LS.playerURL) || '';
  inpGoomba.value = localStorage.getItem(LS.goombaURL) || '';
  inpKoopa.value = localStorage.getItem(LS.koopaURL) || '';
  inpBlock.value = localStorage.getItem(LS.blockURL) || '';
  inpCoin.value = localStorage.getItem(LS.coinURL) || '';
  inpBg.value = localStorage.getItem(LS.bgURL) || '';
}
restoreURLs();

/* ---------------------------
   Level generator (procedural, playable)
   --------------------------- */
function generateLevel(cols = COLS){
  COLS = Math.max(80, Math.min(3000, cols|0));
  WORLD_W = COLS * TILE;
  tiles = []; coins = []; enemies = []; particles = [];
  const groundRow = ROWS - 2;
  // create grid
  const grid = Array.from({length: ROWS}, ()=>Array.from({length: COLS}, ()=>'.'));

  // ground with occasional gaps
  for(let c=0;c<COLS;c++){
    if(c < 6) grid[groundRow][c] = '#';
    else {
      if(Math.random() < 0.03 && c > 12 && c < COLS - 12){
        const gap = 1 + Math.floor(Math.random()*2);
        c += gap - 1;
      } else grid[groundRow][c] = '#';
    }
  }

  // platforms / blocks
  for(let x=8;x<COLS-8; x+=Math.floor(4 + Math.random()*10)){
    const seg = Math.floor(Math.random()*4);
    const segLen = Math.floor(4 + Math.random()*14);
    if(seg===0){
      // floating platforms
      for(let i=0;i<Math.floor(1+Math.random()*4);i++){
        const c = x + Math.floor(Math.random()*segLen);
        const r = groundRow - (2 + Math.floor(Math.random()*3));
        if(r>0) grid[r][c] = '#';
        if(Math.random() < 0.6) coins.push({x:c*TILE+TILE/2, y:r*TILE - TILE/2, r:10, collected:false});
      }
    } else if(seg===1){
      // staircase
      const h = 1 + Math.floor(Math.random()*4);
      for(let s=0;s<Math.min(segLen, COLS-x); s++){
        const c = x + s; const r = groundRow - Math.min(h, Math.floor(s/2));
        grid[r][c] = '#';
        if(Math.random()<0.25) coins.push({x:c*TILE+TILE/2, y:r*TILE - TILE/2, r:10, collected:false});
      }
    } else if(seg===2){
      // block band
      const r = groundRow - (2 + Math.floor(Math.random()*2));
      for(let c=x; c<Math.min(COLS-4, x+segLen); c++){
        if(Math.random() < 0.8) grid[r][c] = '#';
        if(Math.random() < 0.3) coins.push({x:c*TILE+TILE/2, y:r*TILE - TILE/2, r:10, collected:false});
      }
    } else {
      // scattered coins
      for(let c=x; c<Math.min(COLS-4,x+segLen); c+=3){
        if(Math.random()<0.45) coins.push({x:c*TILE+TILE/2, y:(groundRow-1)*TILE - TILE/2, r:10, collected:false});
      }
    }
  }

  // convert grid to tiles list
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      if(grid[r][c] === '#') tiles.push({r,c});
    }
  }

  // spawn enemies densely across world
  const enemyCount = Math.max(24, Math.floor(COLS / 8));
  for(let i=0;i<enemyCount;i++){
    const x = 240 + Math.floor(Math.random()*(WORLD_W - 480));
    const col = Math.floor(x / TILE);
    let groundFound = null;
    for(let r=0;r<ROWS;r++){
      if(grid[r][col] === '#'){ groundFound = r; break; }
    }
    const y = (groundFound ? groundFound : ROWS - 2) * TILE - 34;
    const type = Math.random() < 0.7 ? 'goomba' : 'koopa';
    enemies.push({x, y, w:32, h:34, vx: -0.6 - Math.random()*0.6, alive:true, type});
  }

  // coins on ground
  for(let c=6;c<COLS-6;c+=4){
    if(Math.random() < 0.35) coins.push({x:c*TILE + TILE/2, y:(ROWS-2 - 0.6)*TILE, r:10, collected:false});
  }

  // set player start
  player.x = 120; player.y = (ROWS-3)*TILE - player.h; player.vx = player.vy = 0;
  score = 0; coinCount = 0;
  buildMinimap();
}

/* ---------------------------
   Minimap build (small canvas)
   --------------------------- */
function buildMinimap(){
  minimap.innerHTML = '';
  const can = document.createElement('canvas'); can.width = 200; can.height = 64;
  const c = can.getContext('2d');
  c.fillStyle = '#eaf9ff'; c.fillRect(0,0,can.width, can.height);
  tiles.forEach(t=>{
    const x = Math.floor((t.c / COLS) * can.width);
    const y = Math.floor((t.r / ROWS) * can.height);
    c.fillStyle = '#6b4b32';
    c.fillRect(x, y, Math.max(1, Math.ceil(can.width/COLS)), Math.max(1, Math.ceil(can.height/ROWS)));
  });
  minimap.appendChild(can);
}

/* ---------------------------
   Collision helpers
   --------------------------- */
function tileAt(px, py){
  const c = Math.floor(px / TILE), r = Math.floor(py / TILE);
  if(r<0||r>=ROWS||c<0||c>=COLS) return false;
  for(const t of tiles) if(t.r === r && t.c === c) return true;
  return false;
}

function collideWithWorld(ent){
  ent.onGround = false;
  const minC = Math.floor((ent.x - 2)/TILE), maxC = Math.floor((ent.x + ent.w + 2)/TILE);
  const minR = Math.floor((ent.y - 2)/TILE), maxR = Math.floor((ent.y + ent.h + 2)/TILE);
  for(let r=minR;r<=maxR;r++){
    for(let c=minC;c<=maxC;c++){
      if(r<0||r>=ROWS||c<0||c>=COLS) continue;
      if(tileAt(c*TILE, r*TILE)){
        const tx = c*TILE, ty = r*TILE;
        const overlapX = Math.min(ent.x + ent.w, tx + TILE) - Math.max(ent.x, tx);
        const overlapY = Math.min(ent.y + ent.h, ty + TILE) - Math.max(ent.y, ty);
        if(overlapX > 0 && overlapY > 0){
          if(overlapX < overlapY){
            if(ent.x < tx) ent.x -= overlapX; else ent.x += overlapX;
            ent.vx = 0;
          } else {
            if(ent.y < ty){
              ent.y -= overlapY; ent.vy = 0; ent.onGround = true;
              if(ent === player) player.jumpCount = 0;
            } else {
              ent.y += overlapY; ent.vy = 0;
            }
          }
        }
      }
    }
  }
}

/* ---------------------------
   Particles
   --------------------------- */
function spawnParticles(x,y,col,count=8){
  for(let i=0;i<count;i++){
    particles.push({x,y,vx:(Math.random()*4-2),vy:(Math.random()*-3 -0.5),life:30 + Math.floor(Math.random()*40),col});
  }
}

/* ---------------------------
   Update loop (physics, AI)
   --------------------------- */
const GRAV = 0.8, FRICTION = 0.85, MAXVX = 7, JUMP = 18;
let coyote = 0;

function update(){
  // inputs
  if(KEYS['arrowleft'] || KEYS['a']){ player.vx -= 0.9; player.dir = -1; }
  if(KEYS['arrowright'] || KEYS['d']){ player.vx += 0.9; player.dir = 1; }
  coyote = Math.max(0, coyote - 1);
  if(player.onGround) coyote = 6;
  if(KEYS['z'] || KEYS['arrowup'] || KEYS[' ']){
    if(player.onGround || player.jumpCount < MAX_JUMPS){
        player.vy = -JUMP;
        player.onGround = false;
        player.jumpCount++;
        spawnParticles(player.x + player.w/2, player.y + player.h, '#bbb', 10);
    }
}

  // physics
  player.vy += GRAV;
  player.vx *= FRICTION;
  player.vx = Math.max(-MAXVX, Math.min(MAXVX, player.vx));
  player.x += player.vx; player.y += player.vy;

  // fell
  if(player.y > ROWS*TILE + 300) respawn();

  collideWithWorld(player);

  // coins
  for(const c of coins){
    if(c.collected) continue;
    const dx = (player.x + player.w/2) - c.x;
    const dy = (player.y + player.h/2) - c.y;
    if(Math.hypot(dx,dy) < c.r + Math.max(player.w, player.h)/4){
      c.collected = true; score += 10; coinCount++; spawnParticles(c.x, c.y, '#ffd54a', 12);
    }
  }

  // enemies AI & collisions
  for(const e of enemies){
    if(!e.alive) continue;
    e.x += e.vx;
    const aheadX = e.vx < 0 ? e.x - 4 : e.x + e.w + 4;
    if(!tileAt(aheadX, e.y + e.h + 6)) e.vx *= -1;
    if(tileAt(e.x + (e.vx < 0 ? -4 : e.w + 4), e.y)) e.vx *= -1;
    if(rectIntersect(player, e)){
      if(player.vy > 0 && (player.y + player.h - e.y) < 18){
        // stomp
        player.vy = -8; e.alive = false; score += 100; spawnParticles(e.x + e.w/2, e.y + e.h/2, '#ff7', 12);
      } else {
        respawn();
      }
    }
  }

  // particles
  for(let i = particles.length -1; i>=0; i--){
    const p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--;
    if(p.life <= 0) particles.splice(i,1);
  }

  // camera
  const target = player.x - (canvas.width * 0.35);
  cameraX += (target - cameraX) * 0.12;
  cameraX = Math.max(0, Math.min(WORLD_W - canvas.width, cameraX));

  // HUD
  hudCoins.textContent = 'Monedas: ' + coinCount;
  hudScore.textContent = 'Puntos: ' + score;

  // minimap player update
  updateMinimapMarker();
}

/* ---------------------------
   Drawing
   --------------------------- */
function draw(){
  // clear
  ctx.clearRect(0,0,canvas.width, canvas.height);

  // background
  if(ASSETS.bg && ASSETS.bg.complete){
    const pat = ctx.createPattern(ASSETS.bg, 'repeat-x');
    ctx.save(); ctx.translate(-cameraX * 0.18, 0); ctx.fillStyle = pat; ctx.fillRect(0,0,canvas.width + cameraX * 0.3, canvas.height); ctx.restore();
  } else {
    ctx.fillStyle = '#9be0ff'; ctx.fillRect(0,0,canvas.width, canvas.height);
    for(let i=0;i<6;i++){
      const x = ((i*380) - cameraX*0.18) % (canvas.width + 600) - 200 + i*40;
      drawCloud(x, 80 + (i%2)*18);
    }
  }

  // ground band
  ctx.fillStyle = '#6cc'; ctx.fillRect(0, canvas.height - 80, canvas.width, 80);

  // world translate
  ctx.save(); ctx.translate(-cameraX, 0);

  // tiles
  for(const t of tiles){
    const x = t.c * TILE, y = t.r * TILE;
    if(ASSETS.block && ASSETS.block.complete) ctx.drawImage(ASSETS.block, x, y, TILE, TILE);
    else drawBlock(x,y);
  }

  // coins
  for(const c of coins){
    if(c.collected) continue;
    if(ASSETS.coin && ASSETS.coin.complete) ctx.drawImage(ASSETS.coin, c.x - 12, c.y - 12, 24, 24);
    else { ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI*2); ctx.fillStyle = '#ffd54a'; ctx.fill(); }
  }

// enemies
for(const e of enemies){
  if(!e.alive) continue;
  const img = e.type === 'koopa' ? ASSETS.koopa : ASSETS.goomba;
  if(img && img.complete){
    const scaleX = 0.9; // 1.3 = 30% más ancho
    const scaleY = 0.3; // 0.7 = 30% más bajo
    ctx.drawImage(
      img,
      e.x,
      e.y - (img.height*scaleY > e.h ? img.height*scaleY - e.h : 0),
      e.w * scaleX,
      img.height * scaleY
    );
  } else drawEnemy(e.x, e.y, e.w, e.h, e.type);
}



  // flag at end
  const flagX = WORLD_W - TILE * 4;
  drawFlag(flagX, (ROWS - 3) * TILE - 32);

  // player
  if(ASSETS.player && ASSETS.player.complete){
    const img = ASSETS.player;
    let frames = 4;
    if(img.width / frames < img.height) frames = 1;
    const fw = img.width / frames, fh = img.height;
    const f = player.frame % frames;
    ctx.save();
    if(player.dir < 0){ ctx.translate(player.x + player.w/2, 0); ctx.scale(-1,1); ctx.translate(-player.x - player.w/2, 0); }
    if(frames > 1) ctx.drawImage(img, f*fw, 0, fw, fh, player.x, player.y - (fh - player.h), player.w, fh);
    else ctx.drawImage(img, player.x, player.y - Math.max(0,img.height - player.h), player.w, img.height > player.h ? img.height : player.h);
    ctx.restore();
  } else drawPlayer(player.x, player.y, player.w, player.h, player.dir);

  // particles
  for(const p of particles){ ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 60)); ctx.fillStyle = p.col; ctx.fillRect(p.x, p.y, 2, 2); ctx.globalAlpha = 1; }

  ctx.restore();
}

/* ---------------------------
   Utilities draw primitives
   --------------------------- */
function drawBlock(x,y){ ctx.fillStyle = '#7b4f20'; ctx.fillRect(x,y,TILE,TILE); ctx.fillStyle = '#9a6d2b'; ctx.fillRect(x,y, TILE,8); }
function drawCloud(x,y){ ctx.save(); ctx.globalAlpha = 0.9; ctx.fillStyle='white'; ctx.beginPath(); ctx.ellipse(x+30,y,40,24,0,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.ellipse(x+60,y+6,36,20,0,0,Math.PI*2); ctx.fill(); ctx.restore(); }
function drawEnemy(x,y,w,h,type){ ctx.save(); if(type==='koopa'){ ctx.fillStyle='#2a7'; ctx.fillRect(x,y-6,w,h+6); ctx.fillStyle='#000'; ctx.fillRect(x+6,y+8,6,6); } else { ctx.fillStyle='#8b5533'; ctx.fillRect(x,y,w,h); ctx.fillStyle='#000'; ctx.fillRect(x+6,y+8,6,6);} ctx.restore(); }
function drawPlayer(x,y,w,h,dir){ ctx.save(); ctx.translate(x + w/2, y + h/2); if(dir<0) ctx.scale(-1,1); ctx.translate(-w/2, -h/2); ctx.fillStyle = '#5b3e2b'; ctx.fillRect(6, h-14, 10, 12); ctx.fillRect(w-16, h-14, 10, 12); ctx.fillStyle = '#d33'; ctx.fillRect(4, 18, w-8, 18); ctx.fillStyle = '#ffd1b3'; ctx.fillRect(8,4, w-16, 14); ctx.fillStyle = '#b30000'; ctx.fillRect(6,0, w-12, 8); ctx.fillStyle = '#000'; ctx.fillRect(w-22,10,3,3); ctx.restore(); }
function drawFlag(x,y){ ctx.save(); ctx.fillStyle = '#552'; ctx.fillRect(x,y,6,80); ctx.fillStyle = '#ff1f1f'; ctx.beginPath(); ctx.moveTo(x+6,y); ctx.lineTo(x+38,y+12); ctx.lineTo(x+6,y+24); ctx.closePath(); ctx.fill(); ctx.restore(); }

/* ---------------------------
   Minimap update
   --------------------------- */
function updateMinimapMarker(){
  const canvasMini = minimap.querySelector('canvas');
  if(!canvasMini) return;
  const cm = canvasMini.getContext('2d');
  cm.fillStyle = '#eaf9ff'; cm.fillRect(0,0,canvasMini.width, canvasMini.height);
  tiles.forEach(t=>{
    const x = Math.floor((t.c / COLS) * canvasMini.width);
    const y = Math.floor((t.r / ROWS) * canvasMini.height);
    cm.fillStyle = '#6b4b32';
    cm.fillRect(x,y, Math.max(1, Math.ceil(canvasMini.width/COLS)), Math.max(1, Math.ceil(canvasMini.height/ROWS)));
  });
  const px = Math.floor((player.x / (COLS * TILE)) * canvasMini.width);
  cm.fillStyle = '#d33'; cm.fillRect(px, 2, 4, canvasMini.height - 4);
}

/* ---------------------------
   Respawn / restart
   --------------------------- */
function respawn(){
  player.x = Math.max(120, player.x - 320);
  player.y = (ROWS - 3) * TILE - player.h;
  player.vx = player.vy = 0;
  score = Math.max(0, score - 50);
}

function restartGame(){
  generateLevel(COLS);
  initMinimapCanvas();
}

/* ---------------------------
   Main loop
   --------------------------- */
let last = 0;
function loop(t){
  const dt = (t - last) / 16.666; last = t;
  update(dt);
  draw(dt);
  requestAnimationFrame(loop);
}

/* ---------------------------
   Init minimap canvas
   --------------------------- */
function initMinimapCanvas(){
  minimap.innerHTML = '';
  const can = document.createElement('canvas'); can.width = 200; can.height = 64;
  minimap.appendChild(can);
  buildMinimap();
}

/* ---------------------------
   Events: overlay buttons and HUD
   --------------------------- */
btnLoad.addEventListener('click', async ()=>{
  btnLoad.disabled = true; btnLoad.textContent = 'Cargando...';
  // try load images from inputs; fall back to embedded bases
  const p = await loadImage(inpPlayer.value.trim()) || await loadImage(localStorage.getItem(LS.playerURL) || '') || await loadImage(FALLBACK.player);
  const g = await loadImage(inpGoomba.value.trim()) || await loadImage(localStorage.getItem(LS.goombaURL) || '') || await loadImage(FALLBACK.goomba);
  const k = await loadImage(inpKoopa.value.trim()) || await loadImage(localStorage.getItem(LS.koopaURL) || '') || await loadImage(FALLBACK.koopa);
  const b = await loadImage(inpBlock.value.trim()) || await loadImage(localStorage.getItem(LS.blockURL) || '') || await loadImage(FALLBACK.block);
  const co = await loadImage(inpCoin.value.trim()) || await loadImage(localStorage.getItem(LS.coinURL) || '') || await loadImage(FALLBACK.coin);
  const bg = await loadImage(inpBg.value.trim()) || await loadImage(localStorage.getItem(LS.bgURL) || '') || await loadImage(FALLBACK.bg);

  ASSETS.player = p; ASSETS.goomba = g; ASSETS.koopa = k; ASSETS.block = b; ASSETS.coin = co; ASSETS.bg = bg;

  // save entered URLs
  saveURLs();
  btnLoad.disabled = false; btnLoad.textContent = 'Cargar y Jugar';
  overlay.classList.add('hidden'); overlay.setAttribute('aria-hidden','true');
  generateLevel(COLS);
  initMinimapCanvas();
  requestAnimationFrame(loop);
});

btnDefaults.addEventListener('click', async ()=>{
  ASSETS.player = await loadImage(FALLBACK.player);
  ASSETS.goomba = await loadImage(FALLBACK.goomba);
  ASSETS.koopa = await loadImage(FALLBACK.koopa);
  ASSETS.block = await loadImage(FALLBACK.block);
  ASSETS.coin = await loadImage(FALLBACK.coin);
  ASSETS.bg = await loadImage(FALLBACK.bg);
  overlay.classList.add('hidden'); overlay.setAttribute('aria-hidden','true');
  generateLevel(COLS);
  initMinimapCanvas();
  requestAnimationFrame(loop);
});

btnRestart.addEventListener('click', ()=> restartGame());
btnImage.addEventListener('click', ()=> { overlay.classList.remove('hidden'); overlay.setAttribute('aria-hidden','false'); });

/* ---------------------------
   Init: load fallback assets and show overlay
   --------------------------- */
(async function init(){
  // load fallback so overlay shows preview even if no internet
  ASSETS.player = await loadImage(FALLBACK.player);
  ASSETS.goomba = await loadImage(FALLBACK.goomba);
  ASSETS.koopa = await loadImage(FALLBACK.koopa);
  ASSETS.block = await loadImage(FALLBACK.block);
  ASSETS.coin = await loadImage(FALLBACK.coin);
  ASSETS.bg = await loadImage(FALLBACK.bg);
  restoreURLs();
  // overlay remains visible until user loads or defaults
})();

/* ---------------------------
   small helpers
   --------------------------- */
function rectIntersect(a,b){ return !(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h); }
