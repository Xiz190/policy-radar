// 演示站只读提示：任何组件都能触发同一条 toast（由 components/demo-mode-gate.tsx 监听并显示）。
// 按钮点击已在 DemoModeGate 统一拦截（data-owner-only）；这里给键盘快捷键这类不经过点击的入口用。
export const DEMO_READONLY_EVENT = "demo-readonly";

export function notifyDemoReadonly() {
  window.dispatchEvent(new Event(DEMO_READONLY_EVENT));
}
