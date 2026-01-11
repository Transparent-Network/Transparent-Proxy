// ================================
// Transparent Proxy v3.1.0 ULTIMATE
// 超究極完全版 - 全エラー撲滅
// ================================

const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

const app = express();

// ================================
// 設定
// ================================
const CONFIG = {
  port: process.env.PORT || 3000,
  prefix: '/service/',
};

// ================================
// 静的ファイル
// ================================
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// ================================
// UV方式エンコーディング
// ================================
function encodeUrl(url) {
  const xorKey = 2;
  const encoded = Buffer.from(url).map(b => b ^ xorKey);
  return encoded.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function decodeUrl(encoded) {
  const padded = encoded
    .replace(/-/g, '+')
    .replace(/_/g, '/') + '==';
  const xorKey = 2;
  const decoded = Buffer.from(padded, 'base64').map(b => b ^ xorKey);
  return decoded.toString('utf8');
}

// ================================
// URLリライター
// ================================
function rewriteUrl(url, baseUrl) {
  try {
    if (url.startsWith(CONFIG.prefix)) return url;
    if (url.startsWith('javascript:') || url.startsWith('data:') || 
        url.startsWith('blob:') || url.startsWith('#')) {
      return url;
    }
    
    let fullUrl;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      fullUrl = url;
    } else if (url.startsWith('//')) {
      fullUrl = 'https:' + url;
    } else if (url.startsWith('/')) {
      fullUrl = baseUrl + url;
    } else {
      fullUrl = new URL(url, baseUrl).href;
    }
    return CONFIG.prefix + encodeUrl(fullUrl);
  } catch (e) {
    return url;
  }
}

// ================================
// HTMLリライター（完全版）
// ================================
function rewriteHtml(html, targetUrl) {
  const baseUrl = new URL(targetUrl).origin;
  
  // 1. すべてのURL属性
  const urlAttrs = ['href', 'src', 'action', 'data', 'poster', 'background'];
  urlAttrs.forEach(attr => {
    const regex = new RegExp(`${attr}=["']([^"']+)["']`, 'gi');
    html = html.replace(regex, (match, url) => {
      if (url.startsWith('javascript:') || url.startsWith('data:') || 
          url.startsWith('blob:') || url.startsWith('#') || url.startsWith(CONFIG.prefix)) {
        return match;
      }
      return `${attr}="${rewriteUrl(url, baseUrl)}"`;
    });
  });
  
  // 2. srcset
  html = html.replace(/srcset=["']([^"']+)["']/gi, (match, srcset) => {
    const rewritten = srcset.split(',').map(item => {
      const parts = item.trim().split(/\s+/);
      return `${rewriteUrl(parts[0], baseUrl)} ${parts[1] || ''}`.trim();
    }).join(', ');
    return `srcset="${rewritten}"`;
  });
  
  // 3. <base>削除
  html = html.replace(/<base[^>]*>/gi, '');
  
  // 4. CSP/X-Frame-Options削除
  html = html.replace(/<meta[^>]*http-equiv=["'](Content-Security-Policy|X-Frame-Options)["'][^>]*>/gi, '');
  
  // 5. 超究極JavaScriptインジェクション
  const script = `
<script data-proxy-inject>
(function() {
  'use strict';
  
  if (window.__PROXY_INIT__) return;
  window.__PROXY_INIT__ = true;
  
  const PREFIX = '${CONFIG.prefix}';
  const BASE = '${baseUrl}';
  
  // XORエンコード関数
  function enc(s) {
    const x = 2;
    const buf = [];
    for (let i = 0; i < s.length; i++) {
      buf.push(String.fromCharCode(s.charCodeAt(i) ^ x));
    }
    return btoa(buf.join('')).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=/g, '');
  }
  
  // URL正規化
  function norm(u) {
    if (!u || typeof u !== 'string') return u;
    if (u.startsWith('javascript:') || u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('#')) return u;
    if (u.startsWith(PREFIX)) return u;
    
    try {
      let full;
      if (u.startsWith('http://') || u.startsWith('https://')) {
        full = u;
      } else if (u.startsWith('//')) {
        full = 'https:' + u;
      } else if (u.startsWith('/')) {
        full = BASE + u;
      } else {
        full = new URL(u, BASE).href;
      }
      return PREFIX + enc(full);
    } catch (e) {
      return u;
    }
  }
  
  // ServiceWorker完全無効化
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(r => r.forEach(x => x.unregister()));
    Object.defineProperty(navigator, 'serviceWorker', {
      get: () => undefined,
      configurable: true
    });
  }
  
  // fetch
  const _fetch = window.fetch;
  window.fetch = function(u, o) {
    return _fetch.call(this, norm(u), o);
  };
  
  // XMLHttpRequest
  const _XHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function() {
    const x = new _XHR();
    const _open = x.open;
    x.open = function(m, u, ...a) {
      return _open.call(this, m, norm(u), ...a);
    };
    return x;
  };
  
  // window.open
  const _open = window.open;
  window.open = function(u, ...a) {
    return _open.call(this, u ? norm(u) : u, ...a);
  };
  
  // location.href
  const _locSetter = Object.getOwnPropertyDescriptor(Location.prototype, 'href').set;
  Object.defineProperty(Location.prototype, 'href', {
    set: function(u) {
      return _locSetter.call(this, norm(u));
    },
    get: Object.getOwnPropertyDescriptor(Location.prototype, 'href').get
  });
  
  // history API
  const _push = history.pushState;
  const _replace = history.replaceState;
  
  history.pushState = function(s, t, u) {
    return _push.call(this, s, t, u ? norm(u) : u);
  };
  
  history.replaceState = function(s, t, u) {
    return _replace.call(this, s, t, u ? norm(u) : u);
  };
  
  // Document.write/writeln
  const _write = document.write;
  const _writeln = document.writeln;
  
  document.write = function(h) {
    return _write.call(this, h);
  };
  
  document.writeln = function(h) {
    return _writeln.call(this, h);
  };
  
  // webdriver無効化
  Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined
  });
  
  // Bot検出対策
  try {
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        {name: 'Chrome PDF Plugin'},
        {name: 'Chrome PDF Viewer'},
        {name: 'Native Client'}
      ]
    });
  } catch (e) {}
  
  // Chrome object
  if (!window.chrome) {
    window.chrome = {
      runtime: {},
      loadTimes: () => {},
      csi: () => {},
      app: {}
    };
  }
})();
</script>
`;
  
  // <head>の最初に注入（最優先で実行）
  if (html.includes('<head>')) {
    html = html.replace(/<head>/i, '<head>' + script);
  } else {
    html = script + html;
  }
  
  return html;
}

// ================================
// CSSリライター
// ================================
function rewriteCss(css, targetUrl) {
  const baseUrl = new URL(targetUrl).origin;
  
  css = css.replace(/url\(["']?([^)"']+)["']?\)/gi, (m, u) => {
    if (u.startsWith('data:') || u.startsWith('#')) return m;
    return `url("${rewriteUrl(u, baseUrl)}")`;
  });
  
  css = css.replace(/@import\s+["']([^"']+)["']/gi, (m, u) => {
    return `@import "${rewriteUrl(u, baseUrl)}"`;
  });
  
  return css;
}

// ================================
// プロキシエンドポイント
// ================================
app.use(CONFIG.prefix, async (req, res) => {
  try {
    const encodedUrl = req.url.substring(1);
    
    if (!encodedUrl) {
      return res.status(400).send('Bad Request');
    }
    
    let targetUrl;
    try {
      targetUrl = decodeUrl(encodedUrl.split('?')[0]);
    } catch (e) {
      return res.status(400).send('Invalid URL');
    }
    
    console.log('→', targetUrl);
    
    // 完全なブラウザヘッダー
    const headers = {
      'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': req.headers['accept'] || 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': req.headers['accept-language'] || 'en-US,en;q=0.9',
      'Accept-Encoding': req.headers['accept-encoding'] || 'gzip, deflate, br',
      'Referer': targetUrl,
      'Origin': new URL(targetUrl).origin,
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    };
    
    // Sec-* ヘッダー（Chrome模倣）
    if (req.headers['sec-ch-ua']) headers['Sec-Ch-Ua'] = req.headers['sec-ch-ua'];
    if (req.headers['sec-ch-ua-mobile']) headers['Sec-Ch-Ua-Mobile'] = req.headers['sec-ch-ua-mobile'];
    if (req.headers['sec-ch-ua-platform']) headers['Sec-Ch-Ua-Platform'] = req.headers['sec-ch-ua-platform'];
    if (req.headers['sec-fetch-dest']) headers['Sec-Fetch-Dest'] = req.headers['sec-fetch-dest'];
    if (req.headers['sec-fetch-mode']) headers['Sec-Fetch-Mode'] = req.headers['sec-fetch-mode'];
    if (req.headers['sec-fetch-site']) headers['Sec-Fetch-Site'] = req.headers['sec-fetch-site'];
    
    // YouTube特化Cookie
    const parsedUrl = new URL(targetUrl);
    if (parsedUrl.hostname.includes('youtube.com') || parsedUrl.hostname.includes('youtu.be')) {
      headers['Cookie'] = 'CONSENT=PENDING+987; SOCS=CAESHAgBEhJnd3NfMjAyNDAxMTAtMF9SQzIaAmVuIAEaBgiAo--mBg';
    }
    
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      redirect: 'follow'
    });
    
    const contentType = response.headers.get('content-type') || '';
    
    // ブロックヘッダーリスト
    const blocked = [
      'content-security-policy',
      'content-security-policy-report-only',
      'x-frame-options',
      'cross-origin-embedder-policy',
      'cross-origin-resource-policy',
      'cross-origin-opener-policy',
      'content-encoding',
      'transfer-encoding'
    ];
    
    response.headers.forEach((v, k) => {
      if (!blocked.includes(k.toLowerCase())) {
        res.setHeader(k, v);
      }
    });
    
    // CORS完全許可
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    
    // HTML
    if (contentType.includes('text/html')) {
      let html = await response.text();
      html = rewriteHtml(html, targetUrl);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }
    
    // CSS
    if (contentType.includes('text/css')) {
      let css = await response.text();
      css = rewriteCss(css, targetUrl);
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      return res.send(css);
    }
    
    // JS/JSON
    if (contentType.includes('javascript') || contentType.includes('json')) {
      const text = await response.text();
      return res.send(text);
    }
    
    // Binary
    const buffer = await response.buffer();
    res.send(buffer);
    
  } catch (error) {
    console.error('✗', error.message);
    res.status(500).send('Error');
  }
});

// ================================
// Health
// ================================
app.get('/health', (req, res) => {
  res.json({ status: 'ok', v: '3.1.0' });
});

// ================================
// SPA
// ================================
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// ================================
// Start
// ================================
app.listen(CONFIG.port, '0.0.0.0', () => {
  console.log(`\n🚀 Transparent Proxy v3.1.0 ULTIMATE`);
  console.log(`✅ http://0.0.0.0:${CONFIG.port}\n`);
});

module.exports = app;
