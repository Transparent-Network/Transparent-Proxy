// server.js - Transparent Proxy ULTIMATE
const express = require('express');
const fetch = require('node-fetch');
const compression = require('compression');
const path = require('path');

// ================================
// 設定
// ================================
const config = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'production'
};

const app = express();

// ================================
// ミドルウェア
// ================================

// CORS完全許可
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// 圧縮
app.use(compression());

// セキュリティヘッダー削除
app.use((req, res, next) => {
  res.removeHeader('X-Powered-By');
  next();
});

// ログ
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
  });
  next();
});

// ================================
// 静的ファイル
// ================================
const publicDir = path.join(__dirname, '..', 'public');
console.log(`📁 PUBLIC: ${publicDir}`);

app.use(express.static(publicDir, {
  maxAge: '1d',
  etag: true
}));

// ================================
// プロキシエンドポイント（最強版）
// ================================
app.all('/proxy/:url', async (req, res) => {
  try {
    const base64Url = req.params.url;
    console.log('🌐 Proxy:', base64Url);

    // Base64デコード
    let targetUrl;
    try {
      targetUrl = Buffer.from(base64Url, 'base64').toString('utf8');
      console.log('📍 Target:', targetUrl);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    // URLバリデーション
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    // フェッチ（完全なブラウザ模倣）
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
        'Referer': targetUrl,
        'Origin': new URL(targetUrl).origin
      },
      redirect: 'follow',
      compress: true
    });

    console.log('✅ Status:', response.status);

    const contentType = response.headers.get('content-type') || '';

    // レスポンスヘッダー処理（制限ヘッダー完全削除）
    const blockedHeaders = [
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
      'referrer-policy'
    ];

    response.headers.forEach((value, key) => {
      if (!blockedHeaders.includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    // iframe許可ヘッダー強制設定
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');

    // HTML処理
    if (contentType.includes('text/html')) {
      let html = await response.text();

      const baseUrl = new URL(targetUrl).origin;
      const baseTag = `<base href="${baseUrl}/">`;

      // <head>タグに<base>を注入
      if (html.includes('<head>')) {
        html = html.replace(/<head>/i, `<head>${baseTag}`);
      } else if (html.includes('<html>')) {
        html = html.replace(/<html>/i, `<html><head>${baseTag}</head>`);
      } else {
        html = `<!DOCTYPE html><html><head>${baseTag}</head><body>${html}</body></html>`;
      }

      // 制限メタタグ完全削除
      html = html.replace(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');
      html = html.replace(/<meta[^>]*http-equiv=["']X-Frame-Options["'][^>]*>/gi, '');
      html = html.replace(/<meta[^>]*name=["']referrer["'][^>]*>/gi, '');

      // YouTube/TikTok/X/Instagram 特化対応
      const socialSites = ['youtube.com', 'youtu.be', 'tiktok.com', 'twitter.com', 'x.com', 'instagram.com', 'facebook.com'];
      if (socialSites.some(site => targetUrl.includes(site))) {
        html = html.replace(/<\/head>/i, `
          <meta name="referrer" content="no-referrer">
          <meta http-equiv="X-Frame-Options" content="ALLOWALL">
          <meta http-equiv="Content-Security-Policy" content="frame-ancestors *">
        </head>`);
      }

      // リンク書き換え（相対パス対応）
      const domain = new URL(targetUrl).hostname;
      html = html.replace(/(href|src)=["'](?!http|\/\/|data:|javascript:|mailto:|tel:)([^"']+)["']/gi, (match, attr, url) => {
        if (url.startsWith('/')) {
          return `${attr}="${baseUrl}${url}"`;
        } else {
          return `${attr}="${baseUrl}/${url}"`;
        }
      });

      console.log('📝 HTML処理完了');
      return res.send(html);
    }

    // JavaScript処理
    if (contentType.includes('javascript') || contentType.includes('json')) {
      const text = await response.text();
      return res.send(text);
    }

    // CSS処理
    if (contentType.includes('css')) {
      let css = await response.text();
      
      // URL()内のパス書き換え
      const baseUrl = new URL(targetUrl).origin;
      css = css.replace(/url\(["']?(?!http|\/\/|data:)([^)"']+)["']?\)/gi, (match, url) => {
        if (url.startsWith('/')) {
          return `url("${baseUrl}${url}")`;
        } else {
          return `url("${baseUrl}/${url}")`;
        }
      });
      
      return res.send(css);
    }

    // バイナリデータ（画像・動画など）
    const buffer = await response.buffer();
    res.send(buffer);

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      error: 'Proxy Error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ================================
// ヘルスチェック
// ================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '2.2.0',
    uptime: process.uptime()
  });
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
app.listen(config.port, '0.0.0.0', () => {
  console.log('\n🚀 ==========================================');
  console.log('🚀 Transparent Proxy v2.2.0 ULTIMATE');
  console.log('🚀 ==========================================\n');
  console.log(`✅ Server: http://0.0.0.0:${config.port}`);
  console.log(`✅ Environment: ${config.env}`);
  console.log('\n⚡ Ready!\n');
});

// エラーハンドリング
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
});
