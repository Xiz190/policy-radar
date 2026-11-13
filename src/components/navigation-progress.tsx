"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function NavigationProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let inner: ReturnType<typeof setTimeout> | undefined;
    // 路由变化时重新播放进度条，就是这个 effect 的目的
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(true);
    setWidth(15);
    const t1 = setTimeout(() => setWidth(40), 80);
    const t2 = setTimeout(() => setWidth(75), 250);
    const t3 = setTimeout(() => {
      setWidth(100);
      inner = setTimeout(() => { setVisible(false); setWidth(0); }, 250);
    }, 500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      if (inner) clearTimeout(inner);
    };
  }, [pathname, searchParams]);

  if (!visible && width === 0) return null;

  return (
    <div
      className="pointer-events-none fixed left-0 top-0 z-[200] h-0.5 transition-all duration-200 ease-out"
      style={{ width: `${width}%`, backgroundColor: "var(--brand)", opacity: visible ? 1 : 0 }}
    />
  );
}

// useSearchParams 必须包在 Suspense 里，否则生产构建静态生成会报错（missing-suspense-with-csr-bailout）
export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressInner />
    </Suspense>
  );
}
