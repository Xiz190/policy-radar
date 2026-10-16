# Adding a new domain

**English** · [中文](接入新领域.md)

The Radar engine doesn't care what domain it's watching. The pipeline (collect → store → score → LLM interpretation → display) stays the same; switching domains only touches the "domain configuration." This doc lists every one of those touch points in one place, then walks through plugging the engine into finance as an example.

What you never need to touch: scheduling in `runner.ts`, body extraction and fallbacks in `detail.ts`, the priority normalization algorithm, the inbox / dashboard / RAG frontend, and the PWA. What's actually tied to the domain is the 8 places below: 2 in the database and 6 in code.

## Checklist

| # | Where | What to change | What happens if you don't |
|---|------|--------|-----------|
| 1 | `src/lib/monitor/<new-source>-list.ts` + `runner.ts` (dispatches on `source.type`) | One fetcher per source, exporting `fetchXxxLatest(listUrl, limit) → {title, url, listPublishedAt}`, plus one line in runner: `if (t === "xxx_list") return fetchXxxLatest(...)`. Most government and list-style sites look alike, so `generic-government-list.ts` usually works as-is and you don't need a new one | No data from the new domain comes in |
| 2 | `src/lib/monitor/source-meta.ts` | Source directory: register the new domain's official sources (name, group, description) | The sources page still shows the old domain's directory |
| 3 | `src/lib/monitor/content-meta.ts` | The category system: the signal layer (A/B/C/D + implementation) and topic layer (`topic_*`) labels and colors in `CATEGORY_STYLE`. The comment at the top maps category ids to Chinese names | Cards carry the old domain's signal and topic tags |
| 4 | `src/lib/monitor/priority-score.ts` → `HIGH_WEIGHT_DEPARTMENTS` | Swap in the new domain's regulators and authoritative sources | **Core sources in the new domain systematically lose 10 points** and the ranking is skewed. This is the easiest one to miss, and the hardest to notice |
| 5 | `src/lib/monitor/department-meta.ts` → `DEPARTMENT_META` | Add rows for the new departments, with aliases and pinyin, so informal names (like "发改委" for the NDRC) still match | Searching or filtering by department misses the new sources |
| 6 | `src/lib/ai/content-analyzer.ts` (the system prompt in `buildSystemPrompt`) + `policy-analyzer.ts` | The LLM's persona and signal definitions. Right now they're hard-coded to "AI and digital-economy policy… MIIT / CAC / NDRC." Replace them with an analyst persona for the new domain, plus the `SIGNAL_*` definitions at the top | The LLM keeps reading everything through the old domain's lens and misses the point |
| 7 | `src/lib/monitor/channel-group.ts` → `CHANNEL_GROUPS` (optional) | Labels for grouping the inbox by section | Group names stay from the old domain. Not fatal |
| 8 | `src/lib/monitor/detail-mock.ts` / `mock.ts` (optional) | Sample articles for offline and demo mode | Demo mode shows old-domain samples. No effect once a real database is connected |

## Data vs. code: two of these aren't code changes

- **Keywords** live in the `monitor_keywords` table (`keywords.ts` reads them per department plus global). Switching domains means changing seed data or adding and removing rows in the admin page. No code.
- **The source list** lives in the `monitor_sources` table, and `runner.ts` dispatches on `source.type`. Adding a source of a type that's already supported is one row of data. You only write a fetcher (item 1) for a site with a structure the engine hasn't seen.

In other words: **adding sources and tuning keywords are operations work (data). Changing categories, weights or the LLM's lens is code work.** That line is on purpose: the things you adjust often live in data, and code only changes when the domain itself changes.

## Two data-layer levers for domain boundaries (added September 2026)

The early engine had a hidden problem: **there was no topic filter on ingest**. Every item from every enabled source went into the database. And the seed sources were a generic all-government bundle (21 ministries, 519 sections), so agricultural subsidies, tobacco and water management buried the items that actually mattered. The fix was two **purely data-layer** levers, which fit neatly inside the "switching domains only changes data" line above:

1. **Three states for sources (`monitor_sources.enabled` + a `notes` label)**: off-topic sources aren't deleted. They're set to `enabled=false` and labeled "reserve for other sectors." A disabled source isn't crawled, and item queries on the frontend all filter on `enabled=true` (hidden, not lost). The source management page still lists everything, and any source can be turned back on in one click. → **Switching domains = flipping which sources are active.** The whole library of government crawlers stays around as a reusable asset instead of being rebuilt from scratch.

2. **A domain gate (`monitor_keywords` rows with `department_name='__domain__'`)**: this is deliberately separate from the existing `__global__` signal words, which score items after they're in. `__domain__` is an **allowlist applied before ingest**: an item only gets in if its headline matches at least one domain word. An empty list means no filtering, which keeps the old behavior (see `passesDomainGate` in `runner.ts`). → **Switching domains = swapping this one `__domain__` word list**, which keeps administrative noise (personnel, procurement, general political news) from the remaining sources out of the database.

Together: **switching domains went from "change 6 places in code" to that plus two pure-data steps: which sources are active, and what the domain word list is.** Neither touches code. That's where "a reusable, domain-agnostic shell" stops being a slogan and becomes something you can check. In one measured crawl, 124 items were scanned, the gate filtered out 85 of them as administrative noise (69%), and everything that made it in was on-topic.

## Walkthrough: plugging in finance

1. Sources: the announcement pages of the People's Bank of China, the CSRC and the banking and insurance regulator are mostly static lists. Reuse `generic-government-list.ts` directly and add a few rows with `type: "generic_list"` to `monitor_sources`. No new fetcher needed.
2. `HIGH_WEIGHT_DEPARTMENTS`: replace with the PBOC, the CSRC, the National Financial Regulatory Administration and the Ministry of Finance.
3. `content-meta.ts`: keep the A/B/C/D signal meanings (strong constraint / strong support / risk / watch), and change the topic layer to monetary policy / capital markets / banking & insurance / cross-border.
4. `content-analyzer.ts`: change the persona to "financial policy analyst" and rewrite the signal definitions in financial terms.
5. Keywords: load a batch into `monitor_keywords` (interest rates, LPR, capital adequacy ratio, the registration-based IPO system…).

The frontend, the scoring algorithm and the crawl pipeline don't change by a single line.

## Known limits (roadmap, not defects)

The 6 code touch points above are still **hard-coded per domain**. They haven't been pulled into a single `domain config` module yet, so switching domains still means "fork the repo and change these 6 places," not "edit one config file."

That's a deliberate call. With only two instances, building a shared config layer would be architecture for its own sake, and it would cost more than it saves. **What's already proven is that the architecture is decoupled from the domain (the same engine has run policy, AI and music). Collapsing these 6 places into one domain config is the next step.** This doc is the hand-written version of that config: mark the extension seams clearly first, then decide whether to turn them into code.
