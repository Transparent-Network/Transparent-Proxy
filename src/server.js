// ⚡ Transparent Proxy v5.1.0
// Service Worker削除 + 超高速版

const express = require('express');
const fetch = require('node-fetch');
const compression = require('compression');
const path = require('path');

const app = express();

// gzip圧縮
app.use(compression());

// 静的ファイル
app.use(express.static(path.join(__dirname, '..', 'public'), {
  maxAge: '1d',
  etag: true
}));

// XORエンコーディング
function xorEncode(str) {
  return Array.from(str)
    .map(char => String.fromCharCode(char.charCodeAt(0) ^ 2))
    .join('');
}

function encodeUrl(url) {
  const encoded = xorEncode(url);
  return Buffer.from(encoded, 'binary').toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function decodeUrl(encoded) {
  const padded = encoded
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padding = (4 - padded.length % 4) % 4;
  const base64 = padded + '='.repeat(padding);
  const decoded = Buffer.from(base64, 'base64').toString('binary');
  return xorEncode(decoded);
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
      console.error('Decode error:', e.message);
      return res.status(400).send('Invalid URL');
    }
    
    console.log('→', targetUrl);
    
    const parsedUrl = new URL(targetUrl);
    
    // 完全なブラウザヘッダー
    const headers = {
      'Host': parsedUrl.host,
      'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': req.headers['accept'] || 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': req.headers['accept-language'] || 'ja,en-US;q=0.9,en;q=0.8',
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
    
    // Sec-Ch-Ua
    headers['Sec-Ch-Ua'] = req.headers['sec-ch-ua'] || '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"';
    headers['Sec-Ch-Ua-Mobile'] = req.headers['sec-ch-ua-mobile'] || '?0';
    headers['Sec-Ch-Ua-Platform'] = req.headers['sec-ch-ua-platform'] || '"Windows"';
    
    // Cookie完全転送
    if (req.headers['cookie']) {
      headers['Cookie'] = req.headers['cookie'];
    }
    
    // YouTube特化
    if (parsedUrl.hostname.includes('youtube.com') || parsedUrl.hostname.includes('youtu.be')) {
      const ytCookies = [
        'CONSENT=PENDING+987',
        'SOCS=CAESHAgBEhJnd3NfMjAyNDAxMTAtMF9SQzIaAmVuIAEaBgiAo--mBg',
        'PREF=f6=40000000&tz=Asia.Tokyo&f5=30000',
        'VISITOR_PRIVACY_METADATA=CgJKUBIEGgAgWA%3D%3D'
      ];
      headers['Cookie'] = (headers['Cookie'] || '') + '; ' + ytCookies.join('; ');
    }
    
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      redirect: 'follow'
    });
    
    const contentType = response.headers.get('content-type') || '';
    
    // ブロックヘッダー削除
    const blocked = [
      'content-security-policy', 'content-security-policy-report-only',
      'x-frame-options', 'x-content-type-options',
      'cross-origin-embedder-policy', 'cross-origin-resource-policy',
      'cross-origin-opener-policy', 'strict-transport-security',
      'permissions-policy', 'referrer-policy', 'expect-ct', 'feature-policy'
    ];
    
    response.headers.forEach((value, key) => {
      if (!blocked.includes(key.toLowerCase())) {
        try { res.setHeader(key, value); } catch (e) {}
      }
    });
    
    // CORS完全許可
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    
    // Cookie転送
    const setCookie = response.headers.raw()['set-cookie'];
    if (setCookie) res.setHeader('Set-Cookie', setCookie);
    
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
    
    // その他
    const buffer = await response.buffer();
    res.send(buffer);
    
  } catch (error) {
    console.error('✗', error.message);
    res.status(500).send('Error');
  }
});

// HTML書き換え
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
  
  // 超高速正規表現
  html = html
    .replace(/<base[^>]*>/gi, '')
    .replace(/<meta[^>]*http-equiv=["'](Content-Security-Policy|X-Frame-Options)["'][^>]*>/gi, '')
    .replace(/href=["'](?!javascript:|#|data:|blob:|about:)([^"']+)["']/gi, (m, u) => `href="${rewrite(u)}"`)
    .replace(/src=["'](?!javascript:|#|data:|blob:|about:)([^"']+)["']/gi, (m, u) => `src="${rewrite(u)}"`)
    .replace(/action=["'](?!javascript:|#|data:|blob:|about:)([^"']+)["']/gi, (m, u) => `action="${rewrite(u)}"`)
    .replace(/data=["'](?!javascript:|#|data:|blob:|about:)([^"']+)["']/gi, (m, u) => `data="${rewrite(u)}"`)
    .replace(/poster=["'](?!javascript:|#|data:|blob:|about:)([^"']+)["']/gi, (m, u) => `poster="${rewrite(u)}"`)
    .replace(/srcset=["']([^"']+)["']/gi, (m, s) => {
      const r = s.split(',').map(i => {
        const p = i.trim().split(/\s+/);
        p[0] = rewrite(p[0]);
        return p.join(' ');
      }).join(', ');
      return `srcset="${r}"`;
    });
  
  // 超軽量スクリプト
  const script = `<script>!function(){if(window.__P)return;window.__P=1;const e=t=>{const e=[];for(let r=0;r<t.length;r++)e.push(String.fromCharCode(2^t.charCodeAt(r)));const n=e.join("");return btoa(unescape(encodeURIComponent(n))).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=/g,"")},t=t=>{if(!t||"string"!=typeof t||t.match(/^(javascript:|data:|blob:|#|about:|\\/service\\/)/))return t;try{let r;return r=t.startsWith("http://")||t.startsWith("https://")?t:t.startsWith("//")?\"https:\"+t:t.startsWith(\"/\")?\"${baseUrl}\"+t:new URL(t,\"${targetUrl}\").href,\"/service/\"+e(r)}catch(e){return t}},r=window.fetch;window.fetch=function(e,n){return\"string\"==typeof e&&(e=t(e)),r.call(this,e,n)};const n=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(e,r,...o){return n.call(this,e,t(r),...o)};const o=window.open;window.open=function(e,...r){return o.call(this,e?t(e):e,...r)};const i=Object.getOwnPropertyDescriptor(Location.prototype,\"href\");i&&i.set&&Object.defineProperty(location,\"href\",{get:i.get,set:function(e){i.set.call(this,t(e))}});const c=history,a=c.pushState,s=c.replaceState;c.pushState=function(e,r,n){return a.call(this,e,r,t(n))},c.replaceState=function(e,r,n){return s.call(this,e,r,t(n))},\"serviceWorker\"in navigator&&(navigator.serviceWorker.getRegistrations().then((e=>e.forEach((e=>e.unregister())))).catch((()=>{})),Object.defineProperty(navigator,\"serviceWorker\",{get:()=>void 0})),Object.defineProperty(navigator,\"webdriver\",{get:()=>!1}),Object.defineProperty(navigator,\"plugins\",{get:()=>[{name:\"Chrome PDF Plugin\"}]}),window.chrome||(window.chrome={runtime:{},loadTimes:()=>{},csi:()=>{},app:{}})}();</script>`;
  
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
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, '0.0.0.0', () => {
  console.log('\n⚡ Transparent Proxy v5.1.0');
  console.log(`✅ Port: ${PORT}\n`);
});

module.exports = app;
