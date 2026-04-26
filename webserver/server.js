const express = require('express');
const fs = require('fs');
const path = require('path');
const toml = require('@iarna/toml');

// ── 設定読み込み
let config;
try {
  const raw = fs.readFileSync(path.join(__dirname, 'config.toml'), 'utf-8');
  config = toml.parse(raw);
} catch (e) {
  console.error('[ERROR] config.toml の読み込みに失敗:', e.message);
  process.exit(1);
}

const HOST   = config.server.host   || '0.0.0.0';
const PORT   = config.server.port   || 3000;
const SECRET = config.server.secret || '';

// ── キュー (インメモリ)
const pendingQueue = [];

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function checkSecret(incoming) {
  if (!SECRET) return true;
  return incoming === SECRET;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

function log(msg) {
  console.log(`[${new Date().toLocaleString('ja-JP')}] ${msg}`);
}

// UI設定を返す (HTML側で使用)
app.get('/api/ui-config', (_req, res) => {
  res.json({
    title:       config.ui?.title       || 'ホワイトリスト管理',
    server_name: config.ui?.server_name || 'Minecraft Server',
  });
});

// デバッグ用 キュー確認
app.get('/api/status', (req, res) => {
  const secret = req.headers['x-api-secret'] || req.query.secret;
  if (!checkSecret(secret)) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ pending_count: pendingQueue.length, queue: pendingQueue });
});

// Webフォームからプレイヤー追加
app.post('/api/whitelist', (req, res) => {
  const rawName = (req.body.playerName || '').trim();

  if (!rawName)
    return res.status(400).json({ success: false, error: 'プレイヤー名を入力してください。' });

  if (!/^[a-zA-Z0-9_\-]{1,16}$/.test(rawName))
    return res.status(400).json({ success: false, error: '無効なプレイヤー名です (英数字・_・- / 16文字以内)。' });

  if (pendingQueue.some(p => p.name.toLowerCase() === rawName.toLowerCase()))
    return res.status(409).json({ success: false, error: `${rawName} は既にキューにあります。` });

  const entry = { id: generateId(), name: rawName, timestamp: Date.now() };
  pendingQueue.push(entry);
  log(`[QUEUE] 追加: ${rawName} (id=${entry.id})`);

  return res.json({ success: true, message: `${rawName} をキューに追加しました。` });
});

// アドオンがポーリングして保留リストを取得
app.get('/api/pending', (req, res) => {
  const secret = req.headers['x-api-secret'] || req.query.secret;
  if (!checkSecret(secret)) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ players: pendingQueue });
});

// アドオンが処理完了を通知
app.post('/api/confirm', (req, res) => {
  const secret = req.headers['x-api-secret'];
  if (!checkSecret(secret)) return res.status(401).json({ error: 'Unauthorized' });

  const { id, success, error } = req.body;
  const idx = pendingQueue.findIndex(p => p.id === id);
  if (idx !== -1) {
    const [removed] = pendingQueue.splice(idx, 1);
    log(success ? `[DONE] ${removed.name}` : `[FAIL] ${removed.name} - ${error}`);
  }
  res.json({ success: true });
});

app.listen(PORT, HOST, () => {
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║  Whitelist Web Server                ║`);
  console.log(`║  http://${HOST}:${PORT}`.padEnd(39) + `║`);
  console.log(`╚══════════════════════════════════════╝\n`);
});
