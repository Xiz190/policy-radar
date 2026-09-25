// 本地数据存储提示文案常量与状态管理
// - 统一文案：所有涉及"本地存储"的提示共用同一套文案
// - 状态管理：记录用户是否已关闭提示，避免反复打扰

import {
  Laptop, Package, RefreshCw, Rocket, Save, Zap,
} from "lucide-react";

export type LocalDataNoticeVariant = "banner" | "footer" | "card";

export const LOCAL_DATA_NOTICE = {
  title: "数据当前保存在本地浏览器",
  description:
    "你的关注设置、通知偏好、研究记录保存在当前浏览器中，清理缓存或更换设备后会丢失。后续版本将支持云端同步。",
  primaryActionText: "我知道了",
  secondaryActionText: "了解更多",
  dismissLabel: "以后再说",
  showGuideLabel: "查看数据说明",
  scopeLabel: "当前覆盖范围",
  scopeItems: [
    "关注的部委与关键词",
    "站内通知记录",
    "我的研究与标签",
  ],
  icon: {
    banner: Zap,
    footer: Save,
    card: Package,
  },
  notifications: {
    footerText: "通知数据保存在本地浏览器中 · 仅保留最近 7 天",
    primaryActionText: "了解更多",
  },
  firstTime: {
    title: "数据保存在你的浏览器本地",
    subtitle: "使用前请了解以下事项",
    bullets: [
      {
        icon: Laptop,
        title: "仅保存在当前浏览器",
        desc: "关注设置、研究记录等数据只存储在你正在使用的浏览器中",
      },
      {
        icon: RefreshCw,
        title: "换设备 / 清缓存会丢失",
        desc: "更换设备、清理浏览器缓存或使用无痕模式时，数据不会保留",
      },
      {
        icon: Rocket,
        title: "V2.0 将支持云端同步",
        desc: "后续版本将推出账号体系与云端同步功能，敬请期待",
      },
    ],
    primaryActionText: "我知道了，开始使用",
    secondaryActionText: "前往设置页查看",
  },
} as const;

const DISMISS_STORAGE_KEY = "local_data_notice_dismissed_v1";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

export function getLocalDataNoticeDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return false;
    const dismissedAt = parseInt(raw, 10);
    if (isNaN(dismissedAt)) return false;
    return Date.now() - dismissedAt < DISMISS_DURATION_MS;
  } catch {
    return false;
  }
}

export function setLocalDataNoticeDismissed(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
  } catch {
    // 静默失败
  }
}

export function resetLocalDataNoticeDismissed(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DISMISS_STORAGE_KEY);
  } catch {
    // 静默失败
  }
}

// ============================================================================
// 首次引导状态（永久标记，看过一次就不再自动弹出）
// ============================================================================

const SEEN_STORAGE_KEY = "local_data_notice_seen_v1";

export function getLocalDataNoticeSeen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SEEN_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setLocalDataNoticeSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SEEN_STORAGE_KEY, "true");
  } catch {
    // 静默失败
  }
}

export function resetLocalDataNoticeSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SEEN_STORAGE_KEY);
  } catch {
    // 静默失败
  }
}
