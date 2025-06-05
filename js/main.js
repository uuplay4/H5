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
const btnBubbleBlast = document.getElementById('btn-bubble-blast'); // 泡沫冲击按钮
const loadingProgress = document.getElementById('loading-progress');
const canvas = document.getElementById('game-canvas');

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

// 添加泡沫冲击事件
btnBubbleBlast.addEventListener('click', bubbleBlast);

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
let lives = 3; // 生命值
let bacteriaTimers = []; // 细菌计时器
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
  lives = 3; // 初始化生命值
  bacteriaTimers = []; // 重置细菌计时器
  showPage('game');
  document.getElementById('current-score').textContent = 0;
  updateHearts(); // 更新生命值显示

  const oldBar = document.getElementById('level-bar');
  if (oldBar) oldBar.remove();

  startLevel();
}

// 开始关卡
function startLevel() {
  elements = [];
  bacteriaTimers = []; // 重置细菌计时器
  redrawCanvas();
  updateHUD();
  let config = levelConfigs[level];
  let timeLeft = config.time;

  document.getElementById('level-target').textContent = config.target;
  document.getElementById('level-time').textContent = timeLeft;

  spawnTimer = setInterval(spawnElement, config.spawn);
  levelTimer = setInterval(() => {
    timeLeft--;
    document.getElementById('level-time').textContent = timeLeft;
    updateProgressBar(timeLeft / config.time);
    if (timeLeft <= 0) {
      clearInterval(spawnTimer);
      clearInterval(levelTimer);
      checkLevelPassed();
    }
  }, 1000);

  // 只初始化一次 level-bar
  if (!document.getElementById('level-bar')) {
    const bar = document.createElement('div');
    bar.id = 'level-bar';
    bar.style.position = 'absolute';
    bar.style.top = '10px';
    bar.style.left = '20px';
    bar.style.width = '600px';
    bar.style.height = '8px';
    bar.style.background = 'rgba(255,255,255,0.3)';
    bar.style.borderRadius = '5px';
    bar.innerHTML = `<div id="progress-inner" style="width:100%;height:100%;background:#4caf50;border-radius:5px;"></div>`;
    canvas.parentElement.appendChild(bar);
  }
}

// 更新进度条
function updateProgressBar(pct) {
  const inner = document.getElementById('progress-inner');
  if (inner) inner.style.width = (pct * 100) + '%';
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
  } else if (lives <= 0) {
    endGame(false);
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
  overlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 640px;
    height: 1008px;
    background: rgba(0,0,0,0.7);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-size: 32px;
    color: #4CAF50;
  `;
  overlay.innerHTML = `
    <div>${level + 1 < totalLevels ? `成功！进入第${level + 2}关` : `恭喜通关！`}</div>
    <div style="font-size:24px; margin-top: 10px;">得分: ${getCurrentScore()}</div>
  `;
  document.getElementById('page-game').appendChild(overlay);

  setTimeout(() => {
    overlay.remove();
    callback();
  }, 2000);
}

// 生成元素
function spawnElement() {
  // 设置安全偏移量，避开左上方统计区域（假设统计区域宽200px，高150px）
  const safeOffsetX = 200;
  const safeOffsetY = 150;
  
  // 增加细菌出现的概率
  const types = ['probiotic', 'vitc', 'vite', 'bacteria', 'bacteria'];
  const type = types[Math.floor(Math.random() * types.length)];
  
  // 10%的概率生成多个细菌
  if (type === 'bacteria' && Math.random() < 0.50) {
    const count = Math.floor(Math.random() * 3) + 2; // 2或3个细菌
    for (let i = 0; i < count; i++) {
      const x = Math.random() * (640 - 80 - safeOffsetX) + safeOffsetX;
      const y = Math.random() * (1008 - 200 - safeOffsetY) + safeOffsetY;
      const el = { x, y, type, removed: false };
      elements.push(el);
      
      // 为每个细菌设置计时器
      const timer = setTimeout(() => {
        if (!el.removed) {
          lives--;
          updateHearts();
          redrawCanvas();
          if (lives <= 0) {
            endGame(false);
          }
          // 移除细菌
          el.removed = true;
          redrawCanvas();
        }
      }, 2000); // 2秒后扣血并移除细菌
      bacteriaTimers.push({ el, timer });
    }
  } else {
    // 其他元素生成
    const x = Math.random() * (640 - 80 - safeOffsetX) + safeOffsetX;
    const y = Math.random() * (1008 - 200 - safeOffsetY) + safeOffsetY;
    const el = { x, y, type, removed: false };
    elements.push(el);
    
    // 如果是细菌，设置计时器
    if (type === 'bacteria') {
      const timer = setTimeout(() => {
        if (!el.removed) {
          lives--;
          updateHearts();
          redrawCanvas();
          if (lives <= 0) {
            endGame(false);
          }
          // 移除细菌
          el.removed = true;
          redrawCanvas();
        }
      }, 2000); // 2秒后扣血并移除细菌
      bacteriaTimers.push({ el, timer });
    }
  }

  redrawCanvas();
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
  document.getElementById('current-score').textContent = getCurrentScore();
  updateHearts(); // 更新生命值显示
}

// 更新生命值显示
function updateHearts() {
  const heartElement = document.getElementById('count-hearts');
  heartElement.textContent = '❤️'.repeat(lives);
}

// 泡沫冲击功能
function bubbleBlast() {
  const totalCoreElements = counts.probiotic + counts.vitc + counts.vite;
  if (totalCoreElements >= 10) {
    // 计算每种元素消耗的数量（按比例消耗）
    const probioticRatio = counts.probiotic / totalCoreElements;
    const vitcRatio = counts.vitc / totalCoreElements;
    const viteRatio = counts.vite / totalCoreElements;

    const probioticToConsume = Math.floor(10 * probioticRatio);
    const vitcToConsume = Math.floor(10 * vitcRatio);
    const viteToConsume = 10 - probioticToConsume - vitcToConsume; // 确保总数正好是10

    counts.probiotic -= probioticToConsume;
    counts.vitc -= vitcToConsume;
    counts.vite -= viteToConsume;

    updateHUD();

    // 清除所有细菌
    elements = elements.filter(el => el.type !== 'bacteria');
    // 清除所有细菌计时器
    bacteriaTimers.forEach(timerObj => {
      clearTimeout(timerObj.timer);
    });
    bacteriaTimers = [];

    redrawCanvas();

    // 显示效果
    const status = document.getElementById('bubble-status');
    status.textContent = '已使用';
    status.style.color = '#4CAF50';

    setTimeout(() => {
      status.textContent = '准备中';
      status.style.color = '#fff';
    }, 2000);
  } else {
    const status = document.getElementById('bubble-status');
    status.textContent = '资源不足';
    status.style.color = '#F44336';

    setTimeout(() => {
      status.textContent = '准备中';
      status.style.color = '#fff';
    }, 2000);
  }
}

// 结束游戏
function endGame(success = true) {
  clearInterval(spawnTimer);
  clearInterval(levelTimer);
  // 清除所有细菌计时器
  bacteriaTimers.forEach(timerObj => {
    clearTimeout(timerObj.timer);
  });
  bacteriaTimers = [];
  bgMusic.pause();

  const resultPage = document.getElementById('page-result');
  resultPage.className = success ? 'page active success' : 'page active failed';

  document.getElementById('res-probiotic').textContent = counts.probiotic;
  document.getElementById('res-vitc').textContent = counts.vitc;
  document.getElementById('res-vite').textContent = counts.vite;
  document.getElementById('res-bacteria').textContent = counts.bacteria;

  const score = getCurrentScore();
  document.getElementById('final-score').textContent = score;

  if (success) {
    document.getElementById('result-title').textContent = "成功通关！";
    document.getElementById('result-message').textContent = `恭喜完成所有挑战！总得分: ${score}`;
  } else {
    document.getElementById('result-title').textContent = "游戏结束";
    document.getElementById('result-message').textContent = lives <= 0 
      ? `生命值耗尽！得分: ${score}` 
      : `时间到！得分: ${score}`;
  }

  showPage('result');
}

// 得分计算
function getCurrentScore() {
  return counts.bacteria * 2 + counts.probiotic + counts.vitc + counts.vite;
}

// 初始化 HUD 区域
function initHUD() {
  const hud = document.getElementById('hud');
  hud.innerHTML = `
    <div><span class="label-probiotic">益生菌：</span><span id="count-probiotic">0</span></div>
    <div><span class="label-vitc">维C：</span><span id="count-vitc">0</span></div>
    <div><span class="label-vite">维E：</span><span id="count-vite">0</span></div>
    <div><span class="label-bacteria">细菌消灭：</span><span id="count-bacteria">0</span></div>
    <div><span class="label-score">当前得分：</span><span id="current-score">0</span></div>
    <div><span class="label-hearts">生命值：</span><span id="count-hearts">❤️❤️❤️</span></div>
    <div><span class="label-bubble">泡沫冲击：</span><span id="bubble-status">准备中</span></div>
    <div id="level-info">
      目标: <span id="level-target">0</span> | 
      时间: <span id="level-time">0</span>秒
    </div>
  `;
}

// 启动
initHUD();

// 添加点击事件处理程序以收集元素
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (!el.removed && 
        mx >= el.x && mx <= el.x + 80 && 
        my >= el.y && my <= el.y + 80) {
      counts[el.type]++;
      el.removed = true;
      
      // 如果点击的是细菌，显示牙刷动画
      if (el.type === 'bacteria') {
        const tbWidth = 50;
        const tbHeight = sprites.toothbrush.height / sprites.toothbrush.width * tbWidth;
        const centerX = el.x + 60;
        const centerY = el.y + 150;
        
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(-0.2);
        ctx.drawImage(sprites.toothbrush, -tbWidth / 2, -tbHeight / 2, tbWidth, tbHeight);
        ctx.restore();
        
        // 300ms后重绘画布，移除牙刷动画
        setTimeout(redrawCanvas, 300);
      } else {
        redrawCanvas();
      }
      
      // 更新HUD
      updateHUD();
      
      // 移除对应的计时器
      if (el.type === 'bacteria') {
        const timerIndex = bacteriaTimers.findIndex(timerObj => timerObj.el === el);
        if (timerIndex !== -1) {
          clearTimeout(bacteriaTimers[timerIndex].timer);
          bacteriaTimers.splice(timerIndex, 1);
        }
      }
      
      break;
    }
  }
});