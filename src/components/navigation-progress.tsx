"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function NavigationProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let t1: ReturnType<typeof setTimeout>;
    let t2: ReturnType<typeof setTimeout>;
    let t3: ReturnType<typeof setTimeout>;

    setVisible(true);
    setWidth(15);
    t1 = setTimeout(() => setWidth(40), 80);
    t2 = setTimeout(() => setWidth(75), 250);
    t3 = setTimeout(() => {
      setWidth(100);
      setTimeout(() => { setVisible(false); setWidth(0); }, 250);
    }, 500);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
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
