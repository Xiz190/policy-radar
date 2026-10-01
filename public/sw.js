// 离线兜底用的 service worker：先走网络，网络失败时才用缓存。
// v2 写成了 cache-first（缓存过一次就永远返回旧页面）：访客看不到新抓到的内容，
// 而且部署新版本后，缓存里的旧 HTML 会去引用已不存在的旧脚本，页面可能直接坏掉。
// 版本号升到 v3，激活时会删掉 v2 的旧缓存。两个情报台用同一份文件。
const CACHE = "creator-intel-v3";

const PRECACHE = ["/", "/inbox"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // API、Next 内部资源不经过 service worker。
  // /m 是手机伴侣版：永不缓存（判定逻辑的真源在 src/lib/companion/nav.ts 的 isCompanionPath()；
  // 不能用 startsWith("/m")，桌面站的 /monitor 与 /method 也以它开头；
  // service worker 从 public/ 原样送出，无法 import src/，故此处重复一份）。
  const isCompanion = url.pathname === "/m" || url.pathname.startsWith("/m/");
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/") || isCompanion) return;
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request).then((cached) => cached ?? new Response("Offline", { status: 503 })),
      ),
  );
});
