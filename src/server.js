// 🔥🔥🔥 GODMODE Bot Testing Proxy v10.0 - COMPLETE 🔥🔥🔥
// Claude最終形態 - 絶対検出させない完全版
// ⚠️ 自サイトのセキュリティテスト専用

const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { performance } = require('perf_hooks');

puppeteer.use(StealthPlugin());
const app = express();

// ========================================
// 設定
// ========================================

const CFG = {
  poolSize: 5,
  timeout: 90000,
  mouseSteps: 80,
  scrollPauses: 5,
  randomClicks: 3
};

// リアルデバイスプロファイル
const PROFILES = {
  win: {
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    vp: { width: 1920, height: 1080 },
    platform: 'Win32',
    vendor: 'Google Inc.',
    gpu: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080)',
    cores: 16,
    mem: 32
  },
  mac: {
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    vp: { width: 1728, height: 1117 },
    platform: 'MacIntel',
    vendor: 'Apple Computer, Inc.',
    gpu: 'Apple M2',
    cores: 8,
    mem: 16
  }
};

// ========================================
// ブラウザプール
// ========================================

class Pool {
  constructor() {
    this.browsers = [];
    this.available = [];
    this.stats = { req: 0, ok: 0, fail: 0 };
  }
  
  async init() {
    console.log('🚀 Initializing...');
    const keys = Object.keys(PROFILES);
    
    for (let i = 0; i < CFG.poolSize; i++) {
      const key = keys[i % keys.length];
      const p = PROFILES[key];
      
      const b = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          `--window-size=${p.vp.width},${p.vp.height}`,
          '--disable-web-security',
          '--disable-dev-shm-usage',
          `--user-agent=${p.ua}`
        ],
        defaultViewport: p.vp
      });
      
      this.browsers.push({ b, p, key });
      this.available.push({ b, p, key });
    }
    
    console.log(`✅ ${CFG.poolSize} browsers ready\n`);
  }
  
  async get() {
    while (this.available.length === 0) await new Promise(r => setTimeout(r, 50));
    return this.available.pop();
  }
  
  put(obj) { this.available.push(obj); }
  
  async cleanup() {
    for (const { b } of this.browsers) await b.close();
  }
}

const pool = new Pool();

// ========================================
// フィンガープリント偽装
// ========================================

async function inject(page, p) {
  await page.evaluateOnNewDocument((prof) => {
    // Navigator
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'platform', { get: () => prof.platform });
    Object.defineProperty(navigator, 'vendor', { get: () => prof.vendor });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => prof.cores });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => prof.mem });
    
    // Plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'PDF Viewer', filename: 'internal-pdf-viewer' },
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-plugin' }
      ]
    });
    
    // Chrome
    window.chrome = {
      runtime: {},
      loadTimes: () => ({ requestTime: Date.now()/1000, navigationType: 'Other' }),
      csi: () => ({ pageT: Date.now() })
    };
    
  }, p);
  
  // Canvas
  await page.evaluateOnNewDocument(() => {
    const shift = 0.00001;
    const orig = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function(...args) {
      const data = orig.apply(this, args);
      for (let i = 0; i < data.data.length; i++) {
        data.data[i] += (Math.random() - 0.5) * shift * 255;
      }
      return data;
    };
  });
  
  // WebGL
  await page.evaluateOnNewDocument((prof) => {
    const get = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(p) {
      if (p === 37445) return 'Google Inc.';
      if (p === 37446) return prof.gpu;
      return get.call(this, p);
    };
  }, p);
  
  // Audio
  await page.evaluateOnNewDocument(() => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      const orig = AC.prototype.createOscillator;
      AC.prototype.createOscillator = function() {
        const osc = orig.call(this);
        const s = osc.start;
        osc.start = function() {
          osc.frequency.value += Math.random() * 0.00001;
          return s.apply(this, arguments);
        };
        return osc;
      };
    }
  });
  
  // Permissions
  await page.evaluateOnNewDocument(() => {
    navigator.permissions.query = () => Promise.resolve({ state: 'granted' });
  });
  
  // Battery
  await page.evaluateOnNewDocument(() => {
    if (navigator.getBattery) {
      navigator.getBattery = () => Promise.resolve({
        charging: true,
        level: 0.8 + Math.random() * 0.2
      });
    }
  });
}

// ========================================
// 人間行動シミュレーション
// ========================================

function rnd(min, max) {
  return Math.floor(min + Math.random() * (max - min));
}

async function moveMouse(page, x, y) {
  const cur = await page.evaluate(() => ({
    x: window._mx || 500,
    y: window._my || 500
  }));
  
  const steps = CFG.mouseSteps;
  const dur = rnd(1000, 3000);
  
  const cp1x = cur.x + (x - cur.x) * 0.25 + rnd(-100, 100);
  const cp1y = cur.y + (y - cur.y) * 0.25 + rnd(-100, 100);
  const cp2x = cur.x + (x - cur.x) * 0.75 + rnd(-100, 100);
  const cp2y = cur.y + (y - cur.y) * 0.75 + rnd(-100, 100);
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ease = t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2;
    
    const mt = 1 - ease;
    const mx = mt*mt*mt*cur.x + 3*mt*mt*ease*cp1x + 3*mt*ease*ease*cp2x + ease*ease*ease*x;
    const my = mt*mt*mt*cur.y + 3*mt*mt*ease*cp1y + 3*mt*ease*ease*cp2y + ease*ease*ease*y;
    
    await page.mouse.move(mx + rnd(-2, 2), my + rnd(-2, 2));
    await page.waitForTimeout(dur / steps);
  }
  
  await page.evaluate((mx, my) => { window._mx = mx; window._my = my; }, x, y);
}

async function scroll(page) {
  for (let i = 0; i < CFG.scrollPauses; i++) {
    const amt = rnd(200, 500);
    const steps = rnd(10, 30);
    
    for (let j = 0; j < steps; j++) {
      await page.evaluate((s) => window.scrollBy(0, s), amt/steps);
      await page.waitForTimeout(rnd(10, 30));
    }
    
    await page.waitForTimeout(rnd(500, 2000));
  }
}

async function simulate(page) {
  console.log('  🎭 Simulating human...');
  
  await page.waitForTimeout(rnd(1000, 3000));
  
  // マウス移動
  for (let i = 0; i < 8; i++) {
    await moveMouse(page, rnd(100, 1800), rnd(100, 1000));
    await page.waitForTimeout(rnd(200, 800));
  }
  
  // スクロール
  await scroll(page);
  
  // ランダムクリック
  for (let i = 0; i < CFG.randomClicks; i++) {
    await moveMouse(page, rnd(100, 1800), rnd(100, 1000));
    await page.waitForTimeout(rnd(300, 600));
  }
  
  // 読み込み時間
  await page.waitForTimeout(rnd(3000, 8000));
  
  console.log('  ✅ Human behavior done');
}

// ========================================
// メインエンドポイント
// ========================================

app.get('/test/:url', async (req, res) => {
  const start = performance.now();
  let obj = null;
  let page = null;
  
  try {
    pool.stats.req++;
    
    const url = Buffer.from(req.params.url, 'base64').toString();
    console.log(`\n🔥 [${pool.stats.req}] Testing: ${url}`);
    
    obj = await pool.get();
    const { b, p, key } = obj;
    
    console.log(`  🖥️  Profile: ${key}`);
    
    page = await b.newPage();
    await page.setUserAgent(p.ua);
    
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ja,en-US;q=0.9',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1'
    });
    
    await inject(page, p);
    
    console.log('  📄 Loading...');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: CFG.timeout });
    
    await simulate(page);
    
    const html = await page.content();
    const detected = html.toLowerCase().includes('bot') || html.toLowerCase().includes('captcha');
    
    const dur = performance.now() - start;
    
    if (!detected) {
      pool.stats.ok++;
      console.log(`  ✅ SUCCESS (${dur.toFixed(0)}ms)`);
    } else {
      pool.stats.fail++;
      console.log(`  ⚠️  DETECTED (${dur.toFixed(0)}ms)`);
    }
    
    res.setHeader('X-Duration', dur.toFixed(0));
    res.setHeader('X-Detected', detected);
    res.send(html);
    
  } catch (e) {
    pool.stats.fail++;
    console.error(`  ❌ ERROR:`, e.message);
    res.status(500).json({ error: e.message });
  } finally {
    if (page) await page.close();
    if (obj) pool.put(obj);
  }
});

// ========================================
// 統計
// ========================================

app.get('/stats', (req, res) => {
  const rate = pool.stats.req > 0 ? (pool.stats.ok / pool.stats.req * 100).toFixed(1) : 0;
  res.json({
    total: pool.stats.req,
    success: pool.stats.ok,
    fail: pool.stats.fail,
    successRate: rate + '%'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'GODMODE',
    version: '10.0',
    features: [
      'Puppeteer Stealth',
      'Multi-Profile',
      'Canvas/WebGL/Audio Spoofing',
      'Bezier Mouse Movement',
      'Human Behavior Simulation',
      'Battery/Permission Fake'
    ]
  });
});

// ========================================
// クリーンアップ
// ========================================

process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await pool.cleanup();
  process.exit(0);
});

// ========================================
// 起動
// ========================================

const PORT = process.env.PORT || 10000;

app.listen(PORT, async () => {
  console.log('\n🔥🔥🔥 GODMODE PROXY v10.0 🔥🔥🔥');
  console.log(`Port: ${PORT}`);
  console.log('\nFeatures:');
  console.log('  ✓ Stealth Plugin');
  console.log('  ✓ Multi-Profile (Win/Mac)');
  console.log('  ✓ Canvas/WebGL/Audio Spoofing');
  console.log('  ✓ Bezier Curve Mouse');
  console.log('  ✓ Human Scrolling');
  console.log('  ✓ Random Behavior');
  console.log('\n⚠️  FOR YOUR OWN SITES ONLY!\n');
  
  await pool.init();
});

module.exports = app;
