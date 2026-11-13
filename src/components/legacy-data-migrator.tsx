"use client";

import { useEffect } from "react";
import { migrateLegacyInboxData } from "@/lib/personal-research";

// 第一次打开任何页面时，把动态资讯页旧的稍后读/置顶/标签/便签搬进「待跟进」（只执行一次，见 personal-research.ts）
export function LegacyDataMigrator() {
  useEffect(() => {
    migrateLegacyInboxData();
  }, []);
  return null;
}
