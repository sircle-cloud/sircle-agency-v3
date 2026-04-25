/* Sircle-Snake — 404 minigame
 * Vanilla JS, canvas 2D. Walls vormen het cijfer "404".
 * Eet 20 dots = win. Raak wall/jezelf = game over.
 */
(function () {
  'use strict';

  const GRID = 24;
  const WIN_SCORE = 20;
  const TICK_START = 8;     // ticks per second
  const TICK_MAX = 16;
  const TICK_STEP = 0.5;

  const COLOR_BG = '#0C180F';
  const COLOR_GRID = 'rgba(242, 226, 164, 0.04)';
  const COLOR_WALL = '#F2E2A4';
  const COLOR_WALL_GLOW = 'rgba(242, 226, 164, 0.18)';
  const COLOR_SNAKE = '#d4af64';
  const COLOR_SNAKE_HEAD = '#F2E2A4';
  const COLOR_FOOD = '#F2E2A4';

  // 5×7 bitmap font for digits
  const FONT = {
    '0': [
      '.###.',
      '#...#',
      '#...#',
      '#...#',
      '#...#',
      '#...#',
      '.###.'
    ],
    '4': [
      '#...#',
      '#...#',
      '#...#',
      '#####',
      '....#',
      '....#',
      '....#'
    ]
  };

  // Build wall set from "404" centered on grid
  function buildWalls() {
    const walls = new Set();
    const text = '404';
    const charW = 5, charH = 7, gap = 1;
    const totalW = text.length * charW + (text.length - 1) * gap;
    const startCol = Math.floor((GRID - totalW) / 2);
    const startRow = Math.floor((GRID - charH) / 2);
    text.split('').forEach((ch, i) => {
      const glyph = FONT[ch];
      const colOffset = startCol + i * (charW + gap);
      glyph.forEach((row, r) => {
        for (let c = 0; c < row.length; c++) {
          if (row[c] === '#') walls.add(`${colOffset + c},${startRow + r}`);
        }
      });
    });
    return walls;
  }

  // Game state
  let canvas, ctx, cell;
  let snake, dir, nextDir, food, walls, score, highscore, tickRate, accumulator, lastTime;
  let state = 'idle'; // idle | ready | running | paused | gameover | won
  let moved = false; // becomes true on first direction keypress
  let rafId = null;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init() {
    canvas = document.getElementById('snake-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    walls = buildWalls();
    highscore = parseInt(localStorage.getItem('sircle-snake-highscore') || '0', 10);
    document.getElementById('snake-highscore').textContent = highscore;
    reset();
    resize();
    window.addEventListener('resize', resize);

    const startBtn = document.getElementById('snake-start');
    const pauseBtn = document.getElementById('snake-pause');
    if (startBtn) startBtn.addEventListener('click', startOrRestart);
    if (pauseBtn) pauseBtn.addEventListener('click', togglePause);

    // Keyboard
    window.addEventListener('keydown', onKey);

    // Touch / on-screen pad
    document.querySelectorAll('[data-snake-dir]').forEach(btn => {
      btn.addEventListener('click', e => {
        const d = e.currentTarget.dataset.snakeDir;
        if (state === 'idle') startOrRestart();
        setDir(d);
      });
    });
    // Swipe
    let touchStart = null;
    canvas.addEventListener('touchstart', e => {
      const t = e.touches[0];
      touchStart = { x: t.clientX, y: t.clientY };
    }, { passive: true });
    canvas.addEventListener('touchend', e => {
      if (!touchStart) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
      if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 'right' : 'left');
      else setDir(dy > 0 ? 'down' : 'up');
      if (state === 'idle') startOrRestart();
    }, { passive: true });

    draw();
  }

  function resize() {
    const size = Math.min(canvas.parentElement.clientWidth, 480);
    canvas.width = size;
    canvas.height = size;
    cell = size / GRID;
    draw();
  }

  function reset() {
    snake = [
      { x: 4, y: 21 },
      { x: 3, y: 21 },
      { x: 2, y: 21 }
    ];
    dir = 'right';
    nextDir = 'right';
    moved = false;
    score = 0;
    tickRate = TICK_START;
    accumulator = 0;
    lastTime = 0;
    placeFood();
    updateScore();
  }

  function placeFood() {
    let tries = 0;
    while (tries++ < 200) {
      const x = Math.floor(Math.random() * GRID);
      const y = Math.floor(Math.random() * GRID);
      if (walls.has(`${x},${y}`)) continue;
      if (snake.some(s => s.x === x && s.y === y)) continue;
      food = { x, y };
      return;
    }
    food = { x: 0, y: 0 };
  }

  function startOrRestart() {
    reset();
    state = 'ready';
    hideOverlay();
    document.getElementById('snake-start').textContent = 'Opnieuw';
    setStatus('Druk een pijltoets om te bewegen', true);
    lastTime = performance.now();
    if (!rafId) rafId = requestAnimationFrame(loop);
    draw();
  }

  function setStatus(text, active) {
    const el = document.getElementById('snake-status');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('snake__status--active', !!active);
  }

  function togglePause() {
    if (state === 'running') {
      state = 'paused';
      showOverlay('Pauze', 'Druk op spatie of klik Hervat om verder te gaan.', 'Hervat');
    } else if (state === 'paused') {
      state = 'running';
      hideOverlay();
    }
  }

  function setDir(d) {
    const opp = { up: 'down', down: 'up', left: 'right', right: 'left' };
    if (opp[d] === dir) return;
    nextDir = d;
    if (state === 'ready') {
      moved = true;
      state = 'running';
      setStatus('Pak de stippen', false);
    }
  }

  function onKey(e) {
    const map = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', s: 'down', a: 'left', d: 'right',
      W: 'up', S: 'down', A: 'left', D: 'right'
    };
    if (map[e.key]) {
      if (state === 'idle' || state === 'gameover' || state === 'won') {
        startOrRestart();
      }
      setDir(map[e.key]);
      e.preventDefault();
    } else if (e.key === ' ') {
      if (state === 'running' || state === 'paused') togglePause();
      else if (state === 'idle' || state === 'gameover' || state === 'won') startOrRestart();
      e.preventDefault();
    }
  }

  function loop(time) {
    rafId = requestAnimationFrame(loop);
    const delta = (time - lastTime) / 1000;
    lastTime = time;
    if (state === 'running') {
      accumulator += delta;
      const interval = 1 / tickRate;
      while (accumulator >= interval) {
        accumulator -= interval;
        tick();
      }
    }
    draw();
  }

  function tick() {
    dir = nextDir;
    const head = { x: snake[0].x, y: snake[0].y };
    if (dir === 'up') head.y--;
    else if (dir === 'down') head.y++;
    else if (dir === 'left') head.x--;
    else if (dir === 'right') head.x++;

    // Out of bounds = game over
    if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) return gameOver();
    // Wall collision
    if (walls.has(`${head.x},${head.y}`)) return gameOver();
    // Self collision
    if (snake.some(s => s.x === head.x && s.y === head.y)) return gameOver();

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
      score++;
      tickRate = Math.min(TICK_MAX, tickRate + TICK_STEP);
      updateScore();
      if (score >= WIN_SCORE) return win();
      placeFood();
    } else {
      snake.pop();
    }
  }

  function updateScore() {
    document.getElementById('snake-score').textContent = score;
    if (score > highscore) {
      highscore = score;
      localStorage.setItem('sircle-snake-highscore', String(highscore));
      document.getElementById('snake-highscore').textContent = highscore;
    }
  }

  function gameOver() {
    state = 'gameover';
    setStatus('Game over', false);
    showOverlay('Game over', `Score ${score}/20. Nog een poging?`, 'Probeer opnieuw');
  }

  function win() {
    state = 'won';
    showOverlay('Pagina gevonden', 'Mooi gespeeld. Klaar om verder te kijken?', 'Naar home', true);
  }

  function showOverlay(title, body, btnLabel, isWin) {
    const o = document.getElementById('snake-overlay');
    o.querySelector('.snake-overlay__title').textContent = title;
    o.querySelector('.snake-overlay__body').textContent = body;
    const btn = o.querySelector('.snake-overlay__cta');
    btn.textContent = btnLabel;
    if (isWin) {
      btn.setAttribute('href', 'index.html');
      btn.classList.add('snake-overlay__cta--link');
    } else {
      btn.removeAttribute('href');
      btn.classList.remove('snake-overlay__cta--link');
    }
    o.classList.remove('snake-overlay--hidden');
  }
  function hideOverlay() {
    document.getElementById('snake-overlay').classList.add('snake-overlay--hidden');
  }

  // Overlay button delegation
  document.addEventListener('click', e => {
    const btn = e.target.closest('.snake-overlay__cta');
    if (!btn) return;
    if (btn.classList.contains('snake-overlay__cta--link')) return; // let link follow
    e.preventDefault();
    if (state === 'paused') {
      state = 'running';
      hideOverlay();
    } else {
      startOrRestart();
    }
  });

  // Drawing
  function draw() {
    if (!ctx) return;
    // bg
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // subtle grid
    if (!reduced) {
      ctx.strokeStyle = COLOR_GRID;
      ctx.lineWidth = 1;
      for (let i = 1; i < GRID; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cell, 0);
        ctx.lineTo(i * cell, canvas.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * cell);
        ctx.lineTo(canvas.width, i * cell);
        ctx.stroke();
      }
    }

    // walls (404)
    walls.forEach(key => {
      const [x, y] = key.split(',').map(Number);
      drawWallCell(x, y);
    });

    // food
    if (food) {
      const cx = food.x * cell + cell / 2;
      const cy = food.y * cell + cell / 2;
      const pulse = reduced ? 1 : 1 + Math.sin(performance.now() / 250) * 0.08;
      ctx.fillStyle = COLOR_FOOD;
      ctx.beginPath();
      ctx.arc(cx, cy, (cell / 2 - 3) * pulse, 0, Math.PI * 2);
      ctx.fill();
    }

    // snake
    snake.forEach((s, i) => {
      ctx.fillStyle = i === 0 ? COLOR_SNAKE_HEAD : COLOR_SNAKE;
      const r = 4;
      const x = s.x * cell + 1, y = s.y * cell + 1, w = cell - 2, h = cell - 2;
      roundRect(ctx, x, y, w, h, r);
      ctx.fill();
    });
  }

  function drawWallCell(x, y) {
    ctx.fillStyle = COLOR_WALL_GLOW;
    ctx.fillRect(x * cell, y * cell, cell, cell);
    ctx.fillStyle = COLOR_WALL;
    const inset = cell * 0.18;
    ctx.fillRect(x * cell + inset, y * cell + inset, cell - inset * 2, cell - inset * 2);
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
