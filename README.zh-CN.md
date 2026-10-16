# Radar · 领域无关的情报工作流框架

**中文** · [English](README.md)

> 一套领域无关的 AI 情报引擎：底层跑同一套「找 → 核实 → 关联 → 分析」，上面换一层「领域视角」，就服务不同的人。同一份情报，换个视角，读出来的意义就不同。

**在线演示（政策实例）**：<https://policy-radar-xiz.vercel.app>（演示模式：访客可浏览、搜索、使用问答助手；写操作与管理后台仅作者可用。界面为中文，因为数据源都是中文官网）

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.x-black)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4.x-teal)](https://tailwindcss.com/)

---

## 它是什么

它不是某一个领域的工具，而是一个领域无关的情报框架。

底层是统一的数据管道：采集 → 存储 → 分析 → 可视化，跑的是同一套「找 → 核实 → 关联 → 分析」的情报工作流，只是半自动化了。

区别只在最上面那层：可插拔的「领域视角层」。换一个领域，就换一套配置（数据源、分类、关键词、提示词），引擎不动。

目前有两个实例：

| 实例 | 仓库 | 领域视角 |
|---|---|---|
| **政策雷达** · Policy Radar | 本仓库 | 盯 AI 与数字经济相关的政府发布（AI、算力、数据要素、平台经济等），做信号识别、优先级排序和结构化解读 |
| **创作者雷达** · Creator Radar | [`creator-radar`](https://github.com/Xiz190/creator-radar) | 给独立音乐人：盯 AI 工具和行业动态，每条附一句「这对你做音乐、做 MV 意味着什么」 |

创作者雷达的一条示例：

> ElevenLabs unveils ‘Music v2.5’ – but UMG wasn’t involved  
> 〔创作者视角〕盯它人声和声学乐器的真实度，拿它出编曲草稿，人声和混音还得你自己收尾。

再换一个领域，比如独立投资者，只要换一套配置，同一份动态就可以读成「这对我的持仓和赛道意味着什么」。

---

## 本仓库里的政策实例

**目前在跑的数据源**：

| 方向 | 来源 |
|---|---|
| AI 与数字经济政策 | 工信部 · 网信办 · 国务院（中国政府网）· 北京市政府、市级部门和部分区政府 |
| 文化政策 | 文旅部 · 国家版权局 |

代码里还保留了交通部、水利部、烟草局、生态环境部等部委的抓取器。它们和当前关注的方向无关，所以已经停用，但留着说明：接入一个新部委，只需要加一个抓取器，底座不用改。

想接入一个全新的领域，要改哪几处、不改会怎样，见 [`docs/接入新领域.md`](docs/接入新领域.md)。它把每一处需要替换的地方都标了出来，相当于一份手写版的「领域配置」说明。

---

## 架构：list + runner

数据采集的核心是「list 文件 + runner 注册」模式，接入任何新来源都走同一套流程：

```
list 文件（每个来源一个抓取器）
  └─ fetchXxxLatest(listUrl) → { title, url, listPublishedAt }
        ↓
runner 统一调度（按 source.type 分发）
  └─ 列表抓取 → 详情抓取 → 关键词 / 信号扫描 → 入库
        ↓
视角层（可插拔）
  └─ 用领域知识把情报翻译成该领域的视角
```

> **数据来源、采集方法和已知局限**见应用内的 `/sources` 页（按采集方式分组：静态页 / 单页应用逆向接口 / 已排除，并写明每个来源的难点和接入状态）。
> 采集能力字典是唯一的数据来源，在 [`src/lib/monitor/source-capability.ts`](src/lib/monitor/source-capability.ts)。页面由它自动生成，改字典就等于改页面。

---

## 这个项目是怎么做出来的

一切从这里开始。我是 UC San Diego ICAM（跨学科计算与艺术）专业的学生，不是科班出身的软件工程师。

实习期间，我需要对某个领域一段时间内的动态做总结，并梳理它和公司业务的关联。这意味着要人工翻几十个官方网站上的相关文件，还要持续关注它们后续有没有更新、有没有相关联的信息，非常花时间。于是我给自己做了一个小工具：定时盯这些网站，把原文快速找出来，再交给 LLM 基于官方原文做分析。它是我个人的工作方法，不是公司的产品；现在这个版本是之后独立从零重做的，不含任何公司的代码或数据。

我还加入了「相关文档」的连接：很多网站之间有联动或前后承接，所以每条内容会连到同一主题、同一来源、互相引用的其他内容，方便放在一起看。

后来我发现，这套引擎其实跟政策没有关系：底层都是「找、核实、关联、分析」，区别只在最上面那层用谁的视角来解读。所以我把它拆成了领域无关的底座，政策只是它的一个实例；又在同一个底座上做出了面向音乐创作者的[创作者雷达](https://github.com/Xiz190/creator-radar)。

**我负责的部分**：问题怎么定义、把底座和领域视角分开的架构思路、收哪些数据源、停用哪些空转或无关的来源、分类和优先级规则，以及界面方向。

**AI 做的部分**：大部分代码是 Claude Code（Anthropic）按我的要求写的。我负责审阅改动、运行和检查测试、决定上线什么，并定期打开原网页核对爬下来的内容是否和原文一致。

**下一步**：把情报推送到微信、飞书，并接入 OpenClaw（龙虾）这类 AI 代理，让它们能在这些情报的基础上做整体分析。

---

## 技术栈

| 分类 | 技术 |
|---|---|
| 框架 | Next.js 16（App Router）+ TypeScript 5 |
| 数据库 | PostgreSQL 16 |
| 样式 | Tailwind CSS 4 |
| 测试 | Vitest（769 个用例） |

---

## 快速开始

需要准备：Node.js、PostgreSQL 16。大模型 API key 可选。

```bash
npm install
cp .env.local.example .env.local                  # 填 DATABASE_URL；要用大模型再填 LLM_*

createdb policy_radar                             # 库名随意，和 DATABASE_URL 对上
psql -d policy_radar -f schema.sql                # 建表
psql -d policy_radar -f policy-seed.sql           # 写入线上在用的数据源和关键词

npx tsx --env-file=.env.local scripts/crawl.ts    # 抓一轮（来源多，要跑一会儿）
npm run dev                                       # 打开 http://localhost:3000
```

- **大模型是可选的**：抓取和打分不调用大模型；问答助手和政策分析会用到。不配 key 时会降级为关键词规则，不会崩。要用的话，任何 OpenAI 兼容接口都可以（DeepSeek、OpenAI 等），一般按用量付费，用的是你自己的 key。配置示例见 `.env.local.example` 第 2 节。
- `init-data.sql` 是最早的一小份初始数据（几十个源），已经跟不上线上配置了，用 `policy-seed.sql` 就够了。
- 环境变量示例有三份：本地开发用 `.env.local.example`；用 Docker 部署用 `.env.docker.example`；`.env.example` 是精简版，内容是前者的子集。
- **演示模式**：在线演示里访客只能浏览，靠的是 `PUBLIC_DEMO=1` 加 `ADMIN_TOKEN`。作者在 `/unlock` 页输入口令后解锁全部功能。说明见 `.env.local.example` 第 3 节；本地开发不用开。
- **定时抓取需要自己配**：这个公开仓库不带定时任务。在线演示每天抓两次，定时任务放在作者的私有部署里跑，因为它要用到数据库地址和密钥。自己部署时，可以用 cron、GitHub Actions 等方式定时运行 `scripts/crawl.ts`。

其他命令：`npm run build`（生产构建）、`npm run test`（单元测试）。

---

## 合规声明

所有数据来自**公开接口 / 公开 RSS / 公开网页**，不涉及登录、绕过反爬，也不抓取任何私密数据。

---

## License

MIT
