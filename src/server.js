// ================================
// Transparent Proxy v2.4.0 FINAL
// 完璧超マックス版
// ================================

const express = require('express');
const fetch = require('node-fetch');
const compression = require('compression');
const path = require('path');
const fs = require('fs');

// ================================
// 設定
// ================================
const CONFIG = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'production',
  timeout: 30000,
  maxRedirects: 10
};

const app = express();

// ================================
// ミドルウェア
// ================================

// 1. CORS完全許可
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// 2. 圧縮
app.use(compression({
  threshold: 0,
  level: 6
}));

// 3. セキュリティヘッダー削除
app.use((req, res, next) => {
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  next();
});

// 4. ログ
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// 5. Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ================================
// 静的ファイル
// ================================
const publicDir = path.join(__dirname, '..', 'public');
const indexPath = path.join(publicDir, 'index.html');

console.log('\n📁 ディレクトリ確認:');
console.log(`   ROOT: ${__dirname}`);
console.log(`   PUBLIC: ${publicDir}`);
console.log(`   INDEX: ${indexPath}`);

if (fs.existsSync(indexPath)) {
  console.log('   ✅ index.html 存在');
} else {
  console.error('   ❌ index.html が見つかりません');
}

app.use(express.static(publicDir, {
  maxAge: '1d',
  etag: true,
  lastModified: true
}));

// ================================
// ヘルパー関数
// ================================

// 制限ヘッダーリスト
const BLOCKED_HEADERS = [
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
  'cross-origin-embedder-policy',
  'cross-origin-resource-policy',
  'cross-origin-opener-policy',
  'x-content-type-options',
  'strict-transport-security',
  'expect-ct',
  'permissions-policy',
  'feature-policy',
  'referrer-policy',
  'content-encoding',
  'transfer-encoding'
];

// URLバリデーション
function validateUrl(url) {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

// HTML書き換え（完全版 v2）
function rewriteHtml(html, targetUrl) {
  try {
    const parsedUrl = new URL(targetUrl);
    const baseUrl = parsedUrl.origin;
    const basePath = parsedUrl.pathname.substring(0, parsedUrl.pathname.lastIndexOf('/') + 1);
    const proxyBase = '/proxy/';
    
    // 1. <base>タグで基本パスを設定
    const baseTag = `<base href="${baseUrl}${basePath}">`;
    
    if (html.includes('<head>')) {
      html = html.replace(/<head>/i, `<head>${baseTag}`);
    } else if (html.includes('<html>')) {
      html = html.replace(/<html>/i, `<html><head>${baseTag}</head>`);
    } else {
      html = `<!DOCTYPE html><html><head>${baseTag}</head><body>${html}</body></html>`;
    }
    
    // 2. ナビゲーションリンク（<a>タグ）のみプロキシ経由に書き換え
    html = html.replace(/<a\s+([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi, (match, before, href, after) => {
      if (href.startsWith('javascript:') || href.startsWith('mailto:') || 
          href.startsWith('tel:') || href.startsWith('#')) {
        return match;
      }
      
      if (href.startsWith('/proxy/')) {
        return match;
      }
      
      let fullUrl;
      try {
        if (href.startsWith('http://') || href.startsWith('https://')) {
          fullUrl = href;
        } else if (href.startsWith('//')) {
          fullUrl = parsedUrl.protocol + href;
        } else if (href.startsWith('/')) {
          fullUrl = baseUrl + href;
        } else {
          fullUrl = new URL(href, targetUrl).href;
        }
        
        const encoded = Buffer.from(fullUrl).toString('base64');
        return `<a ${before}href="${proxyBase}${encoded}"${after}>`;
      } catch (e) {
        return match;
      }
    });
    
    // 3. <form>のactionもプロキシ経由に
    html = html.replace(/<form\s+([^>]*?)action=["']([^"']+)["']([^>]*?)>/gi, (match, before, action, after) => {
      if (action.startsWith('javascript:') || action.startsWith('#')) {
        return match;
      }
      
      let fullUrl;
      try {
        if (action.startsWith('http://') || action.startsWith('https://')) {
          fullUrl = action;
        } else if (action.startsWith('/')) {
          fullUrl = baseUrl + action;
        } else {
          fullUrl = new URL(action, targetUrl).href;
        }
        
        const encoded = Buffer.from(fullUrl).toString('base64');
        return `<form ${before}action="${proxyBase}${encoded}"${after}>`;
      } catch (e) {
        return match;
      }
    });
    
    // 4. 制限メタタグ削除
    html = html.replace(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');
    html = html.replace(/<meta[^>]*http-equiv=["']X-Frame-Options["'][^>]*>/gi, '');
    html = html.replace(/<meta[^>]*name=["']referrer["'][^>]*>/gi, '');
    html = html.replace(/<meta[^>]*property=["']csp-nonce["'][^>]*>/gi, '');
    
    // 5. 必須メタタグ追加
    const metaTags = `<meta name="referrer" content="no-referrer">`;
    html = html.replace(/<\/head>/i, `${metaTags}</head>`);
    
    // 6. JavaScriptでのナビゲーション対策
    const proxyScript = `
    <script>
    (function() {
      if (window.top === window.self) return;
      
      const proxyBase = '${proxyBase}';
      const originalOpen = window.open;
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      
      window.open = function(url, target, features) {
        if (url && !url.startsWith('javascript:') && !url.startsWith('about:') && !url.startsWith('data:')) {
          try {
            const fullUrl = new URL(url, window.location.href).href;
            const encoded = btoa(unescape(encodeURIComponent(fullUrl)));
            return originalOpen.call(this, proxyBase + encoded, target, features);
          } catch (e) {}
        }
        return originalOpen.call(this, url, target, features);
      };
      
      history.pushState = function(state, title, url) {
        if (url && !url.startsWith(proxyBase)) {
          try {
            const fullUrl = new URL(url, window.location.href).href;
            const encoded = btoa(unescape(encodeURIComponent(fullUrl)));
            return originalPushState.call(this, state, title, proxyBase + encoded);
          } catch (e) {}
        }
        return originalPushState.call(this, state, title, url);
      };
      
      history.replaceState = function(state, title, url) {
        if (url && !url.startsWith(proxyBase)) {
          try {
            const fullUrl = new URL(url, window.location.href).href;
            const encoded = btoa(unescape(encodeURIComponent(fullUrl)));
            return originalReplaceState.call(this, state, title, proxyBase + encoded);
          } catch (e) {}
        }
        return originalReplaceState.call(this, state, title, url);
      };
    })();
    </script>
    `;
    html = html.replace(/<\/body>/i, `${proxyScript}</body>`);
    
    return html;
  } catch (error) {
    console.error('❌ HTML書き換えエラー:', error.message);
    return html;
  }
}

// CSS書き換え
function rewriteCss(css, targetUrl) {
  try {
    const parsedUrl = new URL(targetUrl);
    const baseUrl = parsedUrl.origin;
    const proxyBase = '/proxy/';
    
    css = css.replace(/url\(["']?(?!http|\/\/|data:|#)([^)"']+)["']?\)/gi, (match, path) => {
      let fullUrl;
      if (path.startsWith('/')) {
        fullUrl = baseUrl + path;
      } else {
        fullUrl = new URL(path, targetUrl).href;
      }
      const encoded = Buffer.from(fullUrl).toString('base64');
      return `url("${proxyBase}${encoded}")`;
    });
    
    css = css.replace(/url\(["']?(https?:\/\/[^)"']+)["']?\)/gi, (match, url) => {
      const encoded = Buffer.from(url).toString('base64');
      return `url("${proxyBase}${encoded}")`;
    });
    
    return css;
  } catch (error) {
    console.error('❌ CSS書き換えエラー:', error.message);
    return css;
  }
}

// ================================
// プロキシエンドポイント
// ================================
app.all('/proxy/:url(*)', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const base64Url = req.params.url;
    console.log('\n🌐 プロキシリクエスト:', base64Url.substring(0, 50) + '...');
    
    let targetUrl;
    try {
      targetUrl = decodeURIComponent(escape(Buffer.from(base64Url, 'base64').toString('binary')));
      console.log('📍 ターゲットURL:', targetUrl);
    } catch (error) {
      console.error('❌ デコードエラー:', error.message);
      return res.status(400).json({ error: 'Invalid URL encoding' });
    }
    
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }
    
    if (!validateUrl(targetUrl)) {
      console.error('❌ 無効なURL:', targetUrl);
      return res.status(400).json({ error: 'Invalid URL' });
    }
    
    console.log('⏳ フェッチ中...');
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': req.headers['accept'] || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        'Connection': 'keep-alive',
        'Cache-Control': 'max-age=0'
      },
      redirect: 'follow',
      timeout: CONFIG.timeout
    });
    
    const duration = Date.now() - startTime;
    console.log(`✅ レスポンス: ${response.status} (${duration}ms)`);
    
    const contentType = response.headers.get('content-type') || '';
    console.log('📄 Content-Type:', contentType);
    
    const headers = {};
    response.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (!BLOCKED_HEADERS.includes(lower)) {
        headers[key] = value;
      }
    });
    
    headers['Access-Control-Allow-Origin'] = '*';
    headers['Access-Control-Allow-Methods'] = '*';
    headers['Access-Control-Allow-Headers'] = '*';
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers['Access-Control-Expose-Headers'] = '*';
    
    delete headers['X-Frame-Options'];
    delete headers['Content-Security-Policy'];
    delete headers['Content-Security-Policy-Report-Only'];
    
    headers['X-Frame-Options'] = 'ALLOWALL';
    headers['Content-Security-Policy'] = "frame-ancestors *; default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;";
    
    if (contentType.includes('text/html')) {
      let html = await response.text();
      html = rewriteHtml(html, targetUrl);
      
      console.log('📝 HTML処理完了');
      Object.keys(headers).forEach(key => res.setHeader(key, headers[key]));
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }
    
    if (contentType.includes('text/css')) {
      let css = await response.text();
      css = rewriteCss(css, targetUrl);
      
      console.log('🎨 CSS処理完了');
      Object.keys(headers).forEach(key => res.setHeader(key, headers[key]));
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      return res.send(css);
    }
    
    if (contentType.includes('javascript') || contentType.includes('json')) {
      const text = await response.text();
      
      console.log('⚡ JS/JSON処理完了');
      Object.keys(headers).forEach(key => res.setHeader(key, headers[key]));
      return res.send(text);
    }
    
    const buffer = await response.buffer();
    console.log(`📦 バイナリ処理完了 (${buffer.length} bytes)`);
    Object.keys(headers).forEach(key => res.setHeader(key, headers[key]));
    res.send(buffer);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ プロキシエラー (${duration}ms):`, error.message);
    
    if (error.code === 'ENOTFOUND') {
      return res.status(404).json({
        error: 'DNS Resolution Failed',
        message: 'サイトが見つかりません'
      });
    }
    
    if (error.code === 'ETIMEDOUT' || error.type === 'request-timeout') {
      return res.status(504).json({
        error: 'Gateway Timeout',
        message: 'タイムアウトしました'
      });
    }
    
    res.status(500).json({
      error: 'Proxy Error',
      message: 'プロキシエラーが発生しました',
      details: error.message
    });
  }
});

// ================================
// APIエンドポイント
// ================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '2.4.0',
    uptime: Math.floor(process.uptime())
  });
});

app.get('/api/config', (req, res) => {
  res.json({
    version: '2.4.0',
    name: 'Transparent Proxy',
    features: ['HTML Rewriting', 'CORS Bypass', 'CSP Bypass'],
    status: 'operational'
  });
});

// ================================
// SPA対応
// ================================
app.get('*', (req, res) => {
  res.sendFile(indexPath);
});

// ================================
// エラーハンドリング
// ================================
app.use((err, req, res, next) => {
  console.error('❌ サーバーエラー:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// ================================
// サーバー起動
// ================================
const server = app.listen(CONFIG.port, '0.0.0.0', () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 Transparent Proxy v2.4.0 FINAL');
  console.log('='.repeat(60));
  console.log(`\n✅ サーバー起動: http://0.0.0.0:${CONFIG.port}`);
  console.log(`✅ 環境: ${CONFIG.env}\n`);
  console.log('⚡ 準備完了！\n');
});

process.on('SIGTERM', () => {
  console.log('\n⚠️ SIGTERM受信');
  server.close(() => {
    console.log('✅ サーバー停止');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n⚠️ SIGINT受信');
  server.close(() => {
    console.log('✅ サーバー停止');
    process.exit(0);
  });
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
});

module.exports = app;
