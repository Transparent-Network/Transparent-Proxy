// ⚡ Transparent Proxy v5.0.0
// Interstellar + Utopia + Shadow 完全パクリ版

const express = require('express');
const fetch = require('node-fetch');
const compression = require('compression');
const { createBareServer } = require('@tomphttp/bare-server-node');
const http = require('http');
const path = require('path');

const app = express();
const bareServer = createBareServer('/bare/');

// gzip圧縮
app.use(compression());

// 静的ファイル
app.use(express.static(path.join(__dirname, '..', 'public'), {
  maxAge: '1d',
  etag: true
}));

// Interstellar方式: 動的ルーティング
const routes = [
  { path: '/uv/uv.config.js', file: 'uv.config.js' },
  { path: '/uv/uv.bundle.js', file: 'uv.bundle.js' },
  { path: '/uv/uv.handler.js', file: 'uv.handler.js' },
  { path: '/uv/uv.sw.js', file: 'uv.sw.js' }
];

routes.forEach(route => {
  app.get(route.path, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'uv', route.file));
  });
});

// Interstellar方式: Service Worker登録
app.get('/sw.js', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'sw.js'));
});

// XORエンコーディング
function xorEncode(str) {
  return Array.from(str)
    .map(char => char.charCodeAt(0) ^ 2)
    .map(code => String.fromCharCode(code))
    .join('');
}

function xorDecode(str) {
  return xorEncode(str);
}

function encodeUrl(url) {
  const encoded = xorEncode(url);
  return btoa(encoded)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function decodeUrl(encoded) {
  const padded = encoded
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const decoded = atob(padded + '=='.slice(0, (4 - padded.length % 4) % 4));
  return xorDecode(decoded);
}

// プロキシエンドポイント
app.use('/service/', async (req, res) => {
  try {
    const encodedUrl = req.url.substring(1).split('?')[0];
    if (!encodedUrl) return res.status(400).send('Bad Request');
    
    let targetUrl;
    try {
      targetUrl = decodeUrl(encodedUrl);
    } catch (e) {
      return res.status(400).send('Invalid URL');
    }
    
    console.log('→', targetUrl);
    
    const parsedUrl = new URL(targetUrl);
    
    // Interstellar方式: 完全なブラウザヘッダー模倣
    const headers = {
      'Host': parsedUrl.host,
      'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': req.headers['accept'] || 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': req.headers['accept-language'] || 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': parsedUrl.origin + '/',
      'Origin': parsedUrl.origin,
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': req.headers['sec-fetch-dest'] || 'document',
      'Sec-Fetch-Mode': req.headers['sec-fetch-mode'] || 'navigate',
      'Sec-Fetch-Site': req.headers['sec-fetch-site'] || 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0'
    };
    
    // Sec-Ch-Ua ヘッダー（Chrome完全模倣）
    if (req.headers['sec-ch-ua']) {
      headers['Sec-Ch-Ua'] = req.headers['sec-ch-ua'];
    } else {
      headers['Sec-Ch-Ua'] = '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"';
    }
    
    if (req.headers['sec-ch-ua-mobile']) {
      headers['Sec-Ch-Ua-Mobile'] = req.headers['sec-ch-ua-mobile'];
    } else {
      headers['Sec-Ch-Ua-Mobile'] = '?0';
    }
    
    if (req.headers['sec-ch-ua-platform']) {
      headers['Sec-Ch-Ua-Platform'] = req.headers['sec-ch-ua-platform'];
    } else {
      headers['Sec-Ch-Ua-Platform'] = '"Windows"';
    }
    
    // Cookie完全転送（Utopia方式）
    if (req.headers['cookie']) {
      headers['Cookie'] = req.headers['cookie'];
    }
    
    // YouTube特化対策（Interstellar方式）
    if (parsedUrl.hostname.includes('youtube.com') || parsedUrl.hostname.includes('youtu.be')) {
      const ytCookies = [
        'CONSENT=PENDING+987',
        'SOCS=CAESHAgBEhJnd3NfMjAyNDAxMTAtMF9SQzIaAmVuIAEaBgiAo--mBg',
        'PREF=f6=40000000&tz=Asia.Tokyo&f5=30000',
        'VISITOR_INFO1_LIVE=',
        'YSC='
      ];
      headers['Cookie'] = (headers['Cookie'] || '') + '; ' + ytCookies.join('; ');
    }
    
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      redirect: 'follow',
      compress: true
    });
    
    const contentType = response.headers.get('content-type') || '';
    
    // Shadow方式: ブロックヘッダー完全削除
    const blockedHeaders = [
      'content-security-policy',
      'content-security-policy-report-only',
      'x-frame-options',
      'x-content-type-options',
      'cross-origin-embedder-policy',
      'cross-origin-resource-policy',
      'cross-origin-opener-policy',
      'strict-transport-security',
      'permissions-policy',
      'referrer-policy',
      'expect-ct',
      'feature-policy'
    ];
    
    response.headers.forEach((value, key) => {
      if (!blockedHeaders.includes(key.toLowerCase())) {
        try {
          res.setHeader(key, value);
        } catch (e) {}
      }
    });
    
    // Interstellar方式: 完全なCORS許可
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', '*');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Cookie転送
    const setCookie = response.headers.raw()['set-cookie'];
    if (setCookie) {
      res.setHeader('Set-Cookie', setCookie);
    }
    
    // HTML処理
    if (contentType.includes('text/html')) {
      let html = await response.text();
      html = rewriteHtml(html, targetUrl);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }
    
    // CSS処理
    if (contentType.includes('text/css')) {
      let css = await response.text();
      css = rewriteCss(css, targetUrl);
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      return res.send(css);
    }
    
    // JavaScript処理（そのまま）
    if (contentType.includes('javascript') || contentType.includes('json')) {
      const text = await response.text();
      return res.send(text);
    }
    
    // バイナリ
    const buffer = await response.buffer();
    res.send(buffer);
    
  } catch (error) {
    console.error('✗', error.message);
    res.status(500).send('Proxy Error');
  }
});

// Interstellar完全パクリHTML書き換え
function rewriteHtml(html, targetUrl) {
  const baseUrl = new URL(targetUrl).origin;
  
  const rewrite = (url) => {
    if (!url || url.match(/^(javascript:|data:|blob:|#|about:|\/service\/)/)) return url;
    try {
      let full;
      if (url.startsWith('http://') || url.startsWith('https://')) full = url;
      else if (url.startsWith('//')) full = 'https:' + url;
      else if (url.startsWith('/')) full = baseUrl + url;
      else full = new URL(url, targetUrl).href;
      return '/service/' + encodeUrl(full);
    } catch (e) {
      return url;
    }
  };
  
  // 超高速正規表現書き換え
  html = html
    .replace(/<base[^>]*>/gi, '')
    .replace(/<meta[^>]*http-equiv=["'](Content-Security-Policy|X-Frame-Options)["'][^>]*>/gi, '')
    .replace(/href=["'](?!javascript:|#|data:|blob:|about:)([^"']+)["']/gi, (m, u) => `href="${rewrite(u)}"`)
    .replace(/src=["'](?!javascript:|#|data:|blob:|about:)([^"']+)["']/gi, (m, u) => `src="${rewrite(u)}"`)
    .replace(/action=["'](?!javascript:|#|data:|blob:|about:)([^"']+)["']/gi, (m, u) => `action="${rewrite(u)}"`)
    .replace(/data=["'](?!javascript:|#|data:|blob:|about:)([^"']+)["']/gi, (m, u) => `data="${rewrite(u)}"`)
    .replace(/poster=["'](?!javascript:|#|data:|blob:|about:)([^"']+)["']/gi, (m, u) => `poster="${rewrite(u)}"`)
    .replace(/background=["'](?!javascript:|#|data:|blob:|about:)([^"']+)["']/gi, (m, u) => `background="${rewrite(u)}"`)
    .replace(/srcset=["']([^"']+)["']/gi, (m, s) => {
      const r = s.split(',').map(i => {
        const p = i.trim().split(/\s+/);
        p[0] = rewrite(p[0]);
        return p.join(' ');
      }).join(', ');
      return `srcset="${r}"`;
    });
  
  // Interstellar超軽量スクリプト（完全1行圧縮）
  const script = `<script>!function(){if(window.__INTERSTELLAR__)return;window.__INTERSTELLAR__=1;const e=t=>{const e=[];for(let r=0;r<t.length;r++)e.push(String.fromCharCode(2^t.charCodeAt(r)));return btoa(e.join("")).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=/g,"")},t=t=>{if(!t||"string"!=typeof t||t.match(/^(javascript:|data:|blob:|#|about:|\\/service\\/)/))return t;try{let r;return r=t.startsWith("http://")||t.startsWith("https://")?t:t.startsWith("//")?\"https:\"+t:t.startsWith(\"/\")?\"${baseUrl}\"+t:new URL(t,\"${targetUrl}\").href,\"/service/\"+e(r)}catch(e){return t}},r=window.fetch;window.fetch=function(e,n){return\"string\"==typeof e&&(e=t(e)),r.call(this,e,n)};const n=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(e,r,...o){return n.call(this,e,t(r),...o)};const o=window.open;window.open=function(e,...r){return o.call(this,e?t(e):e,...r)};const i=Object.getOwnPropertyDescriptor(Location.prototype,\"href\");i&&i.set&&Object.defineProperty(location,\"href\",{get:i.get,set:function(e){i.set.call(this,t(e))}});const c=history,a=c.pushState,s=c.replaceState;c.pushState=function(e,r,n){return a.call(this,e,r,t(n))},c.replaceState=function(e,r,n){return s.call(this,e,r,t(n))},\"serviceWorker\"in navigator&&(navigator.serviceWorker.getRegistrations().then((e=>e.forEach((e=>e.unregister())))).catch((()=>{})),Object.defineProperty(navigator,\"serviceWorker\",{get:()=>void 0,configurable:!0})),Object.defineProperty(navigator,\"webdriver\",{get:()=>!1,configurable:!0}),Object.defineProperty(navigator,\"plugins\",{get:()=>[{name:\"Chrome PDF Plugin\",description:\"Portable Document Format\",filename:\"internal-pdf-viewer\"}],configurable:!0}),window.chrome||(window.chrome={runtime:{},loadTimes:()=>{},csi:()=>{},app:{}})}();</script>`;
  
  html = html.replace(/<head>/i, '<head>' + script);
  
  return html;
}

// CSS書き換え
function rewriteCss(css, targetUrl) {
  const baseUrl = new URL(targetUrl).origin;
  
  const rewrite = (url) => {
    if (!url || url.match(/^(data:|#|\/service\/)/)) return url;
    try {
      let full;
      if (url.startsWith('http://') || url.startsWith('https://')) full = url;
      else if (url.startsWith('//')) full = 'https:' + url;
      else if (url.startsWith('/')) full = baseUrl + url;
      else full = new URL(url, targetUrl).href;
      return '/service/' + encodeUrl(full);
    } catch (e) {
      return url;
    }
  };
  
  return css
    .replace(/url\(["']?([^)"']+)["']?\)/gi, (m, u) => `url("${rewrite(u)}")`)
    .replace(/@import\s+["']([^"']+)["']/gi, (m, u) => `@import "${rewrite(u)}"`);
}

// ヘルスチェック
app.get('/health', (req, res) => res.json({ status: 'ok', version: '5.0.0' }));

// SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// HTTPサーバー作成
const server = http.createServer();

server.on('request', (req, res) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.routeRequest(req, res);
  } else {
    app(req, res);
  }
});

server.on('upgrade', (req, socket, head) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.routeUpgrade(req, socket, head);
  } else {
    socket.end();
  }
});

const PORT = process.env.PORT || 10000;

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n⚡ Interstellar/Utopia/Shadow Clone');
  console.log(`✅ Port: ${PORT}`);
  console.log(`✅ Bare: /bare/\n`);
});

module.exports = server;
