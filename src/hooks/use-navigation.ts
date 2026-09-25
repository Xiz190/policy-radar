"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import type { TranslationKey } from "@/lib/i18n";
import {
  Bell, BookOpen, ChartColumn, ClipboardList, FolderTree, House, Inbox, Mail, Pin, RadioTower, Rocket, Save, Settings, TrendingUp, type LucideIcon,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  i18nKey?: TranslationKey;
};

type MenuItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  desc: string;
};

type MenuDivider = { type: "divider"; groupLabel?: string };

type MenuEntry = MenuItem | MenuDivider;

const primaryNav: NavItem[] = [
  { href: "/", label: "我的工作台", icon: House, i18nKey: "nav.workspace" },
  { href: "/inbox", label: "全部动态", icon: Inbox, i18nKey: "nav.inbox" },
  { href: "/subscribe", label: "关注设置", icon: Bell, i18nKey: "nav.subscribe" },
];

const settingsMenu: MenuEntry[] = [
  { type: "divider", groupLabel: "数据洞察" },
  { href: "/signals", label: "高价值信号", icon: RadioTower, desc: "强执行、强支持、濒危预警、行业研究" },
  { href: "/dashboard", label: "数据趋势", icon: ChartColumn, desc: "两个模块的动态更新趋势与分布" },
  { href: "/sources", label: "数据来源与采集", icon: FolderTree, desc: "各来源采集方式、接入状态与已知局限" },
  { type: "divider", groupLabel: "管理后台" },
  { href: "/monitor", label: "系统管理", icon: Settings, desc: "监测任务、来源、关键词、诊断（管理员）" },
  { type: "divider", groupLabel: "设置与帮助" },
  { href: "/stats", label: "个人统计", icon: TrendingUp, desc: "阅读完成率、关键词、最活跃来源" },
  { href: "/readinglist", label: "稍后读清单", icon: Pin, desc: "在收件箱标记「稍后读」的条目" },
  { href: "/alerts", label: "提醒规则", icon: Bell, desc: "设置关键词频率提醒规则" },
  { href: "/digest", label: "今日日报预览", icon: Mail, desc: "生成并预览 HTML 邮件摘要" },
  { href: "/casestudy", label: "Case Study", icon: BookOpen, desc: "项目设计与技术决策说明（作品集）" },
  { href: "/settings/data", label: "数据备份/恢复", icon: Save, desc: "导出便签、标签、偏好为 JSON，可再导入" },
  { href: "/changelog", label: "更新日志", icon: ClipboardList, desc: "查看各版本新增功能" },
  { href: "/subscribe#roadmap", label: "版本规划", icon: Rocket, desc: "了解即将上线的功能" },
];

function isNavActiveFn(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  const basePath = href.split("?")[0];
  if (basePath === "/inbox") {
    return (
      pathname === "/inbox" ||
      pathname.startsWith("/inbox/") ||
      pathname.startsWith("/items/") ||
      pathname.startsWith("/compare") ||
      pathname.startsWith("/departments")
    );
  }
  return pathname === basePath || pathname.startsWith(basePath + "/");
}

export function isMenuDivider(entry: MenuEntry): entry is MenuDivider {
  return "type" in entry && entry.type === "divider";
}

export function computeActiveNavLabel(pathname: string): string {
  const active = primaryNav.find((n) => isNavActiveFn(n.href, pathname));
  if (active) return active.label;
  if (
    pathname.startsWith("/compare") ||
    pathname.startsWith("/items") ||
    pathname.startsWith("/departments") ||
    pathname.startsWith("/signals")
  ) {
    return "动态资讯";
  }
  if (
    pathname.startsWith("/monitor") ||
    pathname.startsWith("/keywords") ||
    pathname.startsWith("/sources")
  ) {
    return "系统管理";
  }
  if (pathname.startsWith("/research")) {
    return "我的工作台";
  }
  if (pathname.startsWith("/dashboard")) {
    return "数据洞察";
  }
  return "未知";
}

export { isNavActiveFn, primaryNav, settingsMenu };

export function useNavigation() {
  const pathname = usePathname();

  const isNavActive = (href: string) => {
    if (pathname === null) return false;
    return isNavActiveFn(href, pathname);
  };

  const activeNavLabel = useMemo(() => {
    if (pathname === null) return "未知";
    return computeActiveNavLabel(pathname);
  }, [pathname]);

  return {
    pathname,
    primaryNav,
    settingsMenu,
    isNavActive,
    activeNavLabel,
    isMenuDivider,
  };
}
