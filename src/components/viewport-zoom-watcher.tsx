"use client";

import { useEffect } from "react";

// 手机上双指放大后，position: fixed 的元素跟着「布局视口」走，而用户看到的是放大后的「可视视口」，
// 一拖动底栏和浮动按钮就会四处乱飞（iOS Safari 最明显）。
// 做法：放大期间给 <html> 打上 data-zoomed，带 .hide-when-zoomed 的固定元素先隐藏，缩回原比例再出现。
// 不禁止缩放：放大看小字是无障碍需求。
export function ViewportZoomWatcher() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const update = () => {
      if (vv.scale > 1.05) root.dataset.zoomed = "";
      else delete root.dataset.zoomed;
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      delete root.dataset.zoomed;
    };
  }, []);
  return null;
}
