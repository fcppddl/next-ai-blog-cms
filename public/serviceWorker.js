// 占位：满足对 /serviceWorker.js 的请求，避免开发环境出现 404 日志（扩展或探测脚本常请求此路径）。
self.addEventListener("install", () => {
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
