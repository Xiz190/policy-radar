"use client";

import { useEffect } from "react";

// 弹窗打开时锁住背景滚动。用模块级计数器，多个弹窗同时打开时
// 只有最后一个关闭才恢复——避免 A 关掉时把 B 的锁也解了。
let lockCount = 0;
let savedOverflow = "";
let savedPaddingRight = "";

export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const body = document.body;

    if (lockCount === 0) {
      // 补上滚动条消失的宽度，否则打开弹窗时整页会横向抖一下
      const scrollbar = window.innerWidth - document.documentElement.clientWidth;
      savedOverflow = body.style.overflow;
      savedPaddingRight = body.style.paddingRight;
      body.style.overflow = "hidden";
      if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    }
    lockCount += 1;

    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        body.style.overflow = savedOverflow;
        body.style.paddingRight = savedPaddingRight;
      }
    };
  }, [locked]);
}
