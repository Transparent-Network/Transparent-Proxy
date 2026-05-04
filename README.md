# 開発は終了しました。





#  Transparent Proxy v2.1.0

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/Transparent-Network/Transparent-Proxy/pulls)

---

## 📖 目次

- [特徴](#-特徴)
- [インストール](#-インストール)
- [使い方](#-使い方)
- [デプロイ](#-デプロイ)
- [設定](#-設定)
- [機能詳細](#-機能詳細)
- [ショートカットキー](#-ショートカットキー)
- [トラブルシューティング](#-トラブルシューティング)
- [コントリビューション](#-コントリビューション)
- [ライセンス](#-ライセンス)

---

## ✨ 特徴

### 🎯 コア機能
- **🔒 Google Classroom偽装** - favicon・タイトル完全偽装（`HOME`）
- **🪟 about:blank完全対応** - すべてのページを`about:blank`内に表示
- **🚀 超高速プロキシエンジン** - Cloudflare Workers級のパフォーマンス
- **🚫 広告ブロック** - 30+広告ドメインを自動ブロック
- **🤖 CAPTCHA突破** - reCAPTCHA・hCAPTCHA自動検出
- **🔐 URL難読化** - Base64・XOR暗号化によるフィルター回避
- **📝 完全HTML書き換え** - 相対パス・CSP・XFO完全対応

### 🎨 UI/UX
- **💎 グラスモーフィズム** - 高級感あふれる3DガラスUI
- **✨ パーティクル背景** - リアルタイム3Dパーティクルエフェクト
- **🌈 ネオングロー** - サイバーパンク風ネオンエフェクト
- **📱 完全レスポンシブ** - スマホ・タブレット・PC対応
- **🌙 テーマシステム** - ダーク・ライト・サイバーパンク

### 🛠️ 開発者機能
- **📦 完全モジュール化** - メンテナンス性最高
- **🔧 カスタマイズ可能** - すべての設定をJSON管理
- **🚀 複数サービス対応** - Render・Railway・Vercel・Netlify
- **📊 リアルタイムログ** - 詳細なアクセスログ
- **⚡ PWA対応** - オフラインでも動作

---

## 📦 インストール

### 前提条件
- Node.js >= 18.0.0
- npm >= 9.0.0
- Git

### クローン
```bash
git clone https://github.com/kotopiro/Transparent-Proxy.git
cd Transparent-Proxy
```

### 依存関係インストール
```bash
npm install
```

### 起動
```bash
npm start
```

ブラウザで `http://localhost:3000` を開く

---

## 🚀 使い方

### 基本操作

#### 1. URLを開く
- URLバーに `example.com` と入力
- 「GO」ボタンをクリック
- about:blankウィンドウが開く

#### 2. 検索
- URLバーに `透明プロキシ` と入力
- Google検索結果が表示される

#### 3. タブ操作
- **新しいタブ:** `Ctrl+T` または「+ New Tab」
- **タブを閉じる:** `Ctrl+W` または `×` ボタン
- **タブ切り替え:** タブをクリック

#### 4. 履歴・ブックマーク
- **履歴:** `Ctrl+H` または「📜 History」
- **ブックマーク追加:** `Ctrl+D`
- **ブックマーク表示:** `Ctrl+B`

---

## 🌐 デプロイ

詳細は [DEPLOY.md](DEPLOY.md) を参照

### Renderにデプロイ

#### 1. GitHubにpush
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

#### 2. Render設定
1. [Render Dashboard](https://dashboard.render.com) を開く
2. 「New +」→「Web Service」
3. GitHubリポジトリを接続
4. 設定:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. 「Create Web Service」

#### 3. 完了！
数分でデプロイ完了。URLが発行されます。

### その他のサービス
- **Railway:** [デプロイガイド](docs/DEPLOY.md#railway)
- **Vercel:** [デプロイガイド](docs/DEPLOY.md#vercel)
- **Netlify:** [デプロイガイド](docs/DEPLOY.md#netlify)

---

## ⚙️ 設定

### 環境変数

`.env`ファイルを作成:

```env
# サーバー設定
PORT=3000
NODE_ENV=production

# オプション
MAX_REQUEST_SIZE=10mb
REQUEST_TIMEOUT=30000
CACHE_TTL=3600
```

### config/default.json

詳細設定は `src/config/default.js` を編集:

```javascript
module.exports = {
  server: { port: 3000 },
  proxy: { timeout: 30000 },
  adblock: { enabled: true },
  // ...
};
```

---

## 🔥 機能詳細

### 広告ブロック

30+の広告・トラッキングドメインを自動ブロック:
- Google Ads
- Facebook Pixel
- Twitter Analytics
- その他多数

### CAPTCHA突破

reCAPTCHA・hCAPTCHAを自動検出:
- ページ内のCAPTCHA要素を検出
- 自動的に突破を試みる
- タイムアウト時はユーザーに通知

### URL難読化

フィルター回避のためURLを暗号化:
- **Base64:** 標準エンコーディング
- **XOR:** カスタムキーで暗号化

---

## ⌨️ ショートカットキー

| キー | 機能 |
|------|------|
| `Ctrl+T` | 新しいタブ |
| `Ctrl+W` | タブを閉じる |
| `Ctrl+R` | リロード |
| `Ctrl+L` | URLバーにフォーカス |
| `Ctrl+H` | 履歴を表示 |
| `Ctrl+B` | ブックマークを表示 |
| `Ctrl+D` | ブックマークに追加 |
| `Ctrl+,` | 設定を開く |
| `Ctrl+/` | ショートカット一覧 |
| `Esc` | パネルを閉じる |

---

## 🔧 トラブルシューティング

### Q. ページが表示されない

**A.** 以下を確認:
1. サーバーが起動しているか
2. URLが正しいか（`http://` または `https://` 必須）
3. ブラウザのコンソールにエラーがないか

### Q. about:blankがブロックされる

**A.** ブラウザの設定でポップアップを許可:
- Chrome: 設定 → プライバシーとセキュリティ → サイトの設定 → ポップアップとリダイレクト
- Firefox: 設定 → プライバシーとセキュリティ → 許可設定 → ポップアップウィンドウをブロックする

### Q. 画像が表示されない

**A.** 広告ブロックが原因の可能性:
- 設定画面で広告ブロックを一時無効化
- または特定のドメインをホワイトリストに追加

---

## 🤝 コントリビューション

コントリビューション大歓迎！

### 手順
1. Fork
2. Feature branch作成 (`git checkout -b feature/amazing`)
3. Commit (`git commit -m 'Add amazing feature'`)
4. Push (`git push origin feature/amazing`)
5. Pull Request作成

### コーディング規約
- ESLint設定に従う
- コメントは日本語でOK
- わかりやすい変数名を使用

---

## 📄 ライセンス

MIT License - 詳細は [LICENSE](../LICENSE) を参照

---

## 📞 サポート

- **Issues:** [GitHub Issues](https://github.com/kotopiro/Transparent-Proxy/issues)
- **Email:** takorou.0001@gmail.com

---

**Made with by Transparent Proxy Team**
## 確認用URL:
## https://abcd-tym2.onrender.com
