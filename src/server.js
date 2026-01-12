const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Utopia方式: すべてのリソースをプロキシ経由に
app.get('/p/:url(*)', async (req, res) => {
  try {
    const encodedUrl = req.params.url;
    const targetUrl = Buffer.from(encodedUrl, 'base64').toString('utf-8');
    
    console.log(`🌐 [UTOPIA] Proxying: ${targetUrl}`);

    const parsedUrl = new URL(targetUrl);
    
    // Utopia方式: 完全なブラウザヘッダー模倣
    const headers = {
      'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': req.headers['accept'] || 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': req.headers['accept-language'] || 'ja,en-US;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': req.headers['cache-control'] || 'max-age=0',
      'Sec-Ch-Ua': req.headers['sec-ch-ua'] || '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      'Sec-Ch-Ua-Mobile': req.headers['sec-ch-ua-mobile'] || '?0',
      'Sec-Ch-Ua-Platform': req.headers['sec-ch-ua-platform'] || '"Windows"',
      'Sec-Fetch-Dest': req.headers['sec-fetch-dest'] || 'document',
      'Sec-Fetch-Mode': req.headers['sec-fetch-mode'] || 'navigate',
      'Sec-Fetch-Site': req.headers['sec-fetch-site'] || 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    };

    // Refererを適切に設定
    if (req.headers['referer'] && req.headers['referer'].includes('/p/')) {
      try {
        const refererEncoded = req.headers['referer'].split('/p/')[1];
        const refererDecoded = Buffer.from(refererEncoded, 'base64').toString('utf-8');
        headers['Referer'] = refererDecoded;
      } catch (e) {
        headers['Referer'] = targetUrl;
      }
    } else {
      headers['Referer'] = targetUrl;
    }

    // Cookieをそのまま転送（重要！）
    if (req.headers['cookie']) {
      headers['Cookie'] = req.headers['cookie'];
    }

    // YouTube特化対策
    if (parsedUrl.hostname.includes('youtube.com')) {
      if (!headers['Cookie']) {
        headers['Cookie'] = '';
      }
      // 実際のブラウザから取得したCookieパターン
      headers['Cookie'] += '; CONSENT=PENDING+987; SOCS=CAESHAgBEhJnd3NfMjAyNDAxMTAtMF9SQzIaAmVuIAEaBgiAo--mBg; PREF=f6=40000000&tz=Asia.Tokyo';
    }

    const response = await fetch(targetUrl, {
      headers,
      redirect: 'follow',
      timeout: 30000
    });

    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('text/html')) {
      let html = await response.text();
      
      // Utopia方式: 完全なHTML書き換え
      html = rewriteHTML(html, targetUrl, parsedUrl);

      // レスポンスヘッダー設定（Utopia方式）
      const responseHeaders = {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Credentials': 'true',
        'X-Frame-Options': 'ALLOWALL'
      };

      // Set-Cookieを転送
      const setCookie = response.headers.raw()['set-cookie'];
      if (setCookie) {
        responseHeaders['Set-Cookie'] = setCookie;
      }

      Object.entries(responseHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
      });

      res.send(html);
    } else {
      // バイナリコンテンツ（JS/CSS/画像/動画）
      const buffer = await response.buffer();
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', '*');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      
      // Set-Cookieを転送
      const setCookie = response.headers.raw()['set-cookie'];
      if (setCookie) {
        res.setHeader('Set-Cookie', setCookie);
      }

      res.send(buffer);
    }

  } catch (error) {
    console.error('❌ [UTOPIA] Error:', error.message);
    res.status(500).send(`
      <html>
        <head>
          <title>Error</title>
          <link rel="icon" href="https://ssl.gstatic.com/classroom/favicon.png">
        </head>
        <body style="font-family: sans-serif; padding: 40px; background: #1a1a1a; color: white;">
          <h1>⚠️ プロキシエラー</h1>
          <p>${error.message}</p>
          <button onclick="history.back()" style="background: #667eea; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">戻る</button>
        </body>
      </html>
    `);
  }
});

// Utopia方式: HTML完全書き換え関数
function rewriteHTML(html, targetUrl, parsedUrl) {
  const $ = cheerio.load(html, {
    decodeEntities: false,
    _useHtmlParser2: true
  });

  const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

  // URL書き換え関数
  const rewriteUrl = (url) => {
    if (!url || 
        url.startsWith('javascript:') || 
        url.startsWith('#') || 
        url.startsWith('data:') || 
        url.startsWith('blob:') ||
        url.startsWith('about:')) {
      return url;
    }

    try {
      const absolute = new URL(url, targetUrl).href;
      const encoded = Buffer.from(absolute).toString('base64');
      return `/p/${encoded}`;
    } catch (e) {
      return url;
    }
  };

  // すべての属性を書き換え
  const attributesToRewrite = {
    'a': ['href'],
    'link': ['href'],
    'script': ['src'],
    'img': ['src', 'srcset'],
    'video': ['src', 'poster'],
    'audio': ['src'],
    'source': ['src', 'srcset'],
    'iframe': ['src'],
    'embed': ['src'],
    'object': ['data'],
    'form': ['action']
  };

  Object.entries(attributesToRewrite).forEach(([tag, attrs]) => {
    $(tag).each((i, el) => {
      attrs.forEach(attr => {
        const value = $(el).attr(attr);
        if (value) {
          if (attr === 'srcset') {
            // srcset特殊処理
            const newSrcset = value.split(',').map(src => {
              const parts = src.trim().split(' ');
              parts[0] = rewriteUrl(parts[0]);
              return parts.join(' ');
            }).join(', ');
            $(el).attr(attr, newSrcset);
          } else {
            $(el).attr(attr, rewriteUrl(value));
          }
        }
      });
    });
  });

  // style属性内のURL書き換え
  $('[style]').each((i, el) => {
    const style = $(el).attr('style');
    if (style && style.includes('url(')) {
      const newStyle = style.replace(/url\(['"]?([^'")]*)['"]?\)/g, (match, url) => {
        return `url(${rewriteUrl(url)})`;
      });
      $(el).attr('style', newStyle);
    }
  });

  // <style>タグ内のURL書き換え
  $('style').each((i, el) => {
    let css = $(el).html();
    if (css && css.includes('url(')) {
      css = css.replace(/url\(['"]?([^'")]*)['"]?\)/g, (match, url) => {
        return `url(${rewriteUrl(url)})`;
      });
      $(el).html(css);
    }
  });

  // Utopia最強プロキシスクリプト
  const utopiaScript = `
<script id="utopia-proxy-script">
(function() {
  'use strict';
  
  const PROXY_PREFIX = '/p/';
  const CURRENT_ORIGIN = window.location.origin;
  
  function encodeProxyUrl(url) {
    try {
      return btoa(unescape(encodeURIComponent(url)));
    } catch (e) {
      return btoa(url);
    }
  }
  
  function shouldProxy(url) {
    if (typeof url !== 'string') return false;
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('javascript:') || url.startsWith('#')) {
      return false;
    }
    return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//');
  }
  
  function proxyUrl(url) {
    if (!shouldProxy(url)) return url;
    
    // 既にプロキシURLの場合はそのまま
    if (url.includes(PROXY_PREFIX)) return url;
    
    // 相対URLを絶対URLに
    if (url.startsWith('//')) {
      url = 'https:' + url;
    }
    
    return CURRENT_ORIGIN + PROXY_PREFIX + encodeProxyUrl(url);
  }

  // fetch完全フック
  const originalFetch = window.fetch;
  window.fetch = function(resource, init = {}) {
    if (typeof resource === 'string') {
      resource = proxyUrl(resource);
    } else if (resource instanceof Request) {
      const url = proxyUrl(resource.url);
      resource = new Request(url, resource);
    }
    return originalFetch.call(this, resource, init);
  };

  // XMLHttpRequest完全フック
  const XHR = XMLHttpRequest.prototype;
  const originalXHROpen = XHR.open;
  const originalXHRSend = XHR.send;
  
  XHR.open = function(method, url, ...args) {
    this._proxyUrl = url;
    url = proxyUrl(url);
    return originalXHROpen.call(this, method, url, ...args);
  };

  // window.open完全フック
  const originalWindowOpen = window.open;
  window.open = function(url, ...args) {
    if (url) url = proxyUrl(url);
    return originalWindowOpen.call(this, url, ...args);
  };

  // location.href完全フック
  const locationDescriptor = Object.getOwnPropertyDescriptor(window.location.constructor.prototype, 'href');
  if (locationDescriptor && locationDescriptor.set) {
    Object.defineProperty(window.location, 'href', {
      get: locationDescriptor.get,
      set: function(url) {
        locationDescriptor.set.call(this, proxyUrl(url));
      }
    });
  }

  // history.pushState/replaceState完全フック
  const originalPushState = History.prototype.pushState;
  const originalReplaceState = History.prototype.replaceState;
  
  History.prototype.pushState = function(state, title, url) {
    if (url) url = proxyUrl(url);
    return originalPushState.call(this, state, title, url);
  };
  
  History.prototype.replaceState = function(state, title, url) {
    if (url) url = proxyUrl(url);
    return originalReplaceState.call(this, state, title, url);
  };

  // ServiceWorker完全無効化
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(reg => reg.unregister());
    }).catch(() => {});
    
    try {
      Object.defineProperty(navigator, 'serviceWorker', {
        get: () => undefined,
        configurable: true
      });
    } catch(e) {}
  }

  // Bot検出完全回避
  try {
    delete navigator.__proto__.webdriver;
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
      configurable: true
    });
  } catch(e) {}

  try {
    window.chrome = {
      runtime: {},
      loadTimes: function() {},
      csi: function() {},
      app: {}
    };
  } catch(e) {}

  try {
    const originalQuery = navigator.permissions.query;
    navigator.permissions.query = function(parameters) {
      if (parameters.name === 'notifications') {
        return Promise.resolve({ state: 'denied' });
      }
      return originalQuery.call(this, parameters);
    };
  } catch(e) {}

  // navigator.plugins偽装
  try {
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
      configurable: true
    });
  } catch(e) {}

  console.log('✅ [UTOPIA] Proxy Engine Loaded');
})();
</script>`;

  // <head>の最初にスクリプト注入
  if ($('head').length) {
    $('head').prepend(utopiaScript);
  } else {
    $('html').prepend('<head>' + utopiaScript + '</head>');
  }

  // <meta http-equiv="Content-Security-Policy"> 削除
  $('meta[http-equiv="Content-Security-Policy"]').remove();
  $('meta[http-equiv="X-Frame-Options"]').remove();

  return $.html();
}

app.get('/health', (req, res) => {
  res.send('OK');
});

app.listen(PORT, () => {
  console.log(`🚀 [UTOPIA STYLE] Proxy Server on port ${PORT}`);
});
