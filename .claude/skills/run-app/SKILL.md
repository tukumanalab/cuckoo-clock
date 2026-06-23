---
name: run-app
description: アプリの起動とスクリーンショット撮影。アプリを動かして動作確認したいとき、README 用の docs/screenshot.png を更新したいとき、UI 変更を目視確認したいときに使う。Use when running, screenshotting, or visually verifying the cuckoo-clock web app.
---

# cuckoo-clock アプリの起動とスクリーンショット撮影

静的 Web アプリ（`index.html` + `app.js`）。ビルド不要、静的 HTTP サーバーで配信するだけ。
Three.js は CDN（jsdelivr）から読み込むため**インターネット接続が必要**。

## 1. サーバー起動

```bash
cd /Users/ishihara/js/cuckoo-clock
(python3 -m http.server 8765 >/tmp/cuckoo-http.log 2>&1 & echo $! > /tmp/cuckoo-http.pid)
```

- ポートは 8765 を使う（他とぶつかりにくい）
- macOS には `timeout` コマンドがないので、ポーリングに使わないこと
- 起動確認は `ps -p $(cat /tmp/cuckoo-http.pid)` で（`curl` は許可されないことがある）

## 2. スクリーンショット撮影（headless Chrome）

この環境には `chromium-cli` も Playwright のブラウザバイナリもない
（`npx playwright screenshot` は browser not installed で失敗する）。
**インストール済みの Google Chrome のヘッドレスモードを直接使う**のが確実:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --hide-scrollbars \
  --screenshot=/tmp/cuckoo-shot.png \
  --window-size=900,995 \
  --virtual-time-budget=8000 \
  http://localhost:8765
```

### ⚠ 必須の注意点

- **`--disable-gpu` を付けてはいけない。** 付けると WebGL が無効になり、
  Three.js の 3D プレビューが空になるだけでなく、**ピアノロールのグリッドも描画されない**
  （app.js の初期化が途中で止まるため）。GPU 有効のままで撮ること。
- `--virtual-time-budget=8000` で CDN からの Three.js 読み込みと初回レンダーを待つ。
  生の `sleep` は不要。
- `--window-size=900,995` がコンテンツ全体（ヘッダー〜フッター「青学つくまなラボ」）が
  余白込みでちょうど収まるサイズ。UI にボタンや段が増えたら高さを増やして
  まず 900×1400 で撮り、カード下端を確認してから高さを詰め直す。

### 撮影結果の検証（必ず画像を見る）

Read ツールで PNG を開いて以下を確認する:

- ピアノロールに色付きセル（デフォルトはキラキラ星）が並んでいる
- 3D プレビューにカム（「オモテ」表示・始点マーカー付き）が描画されている
- ボタン一式（▶ 試聴 / ファイル読込 / ファイル保存 / 全部クリア / STL・SVG・PDF ダウンロード）が見える

プレビュー枠が空・グリッドが無い場合は WebGL が落ちている（`--disable-gpu` を疑う）。

## 3. README 用スクリーンショットの更新

```bash
cp /tmp/cuckoo-shot.png /Users/ishihara/js/cuckoo-clock/docs/screenshot.png
```

README.md は `docs/screenshot.png` を相対パスで参照しているのでパス変更は不要。

## 4. サーバー停止

```bash
kill $(cat /tmp/cuckoo-http.pid) && rm /tmp/cuckoo-http.pid
```

停止し忘れると次回 `Address already in use` になる。その場合は
`lsof -ti :8765 | xargs kill` で掃除する。
