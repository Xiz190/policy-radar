// 公开演示站上「只有作者本人能用」的页面和接口清单。
// 纯数据 + 纯函数、不依赖 node 模块：服务端闸门（src/proxy.ts）和前端菜单（设置下拉）共用这一份，
// 避免「菜单藏了但网址能直接打开」或「闸门挡了但菜单还露着」。

/** 管理与个人设置类页面：访客直接打开会被跳到登录页，菜单里也不显示 */
export const OWNER_ONLY_PAGES = [
  "/monitor",      // 系统管理（任务、来源、关键词、诊断）
  "/keywords",     // 关键词管理
  "/alerts",       // 提醒规则
  "/digest",       // 日报预览 / 发送
  "/settings",     // 数据备份与恢复
  "/stats",        // 个人统计
  "/readinglist",  // 稍后读清单
] as const;

/**
 * 访客连读也不行的接口（GET 同样挡）：
 * - 服务端替你去访问任意网址的（可被当跳板，SSRF）
 * - 诊断、调试、运行记录、调度状态：内部信息，对访客没有意义
 * - 日报：会读通知发送记录
 * - 手机→桌面交接：是作者本人的待办，访客的桌面不该弹出来
 */
export const OWNER_ONLY_API = [
  "/api/monitor/sources/ping",
  "/api/monitor/diagnose",
  "/api/monitor/category-diagnose",
  "/api/monitor/items/debug-priority",
  "/api/monitor/runs",
  "/api/monitor/auto-status",
  "/api/monitor/daily-summary",
  "/api/monitor/handoff",
] as const;

function underPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

/** 去掉 /api/proxy 前缀：经转发接口来的请求按真实目标判断 */
export function normalizeApiPath(pathname: string): string {
  return underPrefix(pathname, "/api/proxy") ? "/api" + pathname.slice("/api/proxy".length) : pathname;
}

export function isOwnerOnlyPage(pathname: string): boolean {
  const path = pathname.split(/[?#]/)[0];
  return OWNER_ONLY_PAGES.some((p) => underPrefix(path, p));
}

export function isOwnerOnlyApi(pathname: string, search = ""): boolean {
  const path = normalizeApiPath(pathname);
  if (OWNER_ONLY_API.some((p) => underPrefix(path, p))) return true;
  // 这个 GET 会写「紧急提醒已读」状态，等同写操作
  if (path === "/api/monitor/items/batch" && new URLSearchParams(search).get("action") === "markUrgentSeen") return true;
  return false;
}
