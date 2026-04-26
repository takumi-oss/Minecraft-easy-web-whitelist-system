import { world, system } from "@minecraft/server";
import { HttpRequest, HttpHeader, HttpRequestMethod, http } from "@minecraft/server-net";
import { config } from "./config.js";

const { webserver_url, secret, poll_interval_ticks, debug } = config;
const INTERVAL = poll_interval_ticks ?? 200;
const BASE_URL  = webserver_url.replace(/\/$/, "");

function log(msg)      { console.log(`[Whitelist Addon] ${msg}`); }
function logDebug(msg) { if (debug) log(`[DEBUG] ${msg}`); }

function buildGetRequest(url) {
  const req = new HttpRequest(url);
  req.method = HttpRequestMethod.Get;
  req.headers = [
    new HttpHeader("x-api-secret", secret),
    new HttpHeader("Accept", "application/json"),
  ];
  return req;
}

function buildPostRequest(url, body) {
  const req = new HttpRequest(url);
  req.method = HttpRequestMethod.Post;
  req.headers = [
    new HttpHeader("x-api-secret", secret),
    new HttpHeader("Content-Type", "application/json"),
  ];
  req.body = JSON.stringify(body);
  return req;
}

async function confirmEntry(id, success, error) {
  try {
    await http.request(buildPostRequest(`${BASE_URL}/api/confirm`, { id, success, error: error || null }));
  } catch (e) {
    log(`confirm 送信エラー: ${e}`);
  }
}

let isPolling = false;

system.runInterval(async () => {
  if (isPolling) return;
  isPolling = true;

  try {
    logDebug(`ポーリング: ${BASE_URL}/api/pending`);
    const response = await http.request(buildGetRequest(`${BASE_URL}/api/pending`));

    if (response.status !== 200) {
      log(`HTTPエラー: ${response.status}`);
      return;
    }

    const data    = JSON.parse(response.body);
    const players = data.players ?? [];
    if (players.length === 0) { logDebug("待機なし"); return; }

    log(`${players.length} 件を処理します`);

    for (const entry of players) {
      const { id, name } = entry;
      if (!name || typeof name !== "string") {
        await confirmEntry(id, false, "無効な名前");
        continue;
      }
      try {
        await world.getDimension("overworld").runCommandAsync(`whitelist add ${name}`);
        world.sendMessage(`§a[Whitelist] §f${name} §aがホワイトリストに追加されました`);
        log(`成功: ${name}`);
        await confirmEntry(id, true, null);
      } catch (cmdErr) {
        log(`コマンドエラー (${name}): ${cmdErr}`);
        world.sendMessage(`§c[Whitelist] §f${name} §cの追加に失敗しました`);
        await confirmEntry(id, false, String(cmdErr));
      }
    }
  } catch (err) {
    log(`ポーリングエラー: ${err}`);
  } finally {
    isPolling = false;
  }
}, INTERVAL);

system.run(() => {
  log(`起動完了 | ${BASE_URL} | ${INTERVAL / 20}秒ごとにポーリング`);
});
