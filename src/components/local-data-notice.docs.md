# LocalDataNotice 组件文档

本地数据存储提示的统一文案与通用组件，用于在各页面告知用户当前数据保存在浏览器本地。

---

## 目录

- [概述](#概述)
- [文案常量](#文案常量)
- [Props 定义](#props-定义)
- [三种模式](#三种模式)
- [使用示例](#使用示例)
- [状态管理逻辑](#状态管理逻辑)
- [FAQ](#faq)

---

## 概述

`LocalDataNotice` 是一个统一的本地数据存储提示组件，用于在产品的不同位置以不同强度告知用户：

> 你的关注设置、通知偏好、研究记录保存在当前浏览器中，清理缓存或更换设备后会丢失。后续版本将支持云端同步。

### 设计原则

- **文案统一**：所有位置共用同一套文案常量，避免表述不一致
- **视觉分级**：三种模式（banner / footer / card）对应不同的提示强度
- **可控打扰**：支持关闭状态持久化，避免反复打扰用户
- **入口保留**：设置页场景下，关闭后仍保留"查看数据说明"入口

### 文件位置

| 文件 | 用途 |
|------|------|
| `src/lib/local-data-notice.ts` | 文案常量 + 状态管理函数 |
| `src/components/local-data-notice.tsx` | 组件实现 |

---

## 文案常量

所有文案定义在 `LOCAL_DATA_NOTICE` 常量中，统一管理。

```typescript
import { LOCAL_DATA_NOTICE } from "@/lib/local-data-notice";
```

| 字段 | 值 | 说明 |
|------|----|------|
| `title` | 数据当前保存在本地浏览器 | 标题 |
| `description` | 你的关注设置、通知偏好、研究记录保存在当前浏览器中，清理缓存或更换设备后会丢失。后续版本将支持云端同步。 | 说明正文（2 句） |
| `primaryActionText` | 我知道了 | 主按钮文案 |
| `secondaryActionText` | 了解更多 | 次按钮文案 |
| `dismissLabel` | 以后再说 | 关闭按钮文案 |
| `showGuideLabel` | 查看数据说明 | 设置页入口文案 |
| `scopeLabel` | 当前覆盖范围 | card 模式的小标题 |
| `scopeItems` | `["关注的部委与关键词", "站内通知记录", "我的研究与标签"]` | 本地存储的数据范围 |
| `icon` | `{ banner: "⚡", footer: "💾", card: "📦" }` | 各模式图标 |

---

## Props 定义

```typescript
import { type LocalDataNoticeProps } from "@/components/local-data-notice";
```

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `variant` | `"banner" \| "footer" \| "card"` | **必填** | 展示模式，见下方说明 |
| `dismissible` | `boolean` | `true` | 是否可关闭 |
| `showPrimaryAction` | `boolean` | `true` | 是否显示"我知道了"主按钮 |
| `showSecondaryAction` | `boolean` | `false` | 是否显示"了解更多"次按钮 |
| `showGuideEntry` | `boolean` | `false` | 关闭后是否显示"查看数据说明"入口（仅 banner 模式有效） |
| `autoDismissState` | `boolean` | `false` | 是否启用 localStorage 持久化关闭状态 |
| `onDismiss` | `() => void` | - | 关闭回调 |
| `onPrimaryAction` | `() => void` | - | 主按钮（我知道了）回调 |
| `onSecondaryAction` | `() => void` | - | 次按钮（了解更多）回调 |
| `onShowGuide` | `() => void` | - | "查看数据说明"入口点击回调 |
| `className` | `string` | `""` | 外层自定义 class |

---

## 三种模式

### 1. banner — 顶部通栏

**适用场景**：关注设置页、我的研究页等页面顶部

**视觉特点**：
- 琥珀色背景（`bg-amber-50`），中等强度提示
- 横向布局：左图标 + 中内容 + 右关闭
- 主按钮实心，次按钮文字链接

**支持的额外功能**：
- `showGuideEntry`：关闭后显示"💾 查看数据说明"入口

---

### 2. footer — 页脚弱提示

**适用场景**：通知中心底部、列表底部等需要弱提示的位置

**视觉特点**：
- 灰色小字（`text-slate-400`），最低提示强度
- 居中一行布局
- 无主按钮，仅有"了解更多"文字链接
- 关闭按钮为 `×`

---

### 3. card — 引导卡片

**适用场景**：首次进入引导、弹窗式提示

**视觉特点**：
- 白色背景 + 阴影 + 边框，最高提示强度
- 大图标（`text-3xl`）
- 显示"当前覆盖范围"列表（3 条）
- 主按钮深色实心，次按钮边框浅色

---

## 使用示例

### 基础用法：banner 模式

```tsx
import { LocalDataNotice } from "@/components/local-data-notice";

export default function SubscribePage() {
  return (
    <div>
      <LocalDataNotice
        variant="banner"
        showPrimaryAction
        showSecondaryAction
        onPrimaryAction={() => console.log("用户已知晓")}
        onSecondaryAction={() => router.push("/help/local-data")}
      />
    </div>
  );
}
```

---

### 设置页：banner + 关闭入口 + 持久化

```tsx
import { LocalDataNotice } from "@/components/local-data-notice";

export default function SubscribePage() {
  return (
    <div>
      <LocalDataNotice
        variant="banner"
        showPrimaryAction
        showSecondaryAction
        showGuideEntry
        autoDismissState
        onShowGuide={() => {
          // 由父组件控制重新显示（例如更新 key）
        }}
      />
    </div>
  );
}
```

> **注意**：`showGuideEntry` 模式下，点击"查看数据说明"的重新显示逻辑由父组件控制。常见做法是给组件加一个 `key`，点击入口时更新 `key` 触发重新挂载。

---

### 通知中心：footer 弱提示

```tsx
import { LocalDataNotice } from "@/components/local-data-notice";

export default function NotificationsPage() {
  return (
    <div>
      {/* 通知列表 */}
      <LocalDataNotice
        variant="footer"
        showSecondaryAction
        autoDismissState
        onSecondaryAction={() => router.push("/help/local-data")}
      />
    </div>
  );
}
```

---

### 首次进入：card 引导卡片

```tsx
import { LocalDataNotice } from "@/components/local-data-notice";

export default function OnboardingModal() {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="w-full max-w-md">
        <LocalDataNotice
          variant="card"
          showPrimaryAction
          showSecondaryAction
          autoDismissState
          onPrimaryAction={() => closeModal()}
          onSecondaryAction={() => router.push("/help/local-data")}
        />
      </div>
    </div>
  );
}
```

---

## 状态管理逻辑

### 关闭状态持久化

当 `autoDismissState={true}` 时，组件会将关闭状态持久化到 `localStorage`。

**存储 Key**：`local_data_notice_dismissed_v1`

**有效期**：7 天（`DISMISS_DURATION_MS`）

**存储内容**：关闭时的时间戳（`Date.now()`）

---

### 状态管理函数

```typescript
import {
  getLocalDataNoticeDismissed,
  setLocalDataNoticeDismissed,
  resetLocalDataNoticeDismissed,
} from "@/lib/local-data-notice";
```

| 函数 | 返回值 | 说明 |
|------|--------|------|
| `getLocalDataNoticeDismissed()` | `boolean` | 读取是否处于关闭状态（7 天内关闭过则为 true） |
| `setLocalDataNoticeDismissed()` | `void` | 标记为已关闭（写入当前时间戳） |
| `resetLocalDataNoticeDismissed()` | `void` | 重置关闭状态（清除 localStorage） |

---

### 组件内部状态流程

```
组件挂载
    ↓
useState 初始函数 → 检查 autoDismissState + localStorage
    │
    ├── 已关闭 → visible = false（无闪烁）
    └── 未关闭 → visible = true
    ↓
用户点击关闭 / 我知道了
    ↓
autoDismissState = true?
    │
    ├── 是 → setLocalDataNoticeDismissed() → 写入 localStorage
    └── 否 → 仅更新内部状态
    ↓
visible = false
    ↓
showGuideEntry + banner?
    │
    ├── 是 → 渲染"查看数据说明"入口
    └── 否 → 渲染 null
```

---

### 关键设计点

**1. 无闪烁初始化**

`useState` 使用**初始函数**在首次渲染时就判断 localStorage，而不是 `useState(true)` + `useEffect` 判断。避免了"先显示再消失"的闪烁。

```typescript
// ✅ 正确：初始函数中判断
const [visible, setVisible] = useState(() => {
  if (autoDismissState && getLocalDataNoticeDismissed()) {
    return false;
  }
  return true;
});
```

**2. SSR 安全**

所有 `localStorage` 访问都有 `typeof window === "undefined"` 保护，服务端渲染时安全降级。

**3. 静默失败**

localStorage 操作（读取/写入）失败时静默处理，不影响组件正常显示。

---

## FAQ

### Q: 为什么关闭后刷新页面，banner 还显示入口？

`showGuideEntry` 是 banner 模式的专属功能：关闭后不直接消失，而是变成一个不显眼的"查看数据说明"入口。这是为了在设置页等场景下，用户随时可以回来查看说明。

如果不需要入口，设置 `showGuideEntry={false}`（默认值）。

---

### Q: 三种模式的关闭状态是共用的吗？

是的，三种模式共用同一个 localStorage key（`local_data_notice_dismissed_v1`）。在一个地方关闭了，其他地方也会自动关闭。

这样设计的原因是：用户只要理解了一次"本地存储"的概念，就不需要在每个页面重复提示。

---

### Q: 如何强制重新显示？

有两种方式：

1. **调用 `resetLocalDataNoticeDismissed()`**：清除 localStorage 中的关闭状态。
2. **修改组件的 `key`**：强制 React 重新挂载组件，触发初始状态判断。

```tsx
const [noticeKey, setNoticeKey] = useState(0);

// 重新显示
const showNotice = () => {
  resetLocalDataNoticeDismissed();
  setNoticeKey((k) => k + 1);
};

<LocalDataNotice key={noticeKey} variant="banner" autoDismissState />;
```

---

### Q: 文案可以自定义吗？

不支持。设计上刻意统一文案，避免不同页面说法不一致。

如果需要调整文案，直接修改 `src/lib/local-data-notice.ts` 中的 `LOCAL_DATA_NOTICE` 常量。

---

### Q: 和 HelpPopover 有什么区别？

| 组件 | 用途 | 触发方式 |
|------|------|----------|
| `LocalDataNotice` | 本地数据存储提示（系统级告知） | 自动出现（或通过入口唤起） |
| `HelpPopover` | 功能使用说明（操作指导） | 用户主动点击"使用说明"按钮 |

两者场景不重叠，不要混用。
