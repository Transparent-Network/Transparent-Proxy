// ================================
// Transparent Proxy v3.0.0 - UV Style
// ================================

const express = require('express');
const fetch = require('node-fetch');
const { createServer } = require('http');
const path = require('path');
const fs = require('fs');

const app = express();
const server = createServer();

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
  // Utopia/UV方式: XOR + Base64
  const xorKey = 2; // シンプルなXORキー
  const encoded = Buffer.from(url).map(b => b ^ xorKey);
  return encoded.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function decodeUrl(encoded) {
  // パディング復元
  const padded = encoded
    .replace(/-/g, '+')
    .replace(/_/g, '/') + '==';
  
  const xorKey = 2;
  const decoded = Buffer.from(padded, 'base64').map(b => b ^ xorKey);
  return decoded.toString('utf8');
}

// ================================
// URLリライター（Utopia方式）
// ================================
function rewriteUrl(url, baseUrl) {
  try {
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
  
  // 1. すべてのURL属性を書き換え
  const urlAttrs = ['href', 'src', 'action', 'data', 'poster', 'background'];
  
  urlAttrs.forEach(attr => {
    const regex = new RegExp(`${attr}=["']([^"']+)["']`, 'gi');
    html = html.replace(regex, (match, url) => {
      if (url.startsWith('javascript:') || url.startsWith('data:') || 
          url.startsWith('blob:') || url.startsWith('#')) {
        return match;
      }
      if (url.startsWith(CONFIG.prefix)) {
        return match;
      }
      return `${attr}="${rewriteUrl(url, baseUrl)}"`;
    });
  });
  
  // 2. srcset
  html = html.replace(/srcset=["']([^"']+)["']/gi, (match, srcset) => {
    const rewritten = srcset.split(',').map(item => {
      const parts = item.trim().split(/\s+/);
      const url = parts[0];
      const descriptor = parts[1] || '';
      return `${rewriteUrl(url, baseUrl)} ${descriptor}`.trim();
    }).join(', ');
    return `srcset="${rewritten}"`;
  });
  
  // 3. style属性内のurl()
  html = html.replace(/style=["']([^"']*url\([^"']*\)[^"']*)["']/gi, (match, style) => {
    const rewritten = style.replace(/url\(["']?([^)"']+)["']?\)/gi, (m, url) => {
      if (url.startsWith('data:')) return m;
      return `url("${rewriteUrl(url, baseUrl)}")`;
    });
    return `style="${rewritten}"`;
  });
  
  // 4. <base>タグ削除
  html = html.replace(/<base[^>]*>/gi, '');
  
  // 5. メタタグ削除
  html = html.replace(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');
  html = html.replace(/<meta[^>]*http-equiv=["']X-Frame-Options["'][^>]*>/gi, '');
  
  // 6. JavaScriptインジェクション（Utopia方式）
  const script = `
<script>
(function() {
  const PREFIX = '${CONFIG.prefix}';
  const encodeUrl = ${encodeUrl.toString()};
  const baseUrl = '${baseUrl}';
  
  // fetch
  const origFetch = window.fetch;
  window.fetch = function(url, opts) {
    if (typeof url === 'string' && !url.startsWith('data:') && !url.startsWith('blob:')) {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        if (url.startsWith('//')) {
          url = 'https:' + url;
        } else if (url.startsWith('/')) {
          url = baseUrl + url;
        } else {
          url = new URL(url, baseUrl).href;
        }
      }
      url = PREFIX + encodeUrl(url);
    }
    return origFetch.call(this, url, opts);
  };
  
  // XMLHttpRequest
  const OrigXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function() {
    const xhr = new OrigXHR();
    const origOpen = xhr.open;
    xhr.open = function(method, url, ...args) {
      if (typeof url === 'string' && !url.startsWith('data:') && !url.startsWith('blob:')) {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          if (url.startsWith('//')) {
            url = 'https:' + url;
          } else if (url.startsWith('/')) {
            url = baseUrl + url;
          } else {
            url = new URL(url, baseUrl).href;
          }
        }
        url = PREFIX + encodeUrl(url);
      }
      return origOpen.call(this, method, url, ...args);
    };
    return xhr;
  };
  
  // window.open
  const origOpen = window.open;
  window.open = function(url, ...args) {
    if (url && typeof url === 'string' && !url.startsWith('javascript:') && !url.startsWith('about:')) {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        if (url.startsWith('/')) {
          url = baseUrl + url;
        } else {
          url = new URL(url, baseUrl).href;
        }
      }
      url = PREFIX + encodeUrl(url);
    }
    return origOpen.call(this, url, ...args);
  };
  
  // location.href
  const origSetter = Object.getOwnPropertyDescriptor(Location.prototype, 'href').set;
  Object.defineProperty(Location.prototype, 'href', {
    set: function(url) {
      if (url && !url.startsWith('javascript:') && !url.startsWith('about:')) {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          if (url.startsWith('/')) {
            url = baseUrl + url;
          } else {
            url = new URL(url, baseUrl).href;
          }
        }
        url = PREFIX + encodeUrl(url);
      }
      return origSetter.call(this, url);
    }
  });
  
  // ServiceWorker無効化
  if ('serviceWorker' in navigator) {
    delete navigator.serviceWorker;
  }
})();
</script>
`;
  
  if (html.includes('</head>')) {
    html = html.replace('</head>', script + '</head>');
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
  
  // url()を書き換え
  css = css.replace(/url\(["']?([^)"']+)["']?\)/gi, (match, url) => {
    if (url.startsWith('data:') || url.startsWith('#')) {
      return match;
    }
    return `url("${rewriteUrl(url, baseUrl)}")`;
  });
  
  // @import
  css = css.replace(/@import\s+["']([^"']+)["']/gi, (match, url) => {
    return `@import "${rewriteUrl(url, baseUrl)}"`;
  });
  
  return css;
}

// ================================
// プロキシエンドポイント（UV方式）
// ================================
app.use(CONFIG.prefix, async (req, res) => {
  try {
    const encodedUrl = req.url.substring(1); // 先頭の/を削除
    
    if (!encodedUrl) {
      return res.status(400).send('Invalid URL');
    }
    
    let targetUrl;
    try {
      targetUrl = decodeUrl(encodedUrl.split('?')[0]);
    } catch (e) {
      console.error('Decode error:', e);
      return res.status(400).send('Invalid URL encoding');
    }
    
    console.log('🌐 Proxy:', targetUrl);
    
    // フェッチ
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': req.headers['accept'] || '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': targetUrl,
        'Origin': new URL(targetUrl).origin
      },
      redirect: 'follow'
    });
    
    const contentType = response.headers.get('content-type') || '';
    
    // ヘッダー処理
    const blockedHeaders = [
      'content-security-policy',
      'content-security-policy-report-only',
      'x-frame-options',
      'cross-origin-embedder-policy',
      'cross-origin-resource-policy',
      'cross-origin-opener-policy',
      'content-encoding',
      'transfer-encoding'
    ];
    
    response.headers.forEach((value, key) => {
      if (!blockedHeaders.includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });
    
    // CORS許可
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
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
    
    // JavaScript/JSON
    if (contentType.includes('javascript') || contentType.includes('json')) {
      const text = await response.text();
      return res.send(text);
    }
    
    // バイナリ
    const buffer = await response.buffer();
    res.send(buffer);
    
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).send('Proxy Error: ' + error.message);
  }
});

// ================================
// ヘルスチェック
// ================================
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '3.0.0' });
});

// ================================
// SPA対応
// ================================
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// ================================
// サーバー起動
// ================================
app.listen(CONFIG.port, '0.0.0.0', () => {
  console.log('\n🚀 Transparent Proxy v3.0.0 - UV Style');
  console.log(`✅ Server: http://0.0.0.0:${CONFIG.port}`);
  console.log(`✅ Prefix: ${CONFIG.prefix}\n`);
});

module.exports = app;
