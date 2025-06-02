// 页面元素
const pages = {
  loading: document.getElementById('page-loading'),
  intro: document.getElementById('page-intro'),
  game: document.getElementById('page-game'),
  result: document.getElementById('page-result'),
};
const btnStart = document.getElementById('btn-start');
const btnIntroStart = document.getElementById('btn-intro-start');
const btnRestart = document.getElementById('btn-restart');
const loadingProgress = document.getElementById('loading-progress');

// 音效与背景音乐
const clickSound = new Audio('assets/click.mp3');
clickSound.preload = 'auto';
const bgMusic = new Audio('assets/bg-music.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.3;
bgMusic.preload = 'auto';

// 页面加载进度
let loadPct = 0;
const loadInterval = setInterval(() => {
  loadPct += 10;
  loadingProgress.style.width = loadPct + '%';
  if (loadPct >= 100) {
    clearInterval(loadInterval);
    btnStart.disabled = false;
  }
}, 200);
btnStart.disabled = true;

// 页面切换
function showPage(name) {
  Object.values(pages).forEach(p => p.classList.remove('active'));
  pages[name].classList.add('active');
}

// 点击音效
const canvas = document.getElementById('game-canvas');
canvas.addEventListener('click', () => {
  clickSound.currentTime = 0;
  clickSound.play().catch(() => {});
});

// 事件绑定
btnStart.addEventListener('click', () => showPage('intro'));
btnIntroStart.addEventListener('click', () => {
  bgMusic.currentTime = 0;
  bgMusic.play().catch(() => {});
  initGame();
});
btnRestart.addEventListener('click', () => {
  bgMusic.pause();
  location.reload();
});

// 游戏核心变量
let level = 0;
const totalLevels = 3;
let levelTimer, spawnTimer;
const levelConfigs = [
  { time: 20, spawn: 1000, target: 20 },
  { time: 25, spawn: 800, target: 55 },
  { time: 30, spawn: 600, target: 120 }
];
let counts, ctx, sprites = {}, elements = [];
ctx = canvas.getContext('2d');

// 图像预加载
const imageList = {
  probiotic: 'assets/icon-probiotic.png',
  vitc: 'assets/icon-vitc.png',
  vite: 'assets/icon-vite.png',
  bacteria: 'assets/icon-bacteria.png',
  'bg-game': 'assets/bg-game.jpg',
  toothbrush: 'assets/toothbrush.png'
};
for (let key in imageList) {
  const img = new Image();
  img.src = imageList[key];
  sprites[key] = img;
}

// 初始化游戏
function initGame() {
  level = 0;
  counts = { probiotic: 0, vitc: 0, vite: 0, bacteria: 0 };
  showPage('game');
  document.getElementById('current-score').textContent = 0; // 初始化得分为0
  startLevel();
}

// 开始关卡
function startLevel() {
  // 🧹 清除旧进度条
  const oldBar = document.getElementById('level-bar');
  if (oldBar) oldBar.remove();

  elements = [];
  redrawCanvas();
  updateHUD();
  let config = levelConfigs[level];
  let timeLeft = config.time;

  spawnTimer = setInterval(spawnElement, config.spawn);
  levelTimer = setInterval(() => {
    timeLeft--;
    updateProgressBar(timeLeft / config.time);
    if (timeLeft <= 0) {
      clearInterval(spawnTimer);
      clearInterval(levelTimer);
      checkLevelPassed();
    }
  }, 1000);
}

// 更新进度条
function updateProgressBar(pct) {
  if (!document.getElementById('level-bar')) {
    const bar = document.createElement('div');
    bar.id = 'level-bar';
    bar.style.position = 'absolute';
    bar.style.top = '5px'; // 👆 上移
    bar.style.left = '20px';
    bar.style.width = '600px';
    bar.style.height = '10px';
    bar.style.background = '#ccc';
    bar.style.borderRadius = '4px';
    bar.innerHTML = '<div id="bar-inner" style="height:100%;background:#4caf50;width:100%;border-radius:4px;"></div>';
    canvas.parentElement.appendChild(bar);
  }
  document.getElementById('bar-inner').style.width = (pct * 100) + '%';
}

// 检查是否通过关卡
function checkLevelPassed() {
  const totalScore = getCurrentScore();
  const target = levelConfigs[level].target;
  if (totalScore >= target) {
    showLevelPassed(() => {
      level++;
      if (level < totalLevels) {
        startLevel();
      } else {
        endGame(true);
      }
    });
  } else {
    endGame(false);
  }
}

// 成功进入下一关提示
function showLevelPassed(callback) {
  const existing = document.getElementById('level-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'level-overlay';
  overlay.style.position = 'absolute';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '640px';
  overlay.style.height = '1008px';
  overlay.style.background = 'rgba(0,0,0,0.7)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.fontSize = '32px';
  overlay.style.color = '#fff';
  overlay.innerText = level + 1 < totalLevels
    ? `成功！进入第${level + 2}关`
    : `成功通关！`;
  document.getElementById('page-game').appendChild(overlay);
  setTimeout(() => {
    overlay.remove();
    callback();
  }, 2000);
}

// 生成元素
function spawnElement() {
  const types = ['probiotic', 'vitc', 'vite', 'bacteria'];
  const type = types[Math.floor(Math.random() * types.length)];
  const x = Math.random() * (640 - 80);
  const y = Math.random() * (1008 - 200);
  const el = { x, y, type, removed: false };
  elements.push(el);
  redrawCanvas();

  function handler(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    if (!el.removed && mx >= x && mx <= x + 80 && my >= y && my <= y + 80) {
      counts[type]++;
      el.removed = true;
      updateHUD();
      if (type === 'bacteria') {
        const tbWidth = 50;
        const tbHeight = sprites.toothbrush.height / sprites.toothbrush.width * tbWidth;
        const centerX = x + 60;
        const centerY = y + 150;
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(-0.2);
        ctx.drawImage(sprites.toothbrush, -tbWidth / 2, -tbHeight / 2, tbWidth, tbHeight);
        ctx.restore();
        setTimeout(redrawCanvas, 300);
      } else {
        redrawCanvas();
      }
      canvas.removeEventListener('click', handler);
    }
  }

  canvas.addEventListener('click', handler);
}

// 重绘画布
function redrawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(sprites['bg-game'], 0, 0, 640, 1008);
  elements.forEach(el => {
    if (!el.removed) {
      ctx.drawImage(sprites[el.type], el.x, el.y, 80, 80);
    }
  });
}

// 更新 HUD
function updateHUD() {
  document.getElementById('count-probiotic').textContent = counts.probiotic;
  document.getElementById('count-vitc').textContent = counts.vitc;
  document.getElementById('count-vite').textContent = counts.vite;
  document.getElementById('count-bacteria').textContent = counts.bacteria;
  // 新增得分更新
  document.getElementById('current-score').textContent = getCurrentScore();
}

// 结束游戏
function endGame(success = true) {
  clearInterval(spawnTimer);
  clearInterval(levelTimer);
  bgMusic.pause();
  showPage('result');
  document.getElementById('res-probiotic').textContent = counts.probiotic;
  document.getElementById('res-vitc').textContent = counts.vitc;
  document.getElementById('res-vite').textContent = counts.vite;
  document.getElementById('res-bacteria').textContent = counts.bacteria;

  const score = getCurrentScore();
  const maxScore = levelConfigs.reduce((s, cfg) => s + cfg.target, 0);

  const resultText = document.createElement('p');
  resultText.textContent = success
    ? `成功通关！总得分：${score}`
    : `挑战失败，再试一次吧！得分：${score}`;
  const resultPage = document.getElementById('page-result');
  resultPage.appendChild(resultText);
}

// 计算得分
function getCurrentScore() {
  return counts.bacteria * 2 + counts.probiotic + counts.vitc + counts.vite;
}
