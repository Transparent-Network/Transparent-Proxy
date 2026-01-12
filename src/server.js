// ⚡ Transparent Proxy v4.0.0
// 超高速 + 最強版

const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();

// 設定
const CONFIG = {
  port: process.env.PORT || 10000,
  prefix: '/service/',
};

// 静的ファイル
app.use(express.static(path.join(__dirname, '..', 'public'), {
  maxAge: '1d',
  etag: true
}));

// XORエンコーディング
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

// URL書き換え
function rewriteUrl(url, baseUrl) {
  if (!url || url.startsWith(CONFIG.prefix) || url.match(/^(javascript:|data:|blob:|#|about:)/)) return url;
  
  try {
    let full;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      full = url;
    } else if (url.startsWith('//')) {
      full = 'https:' + url;
    } else if (url.startsWith('/')) {
      full = baseUrl + url;
    } else {
      full = new URL(url, baseUrl).href;
    }
    return CONFIG.prefix + encodeUrl(full);
  } catch (e) {
    return url;
  }
}

// HTML書き換え（超高速正規表現）
function rewriteHtml(html, targetUrl) {
  const baseUrl = new URL(targetUrl).origin;
  
  html = html
    .replace(/href=["'](?!javascript:|#|data:|blob:|about:)([^"']+)["']/gi, (m, u) => `href="${rewriteUrl(u, baseUrl)}"`)
    .replace(/src=["'](?!javascript:|#|data:|blob:|about:)([^"']+)["']/gi, (m, u) => `src="${rewriteUrl(u, baseUrl)}"`)
    .replace(/action=["'](?!javascript:|#|data:|blob:|about:)([^"']+)["']/gi, (m, u) => `action="${rewriteUrl(u, baseUrl)}"`)
    .replace(/data=["'](?!javascript:|#|data:|blob:|about:)([^"']+)["']/gi, (m, u) => `data="${rewriteUrl(u, baseUrl)}"`)
    .replace(/poster=["'](?!javascript:|#|data:|blob:|about:)([^"']+)["']/gi, (m, u) => `poster="${rewriteUrl(u, baseUrl)}"`)
    .replace(/srcset=["']([^"']+)["']/gi, (m, s) => {
      const r = s.split(',').map(i => {
        const p = i.trim().split(/\s+/);
        return `${rewriteUrl(p[0], baseUrl)} ${p[1] || ''}`.trim();
      }).join(', ');
      return `srcset="${r}"`;
    })
    .replace(/<base[^>]*>/gi, '')
    .replace(/<meta[^>]*http-equiv=["'](Content-Security-Policy|X-Frame-Options)["'][^>]*>/gi, '');

  // 超軽量スクリプト（1行圧縮）
  const script = `<script>(function(){if(window.__P)return;window.__P=1;const P='${CONFIG.prefix}',B='${baseUrl}',E=s=>{const x=2,b=[];for(let i=0;i<s.length;i++)b.push(String.fromCharCode(s.charCodeAt(i)^x));return btoa(b.join('')).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=/g,'')},N=u=>{if(!u||typeof u!=='string'||u.match(/^(javascript:|data:|blob:|#|about:)|${CONFIG.prefix}/))return u;try{let f;if(u.startsWith('http://')||u.startsWith('https://'))f=u;else if(u.startsWith('//'))f='https:'+u;else if(u.startsWith('/'))f=B+u;else f=new URL(u,B).href;return P+E(f)}catch(e){return u}};const F=fetch;fetch=(u,o)=>F(N(u),o);const X=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u,...a){return X.call(this,m,N(u),...a)};const W=window.open;window.open=(u,...a)=>W(N(u),...a);const L=Object.getOwnPropertyDescriptor(Location.prototype,'href');if(L&&L.set)Object.defineProperty(location,'href',{get:L.get,set:function(u){L.set.call(this,N(u))}});const H=history,PS=H.pushState,RS=H.replaceState;H.pushState=function(s,t,u){return PS.call(this,s,t,N(u))};H.replaceState=function(s,t,u){return RS.call(this,s,t,N(u))};if('serviceWorker'in navigator){navigator.serviceWorker.getRegistrations().then(r=>r.forEach(x=>x.unregister())).catch(()=>{});try{Object.defineProperty(navigator,'serviceWorker',{get:()=>undefined})}catch(e){}}try{Object.defineProperty(navigator,'webdriver',{get:()=>false})}catch(e){}try{Object.defineProperty(navigator,'plugins',{get:()=>[{name:'Chrome PDF Plugin'}]})}catch(e){}if(!window.chrome)window.chrome={runtime:{},loadTimes:()=>{},csi:()=>{},app:{}}})()</script>`;
  
  html = html.replace(/<head>/i, '<head>' + script);
  
  return html;
}

// CSS書き換え
function rewriteCss(css, targetUrl) {
  const baseUrl = new URL(targetUrl).origin;
  return css
    .replace(/url\(["']?([^)"']+)["']?\)/gi, (m, u) => 
      u.match(/^(data:|#)/) ? m : `url("${rewriteUrl(u, baseUrl)}")`)
    .replace(/@import\s+["']([^"']+)["']/gi, (m, u) => 
      `@import "${rewriteUrl(u, baseUrl)}"`);
}

// プロキシエンドポイント
app.use(CONFIG.prefix, async (req, res) => {
  try {
    const encodedUrl = req.url.substring(1).split('?')[0];
    if (!encodedUrl) return res.status(400).send('Bad Request');
    
    const targetUrl = decodeUrl(encodedUrl);
    console.log('→', targetUrl);
    
    const parsedUrl = new URL(targetUrl);
    
    // ブラウザヘッダー
    const headers = {
      'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': req.headers['accept'] || '*/*',
      'Accept-Language': req.headers['accept-language'] || 'ja,en-US;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': targetUrl,
      'Origin': parsedUrl.origin
    };
    
    // Sec-*ヘッダーコピー
    Object.keys(req.headers).forEach(k => {
      if (k.toLowerCase().startsWith('sec-')) headers[k] = req.headers[k];
    });
    
    // Cookie転送
    if (req.headers['cookie']) headers['Cookie'] = req.headers['cookie'];
    
    // YouTube対策
    if (parsedUrl.hostname.includes('youtube.com')) {
      headers['Cookie'] = (headers['Cookie'] || '') + '; CONSENT=PENDING+987; SOCS=CAESHAgBEhJnd3NfMjAyNDAxMTAtMF9SQzIaAmVuIAEaBgiAo--mBg';
    }
    
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      redirect: 'follow'
    });
    
    const contentType = response.headers.get('content-type') || '';
    
    // ブロックヘッダー
    const blocked = ['content-security-policy', 'content-security-policy-report-only', 'x-frame-options', 
      'cross-origin-embedder-policy', 'cross-origin-resource-policy', 'cross-origin-opener-policy',
      'content-encoding', 'transfer-encoding'];
    
    response.headers.forEach((v, k) => {
      if (!blocked.includes(k.toLowerCase())) res.setHeader(k, v);
    });
    
    // CORS許可
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

// ヘルスチェック
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// サーバー起動
app.listen(CONFIG.port, '0.0.0.0', () => {
  console.log(`\n⚡ Proxy Server Running`);
  console.log(`✅ Port: ${CONFIG.port}\n`);
});

module.exports = app;
