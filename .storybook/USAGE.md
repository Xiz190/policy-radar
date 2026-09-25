# LocalDataNotice Storybook 使用指南

本文档说明如何使用 Storybook 预览和调试 `LocalDataNotice` 组件的三种模式及所有 Props。

---

## 目录

- [启动 Storybook](#启动-storybook)
- [界面概览](#界面概览)
- [切换模式](#切换模式)
- [控制 Props](#控制-props)
- [常用操作](#常用操作)
- [故障排除](#故障排除)

---

## 启动 Storybook

```bash
cd <项目目录>
npm run storybook
```

访问地址：**http://localhost:6006**

---

## 界面概览

Storybook 界面分为三个区域：

```
┌─────────────────────────────────────────────────────────────────┐
│  Top Toolbar                                                    │
│  ┌─────────────┬─────────────┬────────────────────────────────┐ │
│  │ Reload      │ Viewport    │ Zoom  | Background | Isolation │ │
│  └─────────────┴─────────────┴────────────────────────────────┘ │
├──────────────────┬──────────────────────────────────────────────┤
│                  │                                              │
│  Left Panel      │              Main Preview Area               │
│  (Navigation)    │           (组件渲染区域)                      │
│                  │                                              │
│  ┌─────────────┐ │                                              │
│  │ Components  │ │  ┌──────────────────────────────────────┐   │
│  │ └ LocalData │ │  │  LocalDataNotice 组件实时预览        │   │
│  │     Notice  │ │  │                                      │   │
│  │   ├ Banner  │ │  │  数据当前保存在本地浏览器            │   │
│  │   ├ Card    │ │  │  你的关注设置...                    │   │
│  │   └ Footer  │ │  │                                      │   │
│  └─────────────┘ │  └──────────────────────────────────────┘   │
│                  │                                              │
├──────────────────┼──────────────────────────────────────────────┤
│                  │                                              │
│                  │       Bottom Panel (可选)                     │
│                  │       ┌──────────────────────────────────┐   │
│                  │       │ Controls | Actions | Docs        │   │
│                  │       │ (Props 控制面板)                  │   │
│                  │       └──────────────────────────────────┘   │
│                  │                                              │
└──────────────────┴──────────────────────────────────────────────┘
```

---

## 切换模式

在左侧导航面板中，点击 `Components/LocalDataNotice` 下的不同 story 即可切换模式：

| Story 名称 | 说明 |
|-----------|------|
| **Banner** | 顶部通栏模式（基础用法） |
| **BannerWithGuideEntry** | 设置页专用：关闭后显示「查看数据说明」入口 |
| **Footer** | 页脚弱提示模式 |
| **Card** | 首次进入引导卡片模式 |
| **NotDismissible** | 不可关闭模式（无关闭按钮） |

### 快捷访问链接

| 模式 | 链接 |
|------|------|
| Banner | http://localhost:6006/?path=/story/components-localdatanotice--banner |
| BannerWithGuideEntry | http://localhost:6006/?path=/story/components-localdatanotice--banner-with-guide-entry |
| Footer | http://localhost:6006/?path=/story/components-localdatanotice--footer |
| Card | http://localhost:6006/?path=/story/components-localdatanotice--card |
| NotDismissible | http://localhost:6006/?path=/story/components-localdatanotice--not-dismissible |

---

## 控制 Props

在右下角 **Controls** 面板中，可以实时调整组件的 Props，预览效果会即时更新。

### Props 列表

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| **variant** | `select` | `banner` | 展示模式：`banner` / `footer` / `card` |
| **dismissible** | `boolean` | `true` | 是否可关闭 |
| **showPrimaryAction** | `boolean` | `true` | 是否显示「我知道了」主按钮 |
| **showSecondaryAction** | `boolean` | `false` | 是否显示「了解更多」次按钮 |
| **showGuideEntry** | `boolean` | `false` | 关闭后是否显示「查看数据说明」入口（仅 banner 有效） |
| **autoDismissState** | `boolean` | `false` | 是否启用 localStorage 持久化 |

### 操作方法

1. **切换 variant**：点击下拉菜单选择 `banner` / `footer` / `card`
2. **开关 boolean 值**：点击圆形开关切换 `true` / `false`
3. **查看当前值**：鼠标悬停在控件上会显示当前值
4. **重置**：点击 Controls 面板顶部的 **Reset** 按钮恢复默认值

### 常用组合

| 场景 | variant | showPrimaryAction | showSecondaryAction | showGuideEntry | autoDismissState |
|------|---------|-------------------|---------------------|----------------|------------------|
| 设置页顶部 | `banner` | ✅ | ✅ | ✅ | ✅ |
| 通知中心底部 | `footer` | ❌ | ✅ | ❌ | ✅ |
| 首次进入引导 | `card` | ✅ | ✅ | ❌ | ✅ |
| 强制提示 | `banner` | ✅ | ❌ | ❌ | ❌ |

---

## 常用操作

### 顶部工具栏

| 按钮 | 功能 |
|------|------|
| 🔄 **Reload** | 重新加载当前 story |
| 📱 **Viewport** | 切换不同屏幕尺寸（320px ~ 1280px） |
| 🔍 **Zoom** | 调整预览区域缩放比例 |
| 🎨 **Background** | 切换背景色（Light / Dark） |
| 📦 **Isolation** | 全屏独立预览当前组件 |
| 📐 **Measure** | 显示组件尺寸测量工具 |
| 🧠 **Outline** | 显示组件层级轮廓 |

### 常用技巧

1. **独立预览**：点击顶部工具栏的 **Isolation** 按钮，全屏查看组件，不受其他面板干扰
2. **切换背景**：点击 **Background** 按钮，在亮色/暗色背景下验证组件对比度
3. **响应式测试**：点击 **Viewport** 按钮，选择不同设备尺寸（如 iPhone 14、iPad、Desktop）验证响应式表现
4. **查看文档**：切换底部面板到 **Docs** 标签，查看组件的完整 API 文档和代码示例
5. **复制代码**：在 **Docs** 标签中，点击代码块右上角的复制按钮，快速复制组件使用代码

---

## 交互测试

在 Storybook 中可以直接与组件交互：

### Banner 模式测试

1. 点击「以后再说」→ 组件关闭（`showGuideEntry=true` 时显示入口）
2. 点击「我知道了」→ 组件关闭
3. 点击「了解更多」→ 触发 `onSecondaryAction` 回调
4. 点击「查看数据说明」→ 组件重新展开（仅 `showGuideEntry=true`）

### Footer 模式测试

1. 点击「了解更多」→ 触发 `onSecondaryAction` 回调
2. 点击 `×` → 组件关闭

### Card 模式测试

1. 点击右上角 `×` → 组件关闭
2. 点击「我知道了」→ 组件关闭
3. 点击「了解更多」→ 触发 `onSecondaryAction` 回调

---

## 持久化测试

当 `autoDismissState=true` 时，可以测试关闭状态的持久化：

1. 在 Controls 面板中开启 `autoDismissState`
2. 点击关闭按钮
3. 刷新页面 → 组件保持关闭状态
4. 要重新显示：
   - 关闭 `autoDismissState` 开关
   - 或打开浏览器控制台执行：`localStorage.removeItem('local_data_notice_dismissed_v1')`

---

## 故障排除

### 组件不显示

**原因**：`autoDismissState=true` 且之前关闭过组件，localStorage 中保留了关闭状态。

**解决**：
1. 在 Controls 面板中关闭 `autoDismissState` 开关
2. 或执行：`localStorage.removeItem('local_data_notice_dismissed_v1')`

### 样式不生效

**原因**：Tailwind CSS 未正确加载。

**解决**：确认 `.storybook/preview.tsx` 中已引入 `../src/app/globals.css`。

### 交互无响应

**原因**：部分 story 使用了自定义 render 函数，某些 props 可能被覆盖。

**解决**：查看 story 代码确认实际传入的 props 值。

### Footer 图标显示异常

**原因**：Storybook iframe 环境对 emoji 渲染有限制。

**解决**：这是 Storybook 环境问题，组件在正常页面中渲染正常，无需修复。

---

## 文件结构

| 文件 | 用途 |
|------|------|
| `.storybook/main.ts` | Storybook 主配置（stories 路径、addons） |
| `.storybook/preview.tsx` | 预览配置（全局样式、参数） |
| `src/components/local-data-notice.stories.tsx` | LocalDataNotice 的 story 定义 |
| `src/components/local-data-notice.tsx` | 组件实现 |

---

## 扩展 Story

如需添加新的 story，在 `local-data-notice.stories.tsx` 中添加：

```typescript
export const MyNewStory: Story = {
  args: {
    variant: "banner",
    showPrimaryAction: true,
    // ... 其他 props
  },
  parameters: {
    docs: {
      description: {
        story: "我的新场景描述",
      },
    },
  },
};
```
