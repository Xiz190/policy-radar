# Radar · 领域无关的情报工作流框架

> 把「找 → 核实 → 关联 → 分析」这条情报工作流半自动化。**底座领域无关,领域配置决定视角**——同一台引擎,换个领域,就服务不同的用户。

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.x-black)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4.x-teal)](https://tailwindcss.com/)

---

## 它是什么

**Radar** 是一个领域无关的情报框架:统一的数据采集 → 存储 → 分析 → 可视化管道,配合**可插拔的「领域视角层」**,把同一份情报翻译成不同领域的专属视角。

> 底层跑的是同一套「找、核实、关联、分析」;区别只在最上面那层解读——**用谁的视角看**。

---

## 领域无关的证据:同一底座,三个领域

这个仓库保留了三套领域的数据源爬虫,它们同时跑在同一个底座上——这正是「领域无关」的铁证:

| 领域 | 数据源爬虫 |
|---|---|
| **政府部委** | miit(工信部)· mof(财政部)· mot(交通部)· mwr(水利部)· tobacco(烟草局)· mct(文旅部)· 北京政府 · 政府网 · 通用政府站 |
| **音乐文化** | 文旅部音乐文化栏目 · 文化政策 |
| **AI 工具** | 见实例仓库 [创作者雷达 Creator Radar](https://github.com/Xiz190/creator-radar) |

换一个领域,只需加一组 list 爬虫 + 一套领域配置(分类 / 关键词 / prompt),底座不变。具体要动哪几处、不动会怎样,见 [`docs/接入新领域.md`](docs/接入新领域.md)——把扩展缝逐一标清的"人肉版 domain config"。

---

## 架构:list + runner

数据采集的核心是「list 文件 + runner 注册」模式,天然可扩展到任意新源:

```
list 文件(每个源一个抓取器)
  └─ fetchXxxLatest(listUrl) → { title, url, listPublishedAt }
        ↓
runner 统一调度(按 source.type 分发)
  └─ 列表抓取 → 详情抓取 → 关键词/信号扫描 → 入库
        ↓
视角层(可插拔)
  └─ 用领域知识把情报翻译成该领域的视角
```

> **数据来源与采集方法、已知局限**见应用内 `/sources` 页(按采集方式分组:静态页 / SPA 逆向接口 / 已排除,含每个源的难点与接入状态)。
> 采集能力字典是单一真相源,在 [`src/lib/monitor/source-capability.ts`](src/lib/monitor/source-capability.ts) —— 页面由它自动汇总,改字典即改页面。

---

## 实例

| 实例 | 仓库 | 领域视角 |
|---|---|---|
| **创作者雷达** · Creator Radar | [`creator-radar`](https://github.com/Xiz190/creator-radar) | 给独立创作者:AI 工具动态 → "对做音乐/做 MV 意味着什么" |
| **政策雷达** · Policy Radar | 本仓库(政策领域) | 给政策分析:政务信息 → 信号识别、优先级、结构化解读 |

---

## 技术栈

| 分类 | 技术 |
|---|---|
| 框架 | Next.js 16(App Router)+ TypeScript 5 |
| 数据库 | PostgreSQL 16 |
| 样式 | Tailwind CSS 4 |
| 测试 | Vitest |

---

## 快速开始

```bash
npm install
cp .env.local.example .env.local   # 配置 DATABASE_URL
npm run dev                        # 开发模式
npm run build                      # 生产构建
npm run test                       # 单元测试
```

---

## 合规声明

所有数据来自**公开接口 / 公开 RSS / 公开网页**,不涉及登录、绕过反爬、或抓取任何私密数据。

---

## License

MIT
