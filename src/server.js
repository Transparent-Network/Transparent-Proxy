const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// 静的ファイル配信
app.use(express.static('public'));

// ホームページ
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// プロキシエンドポイント
app.get('/p/:url(*)', async (req, res) => {
  try {
    const encodedUrl = req.params.url;
    const targetUrl = Buffer.from(encodedUrl, 'base64').toString('utf-8');
    
    console.log(`🌐 Proxying: ${targetUrl}`);

    // リクエストヘッダー構築
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': targetUrl,
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    };

    // フェッチ
    const response = await fetch(targetUrl, {
      headers,
      redirect: 'follow',
      timeout: 30000
    });

    const contentType = response.headers.get('content-type') || '';
    
    // HTMLの場合のみ書き換え
    if (contentType.includes('text/html')) {
      let html = await response.text();
      const $ = cheerio.load(html);
      const parsedUrl = new URL(targetUrl);
      const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

      // すべてのリンクをプロキシ経由に
      $('a[href]').each((i, el) => {
        const href = $(el).attr('href');
        if (href && !href.startsWith('javascript:') && !href.startsWith('#')) {
          const absolute = new URL(href, targetUrl).href;
          const encoded = Buffer.from(absolute).toString('base64');
          $(el).attr('href', `/p/${encoded}`);
        }
      });

      // フォームもプロキシ経由に
      $('form[action]').each((i, el) => {
        const action = $(el).attr('action');
        if (action) {
          const absolute = new URL(action, targetUrl).href;
          const encoded = Buffer.from(absolute).toString('base64');
          $(el).attr('action', `/p/${encoded}`);
        }
      });

      // <base> タグ挿入
      if (!$('base').length) {
        $('head').prepend(`<base href="${baseUrl}/">`);
      }

      // プロキシスクリプト注入
      const script = `
<script>
(function() {
  const proxyBase = '/p/';
  const encodeUrl = (url) => {
    try {
      return btoa(unescape(encodeURIComponent(url)));
    } catch(e) {
      return btoa(url);
    }
  };

  // fetch フック
  const originalFetch = window.fetch;
  window.fetch = function(url, options) {
    if (typeof url === 'string' && url.startsWith('http')) {
      url = proxyBase + encodeUrl(url);
    }
    return originalFetch.call(this, url, options);
  };

  // XMLHttpRequest フック
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    if (typeof url === 'string' && url.startsWith('http')) {
      url = proxyBase + encodeUrl(url);
    }
    return originalOpen.call(this, method, url, ...args);
  };

  // window.open フック
  const originalWindowOpen = window.open;
  window.open = function(url, ...args) {
    if (typeof url === 'string' && url.startsWith('http')) {
      url = proxyBase + encodeUrl(url);
    }
    return originalWindowOpen.call(this, url, ...args);
  };

  // ServiceWorker 無効化
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(reg => reg.unregister());
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      get: () => undefined
    });
  }

  // Bot検出回避
  try {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false
    });
  } catch(e) {}

  console.log('✅ Proxy script loaded');
})();
</script>`;

      $('head').prepend(script);

      html = $.html();

      // レスポンス送信
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(html);
    } else {
      // HTML以外はそのまま転送
      const buffer = await response.buffer();
      res.setHeader('Content-Type', contentType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(buffer);
    }

  } catch (error) {
    console.error('❌ Proxy Error:', error.message);
    res.status(500).send(`
      <html>
        <body style="font-family: sans-serif; padding: 40px; background: #1a1a1a; color: white;">
          <h1>⚠️ プロキシエラー</h1>
          <p>${error.message}</p>
          <a href="/" style="color: #00d9ff;">ホームに戻る</a>
        </body>
      </html>
    `);
  }
});

// ヘルスチェック
app.get('/health', (req, res) => {
  res.send('OK');
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`🚀 Proxy Server running on port ${PORT}`);
});
