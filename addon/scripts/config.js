// ★ ここを自分の環境に合わせて編集してください
export const config = {
  // BDSからWebサーバーに届くURL
  webserver_url: "http://127.0.0.1:3000",

  // webserver/config.toml の secret と同じ値
  secret: "change-this-secret-key",

  // ポーリング間隔 (20tick = 1秒)
  poll_interval_ticks: 200,

  // デバッグログ
  debug: false,
};
