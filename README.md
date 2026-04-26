# Minecraft Bedrock ホワイトリスト Web 管理システム

Webブラウザからプレイヤー名を入力すると、BDSサーバー上のアドオンが自動で `/whitelist add` を実行するシステムです。

---

## 仕組み

```
[ブラウザ] → POST /api/whitelist → [Webサーバー(キュー)] ← GET /api/pending ← [BDS アドオン]
                                                           → POST /api/confirm ←
```

1. ユーザーがWebフォームでプレイヤー名を送信
2. Webサーバーが名前をキューに保存
3. BDSアドオンが定期的にポーリングしてキューを取得
4. アドオンが `/whitelist add <名前>` を実行
5. アドオンが処理完了をWebサーバーに通知しキューから削除

---

## ファイル構成

```
whitelist-system/
├── webserver/
│   ├── server.js          Webサーバー本体
│   ├── config.toml        ★ Webサーバーの設定ファイル
│   ├── package.json
│   └── public/
│       └── index.html     管理UI
└── addon/                 ← BDSのビヘイビアパックとして導入
    ├── manifest.json
    └── scripts/
        ├── main.js        アドオン本体
        └── config.js      ★ アドオンの設定ファイル
```

---

## セットアップ

### 1. Webサーバーの設定

`webserver/config.toml` を編集してください。

```toml
[server]
host   = "0.0.0.0"   # リッスンするアドレス
port   = 3000         # ポート番号
secret = "your-secret-key"  # 任意のシークレットキー

[ui]
title       = "ホワイトリスト管理"
server_name = "My Server"
```

### 2. Webサーバーの起動

```bash
cd webserver
npm install
npm start
```

ブラウザで `http://<サーバーIP>:3000` にアクセスして管理画面が開けばOK。

### 3. アドオンの設定

`addon/scripts/config.js` を編集してください。

```js
export const config = {
  // BDSサーバーからWebサーバーに届くURL
  webserver_url: "http://192.168.1.100:3000",

  // config.toml の secret と同じ値
  secret: "your-secret-key",

  // ポーリング間隔 (tick, 20tick=1秒)
  poll_interval_ticks: 200,  // 10秒ごと

  debug: false,
};
```

### 4. アドオンをBDSに導入

1. `addon/` フォルダ全体を BDS の `behavior_packs/` ディレクトリにコピー
   ```
   bds/
   └── behavior_packs/
       └── whitelist-addon/   ← ここにコピー
           ├── manifest.json
           └── scripts/
   ```

2. `bds/worlds/<ワールド名>/world_behavior_packs.json` にパックを登録:
   ```json
   [
     {
       "pack_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
       "version": [1, 0, 0]
     }
   ]
   ```

3. `server.properties` を確認:
   ```properties
   allow-list=true
   ```

4. BDSを起動（すでに起動中なら再起動）

---

## BDS の `@minecraft/server-net` について

`@minecraft/server-net` は **BDS 専用** のモジュールで、スクリプトからHTTPリクエストを送るために必要です。

- BDS 1.21.0 以降で利用可能です
- `server.properties` に以下が必要な場合があります（バージョンによる）:
  ```properties
  allow-outbound-script-debugging=true
  ```
- クライアント側 (Marketplace 等) では動作しません

---

## API エンドポイント一覧

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/` | 管理UI |
| POST | `/api/whitelist` | プレイヤーをキューに追加 (フォーム用) |
| GET | `/api/pending` | キュー取得 (アドオン用, 認証必要) |
| POST | `/api/confirm` | 処理完了通知 (アドオン用, 認証必要) |
| GET | `/api/status` | キュー状態確認 (デバッグ用, 認証必要) |

---

## よくある問題

**アドオンがポーリングできない**
- `config.js` の `webserver_url` がBDSサーバーから到達できるか確認
- ファイアウォールでWebサーバーのポートが開いているか確認

**whitelist コマンドが失敗する**
- `server.properties` で `allow-list=true` になっているか確認
- BDSのコンソールでエラーログを確認

**401 Unauthorized エラー**
- `config.toml` の `secret` と `config.js` の `secret` が一致しているか確認
