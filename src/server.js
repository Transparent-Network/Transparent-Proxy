const express = require('express');
const fetch = require('node-fetch');
const compression = require('compression');
const { LRUCache } = require('lru-cache');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// 超高速化: gzip圧縮
app.use(compression());

// 超高速化: 静的ファイルキャッシュ
app.use(express.static('public', {
  maxAge: '1d',
  etag: true
}));

// 超高速化: HTMLキャッシュ（5分間）
const htmlCache = new LRUCache({
  max: 100,
  ttl: 1000 * 60 * 5
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Shadow/Utopia方式: 超高速プロキシ
app.get('/p/:url(*)', async (req, res) => {
  try {
    const encodedUrl = req.params.url;
    const targetUrl = Buffer.from(encodedUrl, 'base64').toString('utf-8');
    
    console.log(`⚡ [ULTRA] ${targetUrl}`);

    const parsedUrl = new URL(targetUrl);
    
    // Shadow方式: クライアントヘッダーを完全継承
    const headers = {
      'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': req.headers['accept'] || '*/*',
      'Accept-Language': req.headers['accept-language'] || 'ja,en-US;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': targetUrl,
      'Origin': `${parsedUrl.protocol}//${parsedUrl.host}`
    };

    // すべてのSec-*ヘッダーをコピー
    Object.keys(req.headers).forEach(key => {
      if (key.toLowerCase().startsWith('sec-')) {
        headers[key] = req.headers[key];
      }
    });

    // Cookie完全転送（最重要！）
    if (req.headers['cookie']) {
      headers['Cookie'] = req.headers['cookie'];
    }

    const response = await fetch(targetUrl, {
      headers,
      redirect: 'follow',
      timeout: 15000
    });

    const contentType = response.headers.get('content-type') || '';
    
    // HTML処理
    if (contentType.includes('text/html')) {
      // キャッシュチェック
      const cached = htmlCache.get(targetUrl);
      if (cached && !req.query.nocache) {
        console.log(`✅ [CACHE] ${targetUrl}`);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('X-Cache', 'HIT');
        return res.send(cached);
      }

      let html = await response.text();
      
      // Shadow方式: 超高速正規表現書き換え
      html = ultraFastRewrite(html, targetUrl, parsedUrl);

      // キャッシュ保存
      htmlCache.set(targetUrl, html);

      // レスポンス
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('X-Frame-Options', 'ALLOWALL');
      res.setHeader('X-Cache', 'MISS');
      
      const setCookie = response.headers.raw()['set-cookie'];
      if (setCookie) res.setHeader('Set-Cookie', setCookie);

      res.send(html);
    } else {
      // バイナリは直接ストリーム
      const buffer = await response.buffer();
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      
      const setCookie = response.headers.raw()['set-cookie'];
      if (setCookie) res.setHeader('Set-Cookie', setCookie);

      res.send(buffer);
    }

  } catch (error) {
    console.error('❌ [ERROR]', error.message);
    res.status(500).send('Error');
  }
});

// Shadow/Utopia方式: 超高速正規表現書き換え
function ultraFastRewrite(html, targetUrl, parsedUrl) {
  const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
  
  const encode = (url) => {
    try {
      const absolute = new URL(url, targetUrl).href;
      return `/p/${Buffer.from(absolute).toString('base64')}`;
    } catch (e) {
      return url;
    }
  };

  // 超高速: 一括正規表現置換
  html = html
    // href属性
    .replace(/href=["'](?!javascript:|#|data:|blob:|about:)([^"']+)["']/gi, (match, url) => {
      return `href="${encode(url)}"`;
    })
    // src属性
    .replace(/src=["'](?!javascript:|#|data:|blob:|about:)([^"']+)["']/gi, (match, url) => {
      return `src="${encode(url)}"`;
    })
    // action属性
    .replace(/action=["'](?!javascript:|#|data:|blob:|about:)([^"']+)["']/gi, (match, url) => {
      return `action="${encode(url)}"`;
    })
    // CSS url()
    .replace(/url\(["']?(?!data:|blob:|about:)([^"')]+)["']?\)/gi, (match, url) => {
      return `url(${encode(url)})`;
    })
    // srcset属性
    .replace(/srcset=["']([^"']+)["']/gi, (match, srcset) => {
      const newSrcset = srcset.split(',').map(src => {
        const parts = src.trim().split(/\s+/);
        if (parts[0] && !parts[0].startsWith('data:') && !parts[0].startsWith('blob:')) {
          parts[0] = encode(parts[0]);
        }
        return parts.join(' ');
      }).join(', ');
      return `srcset="${newSrcset}"`;
    });

  // Shadow最強スクリプト（超軽量版）
  const shadowScript = `<script>
(function(){
const P='/p/',E=s=>{try{return P+btoa(unescape(encodeURIComponent(s)))}catch(e){return s}},S=u=>typeof u==='string'&&!u.match(/^(data:|blob:|javascript:|#|about:)/);
const F=fetch;fetch=(u,o)=>F(S(u)?E(u):u,o);
const X=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u,...a){return X.call(this,m,S(u)?E(u):u,...a)};
const W=window.open;window.open=(u,...a)=>W(u&&S(u)?E(u):u,...a);
const L=Object.getOwnPropertyDescriptor(Location.prototype,'href');
if(L&&L.set){Object.defineProperty(location,'href',{get:L.get,set:function(u){L.set.call(this,S(u)?E(u):u)}})}
const H=History.prototype;const PS=H.pushState;H.pushState=function(s,t,u){return PS.call(this,s,t,u&&S(u)?E(u):u)};
const RS=H.replaceState;H.replaceState=function(s,t,u){return RS.call(this,s,t,u&&S(u)?E(u):u)};
if('serviceWorker'in navigator){navigator.serviceWorker.getRegistrations().then(r=>r.forEach(x=>x.unregister())).catch(()=>{});try{Object.defineProperty(navigator,'serviceWorker',{get:()=>undefined})}catch(e){}}
try{delete navigator.__proto__.webdriver;Object.defineProperty(navigator,'webdriver',{get:()=>false})}catch(e){}
try{window.chrome={runtime:{},loadTimes:()=>{},csi:()=>{},app:{}}}catch(e){}
})();
</script>`;

  // <head>の直後に注入
  html = html.replace(/<head([^>]*)>/i, `<head$1>${shadowScript}`);
  
  // CSP削除
  html = html.replace(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');

  return html;
}

app.get('/health', (req, res) => res.send('OK'));

// クラスタリング対応
const cluster = require('cluster');
const os = require('os');

if (cluster.isMaster && process.env.NODE_ENV === 'production') {
  const numCPUs = os.cpus().length;
  console.log(`🚀 [MASTER] Forking ${numCPUs} workers...`);
  
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker) => {
    console.log(`⚠️ Worker ${worker.process.pid} died, restarting...`);
    cluster.fork();
  });
} else {
  app.listen(PORT, () => {
    console.log(`⚡ [ULTRA-FAST] Worker ${process.pid} on port ${PORT}`);
  });
}
