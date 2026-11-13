"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefs, type FontSize, type AccentColor } from "@/contexts/prefs-context";
import { useT } from "@/lib/i18n";
import {
  Icon, Moon, Settings, Sun,
} from "lucide-react";

const FONT_SIZES: FontSize[] = ["sm", "md", "lg", "xl"];

type AccessibilityPanelProps = {
  open: boolean;
  onClose: () => void;
  /** 手机上贴在顶栏下方展开的位置（由打开它的地方算好）；桌面为 null，贴设置按钮右下展开 */
  mobileTop: number | null;
};

// 由页头「设置」菜单打开（原来自带一个太阳图标按钮，页头按钮太多，2026-11 收进设置菜单）

export function AccessibilityPanel({ open, onClose, mobileTop }: AccessibilityPanelProps) {
  const prefs = usePrefs();
  const T = useT(prefs.language);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  function reset() {
    prefs.setFontSize("md");
    prefs.setHighContrast(false);
    prefs.setReducedMotion(false);
    prefs.setDarkMode(null);
  }

  if (!open) return null;

  return (
    <div className="absolute right-0 top-full z-40" ref={panelRef}>
        <div
          className="mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
          style={
            mobileTop === null
              ? { minWidth: "280px" }
              : {
                  position: "fixed",
                  top: mobileTop,
                  left: 16,
                  right: 16,
                  width: "auto",
                  marginTop: 0,
                  maxHeight: `calc(100dvh - ${mobileTop + 16}px)`,
                  overflowY: "auto",
                }
          }
        >
          {/* header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-semibold text-slate-900">{T("a11y.title")}</span>
            <button
              type="button"
              onClick={reset}
              className="rounded-md px-2 py-0.5 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              {T("a11y.reset")}
            </button>
          </div>

          <div className="space-y-4 p-4">
            {/* Font Size */}
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                {T("a11y.fontSize")}
              </div>
              <div className="flex gap-1.5">
                {FONT_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => prefs.setFontSize(size)}
                    className={`flex-1 rounded-lg border py-1.5 font-medium transition ${
                      prefs.fontSize === size
                        ? "border-violet-500 bg-violet-50 text-violet-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                    style={{
                      fontSize:
                        size === "sm" ? "11px"
                        : size === "lg" ? "15px"
                        : size === "xl" ? "17px"
                        : "13px",
                    }}
                  >
                    {T(`a11y.fontSize.${size}` as never)}
                  </button>
                ))}
              </div>
            </div>

            {/* Dark Mode */}
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                {T("a11y.darkMode")}
              </div>
              <div className="flex gap-1.5">
                {(
                  [
                    { value: null,  key: "a11y.darkMode.system", icon: Settings },
                    { value: false, key: "a11y.darkMode.light",  icon: Sun },
                    { value: true,  key: "a11y.darkMode.dark",   icon: Moon },
                  ] as const
                ).map(({ value, key, icon: Icon }) => (
                  <button
                    key={String(value)}
                    type="button"
                    onClick={() => prefs.setDarkMode(value)}
                    className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg border py-1.5 text-xs transition ${
                      prefs.darkMode === value
                        ? "border-violet-500 bg-violet-50 text-violet-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    <span>{T(key as never)}</span>
                  </button>
                ))}
              </div>
            </div>


            {/* Toggles */}
            <div className="space-y-3">
              <Toggle
                label={T("a11y.highContrast")}
                checked={prefs.highContrast}
                onChange={prefs.setHighContrast}
              />
              <Toggle
                label={T("a11y.reducedMotion")}
                checked={prefs.reducedMotion}
                onChange={prefs.setReducedMotion}
              />
            </div>

            {/* Browser Push Notifications */}
            <BrowserPushRow />

          </div>
        </div>
    </div>
  );
}

function BrowserPushRow() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if ("Notification" in window) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 挂载后才能读浏览器数据（本地存储/窗口/当前时间），服务端读不到；放进渲染会造成水合不一致
      setSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  if (!supported) return null;

  async function request() {
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      new Notification("政策雷达", { body: "浏览器通知已开启 ✓", icon: "/favicon.ico" });
    }
  }

  const statusLabel = permission === "granted" ? "已开启 ✓" : permission === "denied" ? "已拒绝" : "未开启";
  const statusColor = permission === "granted" ? "text-emerald-600" : permission === "denied" ? "text-rose-500" : "text-slate-400";

  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-sm text-slate-700">浏览器推送通知</span>
        <span className={`ml-2 text-[11px] ${statusColor}`}>{statusLabel}</span>
      </div>
      {permission !== "granted" && permission !== "denied" && (
        <button
          type="button"
          onClick={request}
          className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition hover:bg-slate-50"
        >
          开启
        </button>
      )}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-700">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500 ${
          checked ? "bg-violet-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-[3px]"
          }`}
        />
      </button>
    </div>
  );
}
