# Radar · A Domain-Agnostic Intelligence Framework

**English** · [中文](README.zh-CN.md)

> A domain-agnostic AI intelligence engine. Underneath, it always runs the same workflow: find, verify, connect, analyze. Swap the "domain lens" on top and it serves a different kind of user. Same information, different lens, different meaning.

**Live demo (policy instance)**: <https://policy-radar-xiz.vercel.app> (demo mode: visitors can browse, search and use the Q&A assistant; editing and the admin pages are author-only. The interface is in Chinese because all the sources are Chinese government websites.)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.x-black)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4.x-teal)](https://tailwindcss.com/)

---

## What it is

It isn't a tool for one particular field. It's a domain-agnostic intelligence framework.

Underneath is a single data pipeline (collect, store, analyze, visualize) running the same semi-automated intelligence workflow: find, verify, connect, analyze.

The only thing that changes is the top layer: a pluggable **domain lens**. To move to a new field, you swap the configuration (sources, categories, keywords, prompts). The engine stays the same.

There are two instances so far:

| Instance | Repo | Lens |
|---|---|---|
| **Policy Radar** | This repo | Tracks government releases on AI and the digital economy (AI, computing power, data as a production factor, the platform economy and so on), with signal detection, priority ranking and structured summaries |
| **Creator Radar** | [`creator-radar`](https://github.com/Xiz190/creator-radar) | For independent musicians: tracks AI tool and industry news, and adds one line on what each update means for making music or MVs |

A real item from Creator Radar:

> ElevenLabs unveils 'Music v2.5' – but UMG wasn't involved  
> **Creator lens:** The UMG carve-out matters more than the model: your vocals and mixes aren't the licensed part, so read the terms before you upload.

Point it at yet another field, say independent investors, and with a new configuration the same update could read as "what this means for my holdings and my sector."

---

## The policy instance in this repo

**Sources currently running**:

| Focus | Sources |
|---|---|
| AI and digital economy policy | Ministry of Industry and Information Technology · Cyberspace Administration of China · State Council (gov.cn) · Beijing municipal government, city departments and some district governments |
| Cultural policy | Ministry of Culture and Tourism · National Copyright Administration |

The code also keeps crawlers for other ministries, such as Transport, Water Resources, Tobacco and Ecology and Environment. They're switched off because they fall outside the current focus, but they show that adding a new ministry only takes one more crawler. The engine doesn't change.

To plug in a completely new field, [`docs/adding-a-new-domain.md`](docs/adding-a-new-domain.md) lists every place you'd need to change and what breaks if you don't. Think of it as a hand-written domain config guide.

---

## Architecture: list + runner

Data collection is built on a "list file + runner registration" pattern, so every new source plugs in the same way:

```
List files (one crawler per source)
  └─ fetchXxxLatest(listUrl) → { title, url, listPublishedAt }
        ↓
Runner (dispatches by source.type)
  └─ list crawl → detail crawl → keyword / signal scan → database
        ↓
Domain lens (pluggable)
  └─ uses domain knowledge to turn raw items into that field's point of view
```

> **Sources, collection methods and known limitations** are on the in-app `/sources` page, grouped by method (static pages, reverse-engineered single-page-app endpoints, excluded), with the difficulty and status of each source.
> The capability dictionary in [`src/lib/monitor/source-capability.ts`](src/lib/monitor/source-capability.ts) is the single source of truth. The page is generated from it, so editing the dictionary updates the page.

---

## How this was built

This is where it all started. I'm an ICAM (Interdisciplinary Computing and the Arts) student at UC San Diego, not a software engineer by training.

During an internship, I had to summarize what was happening in one field over a period of time and work out how it connected to the company's business. That meant digging through documents on dozens of official websites by hand, then keeping an eye on them for updates and related information. It took forever. So I built myself a small tool: it watched those sites on a schedule, pulled up the original documents quickly, and passed them to an LLM to analyze based on the official text. It was my own way of working, not a company product, and this version was rebuilt independently from scratch afterwards, with no company code or data.

I also added links between related documents. A lot of these sites build on or follow up on each other, so every item links to others on the same topic, from the same source, or that cite each other, so you can read them together.

Later I realized the engine had nothing to do with policy. Underneath it was always find, verify, connect, analyze; only the top layer, whose point of view you read it from, changed. So I split it into a domain-agnostic base, with policy as just one instance, and built [Creator Radar](https://github.com/Xiz190/creator-radar) for music creators on the same base.

**What I was responsible for**: framing the problem, the architecture idea of separating the engine from the domain lens, which sources to include, which idle or off-topic sources to switch off, the category and priority rules, and the interface direction.

**What AI did**: most of the code was written by Claude Code (Anthropic) to my specifications. I reviewed the changes, ran and checked the tests, decided what shipped, and regularly opened the original pages to check that what the crawler pulled matched the source.

**Next**: pushing updates to WeChat and Feishu (Lark), and connecting AI agents like OpenClaw so they can analyze the feed as a whole.

---

## Tech stack

| Area | Technology |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript 5 |
| Database | PostgreSQL 16 |
| Styling | Tailwind CSS 4 |
| Testing | Vitest (769 tests) |

---

## Quick start

You'll need Node.js and PostgreSQL 16. An LLM API key is optional.

```bash
npm install
cp .env.local.example .env.local                  # fill in DATABASE_URL; LLM_* only if you want the LLM features

createdb policy_radar                             # any name, just match DATABASE_URL
psql -d policy_radar -f schema.sql                # create tables
psql -d policy_radar -f policy-seed.sql           # add the sources and keywords used in production

npx tsx --env-file=.env.local scripts/crawl.ts    # one crawl (lots of sources, takes a while)
npm run dev                                       # open http://localhost:3000
```

- **The LLM is optional.** Crawling and scoring don't call it; the Q&A assistant and policy analysis do. Without a key they fall back to keyword rules instead of failing. Any OpenAI-compatible API works (DeepSeek, OpenAI, etc.). It's usually pay-as-you-go on your own key. See section 2 of `.env.local.example`.
- `init-data.sql` is the original small seed (a few dozen sources) and is out of date. `policy-seed.sql` covers everything.
- There are three env templates: `.env.local.example` for local development, `.env.docker.example` for Docker, and `.env.example`, a shorter subset of the first.
- **Demo mode**: the live demo is read-only for visitors via `PUBLIC_DEMO=1` plus `ADMIN_TOKEN`. The author unlocks everything at `/unlock`. See section 3 of `.env.local.example`. Leave it off for local development.
- **Scheduling is up to you.** This public repo ships without a scheduled job. The live demo crawls twice a day from the author's private deployment, since that needs database credentials and keys. For your own setup, run `scripts/crawl.ts` on a timer (cron, GitHub Actions, etc.).

Other commands: `npm run build` (production build), `npm run test` (unit tests).

---

## Compliance

All data comes from **public APIs, public RSS feeds and public web pages**. No logins, no getting around anti-bot protection, no private data.

---

## License

MIT
