import type { TranslationKey } from "@/lib/i18n";

/**
 * 伴侣版（/m）的三个 tab。
 *
 * ⚠️ 判定伴侣版路径一律走 isCompanionPath()，不要手写 startsWith("/m")：
 *    桌面站的 /monitor 也以 "/m" 开头，直接用 startsWith 会让监测页的
 *    底部导航凭空消失。
 */
export const COMPANION_TABS = [
  { key: "today", href: "/m", labelKey: "companion.tab.today" },
  { key: "feed", href: "/m/feed", labelKey: "companion.tab.feed" },
  { key: "saved", href: "/m/saved", labelKey: "companion.tab.saved" },
] as const satisfies ReadonlyArray<{
  key: string;
  href: string;
  labelKey: TranslationKey;
}>;

export type CompanionTabKey = (typeof COMPANION_TABS)[number]["key"];

/** 是否处于伴侣版子树。注意排除 /monitor。 */
export function isCompanionPath(pathname: string): boolean {
  return pathname === "/m" || pathname.startsWith("/m/");
}

/**
 * 当前应高亮的 tab。详情页返回 null——它有自己底部的 toolbar，
 * 不显示 tab bar（见 mockup 的 Detail 屏）。
 *
 * 从 COMPANION_TABS 推导而非硬编码，避免两处真源漂移：
 * 改了 tab 的 href 却忘了这里，会静默丢掉选中态且编译不报错。
 */
export function activeTab(pathname: string): CompanionTabKey | null {
  // 归一化尾斜杠，与 isCompanionPath 对 "/m/" 的判定保持一致。
  const normalized =
    pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;

  const match = COMPANION_TABS.find((tab) =>
    tab.href === "/m"
      ? normalized === "/m"
      : normalized === tab.href || normalized.startsWith(`${tab.href}/`),
  );
  return match?.key ?? null;
}
