"use client";

import { useEffect, useState } from "react";

// 当前浏览者是不是公开演示站上的访客（未登录的非作者）。
// 本地开发 / 作者已登录 → false。首次渲染先当作非访客，避免本地开发时菜单闪一下。
// 顶部横幅和设置菜单都要用，模块级缓存同一个请求，不重复打 /api/auth/me。
let mePromise: Promise<boolean> | null = null;

function fetchIsVisitor(): Promise<boolean> {
  mePromise ??= fetch("/api/auth/me")
    .then((r) => (r.ok ? r.json() : null))
    .then((me: { demo?: boolean; owner?: boolean } | null) => !!me?.demo && !me.owner)
    .catch(() => false);
  return mePromise;
}

export function useDemoVisitor(): boolean {
  const [visitor, setVisitor] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetchIsVisitor().then((v) => {
      if (!cancelled) setVisitor(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return visitor;
}
