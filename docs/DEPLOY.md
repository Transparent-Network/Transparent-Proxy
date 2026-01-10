# 🚀 デプロイガイド - Transparent Proxy

このガイドでは、Transparent Proxyを各種プラットフォームにデプロイする方法を説明します。

---

## 📋 目次

- [Render](#render)
- [Railway](#railway)
- [Vercel](#vercel)
- [Netlify](#netlify)
- [Heroku](#heroku)
- [VPS/自前サーバー](#vps自前サーバー)

---

## 🎨 Render

### 前提条件
- GitHubアカウント
- Renderアカウント（無料）

### 手順

#### 1. GitHubにpush
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

#### 2. Renderでプロジェクト作成
1. [Render Dashboard](https://dashboard.render.com) にログイン
2. 「New +」→「Web Service」をクリック
3. GitHubリポジトリを選択

#### 3. 設定
```
Name: transparent-proxy
Environment: Node
Branch: main
Build Command: npm install
Start Command: node src/server.js
Plan: Free
```

#### 4. 環境変数（オプション）
```
NODE_ENV=production
PORT=3000
```

#### 5. デプロイ
「Create Web Service」をクリック

#### 6. 完了！
数分でデプロイ完了。URLが発行されます。

### カスタムドメイン
1. Renderダッシュボード → Settings → Custom Domains
2. ドメインを追加
3. DNS設定（CNAMEレコード）

---

## 🚂 Railway

### 前提条件
- GitHubアカウント
- Railwayアカウント（無料$5クレジット）

### 手順

#### 1. プロジェクト作成
1. [Railway](https://railway.app) にログイン
2. 「New Project」→「Deploy from GitHub repo」
3. リポジトリを選択

#### 2. 設定
Railwayが自動的に `railway.json` を検出してデプロイ

#### 3. 環境変数
```
NODE_ENV=production
```

#### 4. 完了！
自動的にデプロイされ、URLが発行されます。

### カスタムドメイン
1. プロジェクト → Settings → Domains
2. 「Generate Domain」または「Custom Domain」

---

## ▲ Vercel

### 前提条件
- GitHubアカウント
- Vercelアカウント（無料）

### 手順

#### 1. Vercel CLIインストール
```bash
npm install -g vercel
```

#### 2. ログイン
```bash
vercel login
```

#### 3. デプロイ
```bash
vercel
```

または

#### GitHub統合
1. [Vercel Dashboard](https://vercel.com/dashboard)
2. 「Add New」→「Project」
3. GitHubリポジトリをインポート
4. 自動デプロイ

### 設定
`vercel.json` が自動的に読み込まれます。

### 環境変数
Vercelダッシュボード → Settings → Environment Variables

```
NODE_ENV=production
```

---

## 🌐 Netlify

### 前提条件
- GitHubアカウント
- Netlifyアカウント（無料）

### 手順

#### 1. サイト作成
1. [Netlify Dashboard](https://app.netlify.com)
2. 「Add new site」→「Import an existing project」
3. GitHubリポジトリを選択

#### 2. ビルド設定
```
Build command: npm install
Publish directory: public
```

#### 3. 環境変数
Settings → Build & deploy → Environment

```
NODE_ENV=production
```

#### 4. Functions設定
`netlify.toml` が自動的に読み込まれます。

---

## 🎯 Heroku

### 前提条件
- GitHubアカウント
- Herokuアカウント（無料プランは終了）

### 手順

#### 1. Heroku CLIインストール
```bash
npm install -g heroku
```

#### 2. ログイン
```bash
heroku login
```

#### 3. アプリ作成
```bash
heroku create transparent-proxy
```

#### 4. デプロイ
```bash
git push heroku main
```

#### 5. 環境変数
```bash
heroku config:set NODE_ENV=production
```

### Procfile
`Procfile` が自動的に読み込まれます。

---

## 🖥️ VPS/自前サーバー

### 前提条件
- Ubuntu 20.04+ またはCentOS 8+
- Node.js 18+
- nginx（リバースプロキシ）

### 手順

#### 1. サーバーにSSH接続
```bash
ssh user@your-server-ip
```

#### 2. Node.jsインストール
```bash
# Ubuntu
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# または nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
```

#### 3. プロジェクトクローン
```bash
git clone https://github.com/yourusername/transparent-proxy.git
cd transparent-proxy
npm install
```

#### 4. PM2でプロセス管理
```bash
npm install -g pm2
pm2 start server.js --name transparent-proxy
pm2 startup
pm2 save
```

#### 5. nginx設定
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 6. SSL証明書（Let's Encrypt）
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

#### 7. 完了！
`https://your-domain.com` でアクセス可能

---

## 📊 パフォーマンス比較

| サービス | 速度 | 無料枠 | カスタムドメイン | 推奨度 |
|---------|------|--------|----------------|--------|
| **Render** | ⚡⚡⚡ | 750時間/月 | ✅ | ⭐⭐⭐⭐⭐ |
| **Railway** | ⚡⚡⚡ | $5クレジット | ✅ | ⭐⭐⭐⭐⭐ |
| **Vercel** | ⚡⚡⚡⚡ | 100GB帯域 | ✅ | ⭐⭐⭐⭐ |
| **Netlify** | ⚡⚡⚡ | 100GB帯域 | ✅ | ⭐⭐⭐⭐ |
| **VPS** | ⚡⚡⚡⚡⚡ | 有料 | ✅ | ⭐⭐⭐⭐⭐ |

---

## 🔧 トラブルシューティング

### Renderでスリープする

無料プランは15分アクセスなしでスリープ。

**解決策:**
1. 有料プラン（$7/月）にアップグレード
2. [UptimeRobot](https://uptimerobot.com)で5分ごとにpingを送る

### Vercelでタイムアウト

Vercel Free プランは10秒制限。

**解決策:**
- Pro プランにアップグレード（$20/月）
- または Render/Railway を使用

### 環境変数が反映されない

**確認:**
1. スペルミスがないか
2. デプロイ後に再起動したか
3. ダッシュボードで設定されているか

---

## 📞 サポート

問題が解決しない場合:
- [GitHub Issues](https://github.com/kotopiro/Transparent-Proxy/issues)

---

**Happy Deploying! 🚀**
