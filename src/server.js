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

// HTML書き換え（Utopia/Wakame方式 - 完全版）
function rewriteHtml(html, targetUrl) {
  try {
    const parsedUrl = new URL(targetUrl);
    const baseUrl = parsedUrl.origin;
    const proxyBase = '/proxy/';
    
    // 1. すべてのリンク（href）をプロキシ経由に
    html = html.replace(/(href)=["']([^"']+)["']/gi, (match, attr, url) => {
      // 特殊URLはスキップ
      if (url.startsWith('javascript:') || url.startsWith('mailto:') || 
          url.startsWith('tel:') || url.startsWith('#') || url.startsWith('data:')) {
        return match;
      }
      
      // すでにプロキシURLならスキップ
      if (url.startsWith('/proxy/')) {
        return match;
      }
      
      try {
        let fullUrl;
        if (url.startsWith('http://') || url.startsWith('https://')) {
          fullUrl = url;
        } else if (url.startsWith('//')) {
          fullUrl = parsedUrl.protocol + url;
        } else if (url.startsWith('/')) {
          fullUrl = baseUrl + url;
        } else {
          fullUrl = new URL(url, targetUrl).href;
        }
        
        const encoded = Buffer.from(fullUrl).toString('base64');
        return `${attr}="${proxyBase}${encoded}"`;
      } catch (e) {
        return match;
      }
    });
    
    // 2. すべてのリソース（src）もプロキシ経由に
    html = html.replace(/(src)=["']([^"']+)["']/gi, (match, attr, url) => {
      // 特殊URLはスキップ
      if (url.startsWith('javascript:') || url.startsWith('data:') || url.startsWith('blob:')) {
        return match;
      }
      
      // すでにプロキシURLならスキップ
      if (url.startsWith('/proxy/')) {
        return match;
      }
      
      try {
        let fullUrl;
        if (url.startsWith('http://') || url.startsWith('https://')) {
          fullUrl = url;
        } else if (url.startsWith('//')) {
          fullUrl = parsedUrl.protocol + url;
        } else if (url.startsWith('/')) {
          fullUrl = baseUrl + url;
        } else {
          fullUrl = new URL(url, targetUrl).href;
        }
        
        const encoded = Buffer.from(fullUrl).toString('base64');
        return `${attr}="${proxyBase}${encoded}"`;
      } catch (e) {
        return match;
      }
    });
    
    // 3. srcset属性も書き換え（レスポンシブ画像対応）
    html = html.replace(/srcset=["']([^"']+)["']/gi, (match, srcset) => {
      const rewritten = srcset.split(',').map(item => {
        const parts = item.trim().split(/\s+/);
        const url = parts[0];
        
        if (url.startsWith('http://') || url.startsWith('https://')) {
          const encoded = Buffer.from(url).toString('base64');
          parts[0] = `${proxyBase}${encoded}`;
        } else if (url.startsWith('/')) {
          const fullUrl = baseUrl + url;
          const encoded = Buffer.from(fullUrl).toString('base64');
          parts[0] = `${proxyBase}${encoded}`;
        }
        
        return parts.join(' ');
      }).join(', ');
      
      return `srcset="${rewritten}"`;
    });
    
    // 4. <form>のaction
    html = html.replace(/<form([^>]*?)action=["']([^"']+)["']/gi, (match, before, action) => {
      if (action.startsWith('javascript:') || action.startsWith('#')) {
        return match;
      }
      
      try {
        let fullUrl;
        if (action.startsWith('http://') || action.startsWith('https://')) {
          fullUrl = action;
        } else if (action.startsWith('/')) {
          fullUrl = baseUrl + action;
        } else {
          fullUrl = new URL(action, targetUrl).href;
        }
        
        const encoded = Buffer.from(fullUrl).toString('base64');
        return `<form${before}action="${proxyBase}${encoded}"`;
      } catch (e) {
        return match;
      }
    });
    
    // 5. <base>タグを削除（プロキシの邪魔になる）
    html = html.replace(/<base[^>]*>/gi, '');
    
    // 6. 制限メタタグ削除
    html = html.replace(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');
    html = html.replace(/<meta[^>]*http-equiv=["']X-Frame-Options["'][^>]*>/gi, '');
    html = html.replace(/<meta[^>]*name=["']referrer["'][^>]*>/gi, '');
    
    // 7. 必須メタタグ追加
    const metaTags = `
      <meta name="referrer" content="no-referrer">
      <meta charset="UTF-8">
    `;
    
    if (html.includes('<head>')) {
      html = html.replace(/<head>/i, `<head>${metaTags}`);
    } else {
      html = `<!DOCTYPE html><html><head>${metaTags}</head><body>${html}</body></html>`;
    }
    
    // 8. JavaScriptインジェクション（Utopia方式）
    const proxyScript = `
    <script>
    (function() {
      if (window.__PROXY_INJECTED__) return;
      window.__PROXY_INJECTED__ = true;
      
      const proxyBase = '${proxyBase}';
      const baseUrl = '${baseUrl}';
      
      // fetch() をフック
      const originalFetch = window.fetch;
      window.fetch = function(url, options) {
        if (typeof url === 'string' && !url.startsWith('data:') && !url.startsWith('blob:')) {
          try {
            let fullUrl;
            if (url.startsWith('http://') || url.startsWith('https://')) {
              fullUrl = url;
            } else if (url.startsWith('//')) {
              fullUrl = location.protocol + url;
            } else if (url.startsWith('/')) {
              fullUrl = baseUrl + url;
            } else {
              fullUrl = new URL(url, baseUrl).href;
            }
            const encoded = btoa(unescape(encodeURIComponent(fullUrl)));
            url = proxyBase + encoded;
          } catch (e) {}
        }
        return originalFetch.call(this, url, options);
      };
      
      // XMLHttpRequest をフック
      const OriginalXHR = window.XMLHttpRequest;
      window.XMLHttpRequest = function() {
        const xhr = new OriginalXHR();
        const originalOpen = xhr.open;
        
        xhr.open = function(method, url, ...args) {
          if (typeof url === 'string' && !url.startsWith('data:') && !url.startsWith('blob:')) {
            try {
              let fullUrl;
              if (url.startsWith('http://') || url.startsWith('https://')) {
                fullUrl = url;
              } else if (url.startsWith('//')) {
                fullUrl = location.protocol + url;
              } else if (url.startsWith('/')) {
                fullUrl = baseUrl + url;
              } else {
                fullUrl = new URL(url, baseUrl).href;
              }
              const encoded = btoa(unescape(encodeURIComponent(fullUrl)));
              url = proxyBase + encoded;
            } catch (e) {}
          }
          return originalOpen.call(this, method, url, ...args);
        };
        
        return xhr;
      };
      
      // window.open をフック
      const originalOpen = window.open;
      window.open = function(url, target, features) {
        if (url && typeof url === 'string' && !url.startsWith('javascript:') && !url.startsWith('about:') && !url.startsWith('data:')) {
          try {
            let fullUrl;
            if (url.startsWith('http://') || url.startsWith('https://')) {
              fullUrl = url;
            } else if (url.startsWith('//')) {
              fullUrl = location.protocol + url;
            } else if (url.startsWith('/')) {
              fullUrl = baseUrl + url;
            } else {
              fullUrl = new URL(url, baseUrl).href;
            }
            const encoded = btoa(unescape(encodeURIComponent(fullUrl)));
            url = proxyBase + encoded;
          } catch (e) {}
        }
        return originalOpen.call(this, url, target, features);
      };
      
      // location.href セッター をフック
      const originalLocationSetter = Object.getOwnPropertyDescriptor(Location.prototype, 'href').set;
      Object.defineProperty(Location.prototype, 'href', {
        set: function(url) {
          if (url && typeof url === 'string' && !url.startsWith('javascript:') && !url.startsWith('about:')) {
            try {
              let fullUrl;
              if (url.startsWith('http://') || url.startsWith('https://')) {
                fullUrl = url;
              } else if (url.startsWith('//')) {
                fullUrl = location.protocol + url;
              } else if (url.startsWith('/')) {
                fullUrl = baseUrl + url;
              } else {
                fullUrl = new URL(url, baseUrl).href;
              }
              const encoded = btoa(unescape(encodeURIComponent(fullUrl)));
              url = proxyBase + encoded;
            } catch (e) {}
          }
          return originalLocationSetter.call(this, url);
        },
        get: function() {
          return Object.getOwnPropertyDescriptor(Location.prototype, 'href').get.call(this);
        }
      });
      
      // history API をフック
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      
      history.pushState = function(state, title, url) {
        if (url && typeof url === 'string' && !url.startsWith(proxyBase)) {
          try {
            let fullUrl;
            if (url.startsWith('http://') || url.startsWith('https://')) {
              fullUrl = url;
            } else if (url.startsWith('/')) {
              fullUrl = baseUrl + url;
            } else {
              fullUrl = new URL(url, baseUrl).href;
            }
            const encoded = btoa(unescape(encodeURIComponent(fullUrl)));
            url = proxyBase + encoded;
          } catch (e) {}
        }
        return originalPushState.call(this, state, title, url);
      };
      
      history.replaceState = function(state, title, url) {
        if (url && typeof url === 'string' && !url.startsWith(proxyBase)) {
          try {
            let fullUrl;
            if (url.startsWith('http://') || url.startsWith('https://')) {
              fullUrl = url;
            } else if (url.startsWith('/')) {
              fullUrl = baseUrl + url;
            } else {
              fullUrl = new URL(url, baseUrl).href;
            }
            const encoded = btoa(unescape(encodeURIComponent(fullUrl)));
            url = proxyBase + encoded;
          } catch (e) {}
        }
        return originalReplaceState.call(this, state, title, url);
      };
    })();
    </script>
    `;
    
    // <head>の最後に注入（できるだけ早く実行）
    html = html.replace(/<\/head>/i, `${proxyScript}</head>`);
    
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
