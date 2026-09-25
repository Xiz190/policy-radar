import { NextResponse } from "next/server";
import { requireAdminToken } from "@/lib/db";
import { createMonitorSource, ensureMonitorSchema, getMonitorSources } from "@/lib/monitor/db";
import type { MonitorSourceRecord, MonitorSourceType } from "@/lib/monitor/types";

export const dynamic = "force-dynamic";

type ParsedRow = {
  departmentName: string;
  channelGroup: string | null;
  channelName: string;
  displayName: string;
  type: MonitorSourceType;
  listUrl: string;
  startDate: string;
  maxItems: number;
  enabled: boolean;
  autoMonitor: boolean;
  isKey: boolean;
  notes: string;
};

const DEFAULT_START_DATE = "2026-05-05";
const DEFAULT_MAX_ITEMS = 10;
const SUPPORTED_TYPES: MonitorSourceType[] = ["mct_szyw", "mct_zwgk_genre"];

function normalizeType(raw: string | undefined | null): MonitorSourceType {
  if (!raw) return "mct_zwgk_genre";
  const lower = raw.toString().trim().toLowerCase();
  if (lower === "mct_szyw" || lower === "szyw" || lower.includes("szyw") || lower.includes("时政")) {
    return "mct_szyw";
  }
  return "mct_zwgk_genre";
}

function toBool(raw: string | boolean | undefined | null, fallback: boolean = false): boolean {
  if (typeof raw === "boolean") return raw;
  if (raw === undefined || raw === null) return fallback;
  const s = raw.toString().trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes" || s === "y" || s === "on") return true;
  if (s === "false" || s === "0" || s === "no" || s === "n" || s === "off") return false;
  return fallback;
}

function toDate(raw: string | undefined | null): string {
  if (!raw) return DEFAULT_START_DATE;
  const s = raw.toString().trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return DEFAULT_START_DATE;
}

function toMaxItems(raw: string | number | undefined | null): number {
  if (raw === undefined || raw === null || raw === "") return DEFAULT_MAX_ITEMS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_MAX_ITEMS;
  return Math.min(Math.floor(n), 500);
}

/**
 * 解析简化文本格式（列顺序：来源 | 大板块 | 栏目 | 网址 [ | 类型 | 起始日期 | 最大条数 | 启用 | 自动监测 | 重点关注 | 显示名 | 备注 ]）。
 * - 若只有 3 列（来源 | 栏目 | 网址），视为未填写大板块（channelGroup = null）。
 * - 若只有 1 列且是 URL，创建为 "待补充来源 / 待补充栏目 / URL"。
 */
function parseRawText(raw: string): ParsedRow[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  const headerKeywords = [
    "来源", "平台", "大板块", "板块", "栏目", "网址", "链接",
    "department", "channel", "channelGroup", "channel_group", "group", "url", "listUrl",
  ];

  const rows: ParsedRow[] = [];
  for (const line of lines) {
    let parts: string[];
    if (line.includes("|")) {
      parts = line.split("|").map((p) => p.trim());
    } else if (line.includes("\t")) {
      parts = line.split("\t").map((p) => p.trim());
    } else if (line.includes(",")) {
      parts = line.split(",").map((p) => p.trim());
    } else if (line.includes(";")) {
      parts = line.split(";").map((p) => p.trim());
    } else {
      const tokens = line.split(/\s{2,}|\s+/).filter(Boolean);
      if (tokens.length >= 3 && /^https?:\/\//i.test(tokens[tokens.length - 1])) {
        parts = tokens;
      } else {
        parts = [line];
      }
    }

    // 跳过表头行
    if (rows.length === 0 && parts.some((p) => headerKeywords.includes(p.toLowerCase()))) continue;

    // 场景 A：仅 URL
    if (parts.length === 1 && /^https?:\/\//i.test(parts[0])) {
      const url = parts[0].trim();
      rows.push({
        departmentName: "待补充部委",
        channelGroup: null,
        channelName: "待补充栏目",
        displayName: "",
        type: "mct_zwgk_genre",
        listUrl: url,
        startDate: DEFAULT_START_DATE,
        maxItems: DEFAULT_MAX_ITEMS,
        enabled: true,
        autoMonitor: false,
        isKey: false,
        notes: "",
      });
      continue;
    }

    // 场景 B：找 URL 列，前面按「部委 / 大板块 / 栏目」的顺序解析
    let urlCol = -1;
    for (let i = 0; i < parts.length; i++) {
      if (/^https?:\/\//i.test(parts[i])) {
        urlCol = i;
        break;
      }
    }

    let departmentName = "";
    let channelGroup: string | null = null;
    let channelName = "";
    let listUrl = "";
    let rest: string[] = [];

    if (urlCol >= 3) {
      // 有大板块：部委 | 大板块 | 栏目 | URL
      departmentName = parts[0];
      channelGroup = parts[1];
      channelName = parts.slice(2, urlCol).join(" ");
      listUrl = parts[urlCol];
      rest = parts.slice(urlCol + 1);
    } else if (urlCol === 2) {
      // 部委 | 栏目 | URL（未填写大板块）
      departmentName = parts[0];
      channelName = parts[1];
      listUrl = parts[urlCol];
      rest = parts.slice(urlCol + 1);
    } else if (parts.length >= 4 && urlCol < 0) {
      // 没找到 http 开头，可能是纯域名；退回：部委 | 大板块 | 栏目 | 第 4 列 作为 URL
      departmentName = parts[0];
      channelGroup = parts[1];
      channelName = parts[2];
      listUrl = parts[3];
      rest = parts.slice(4);
    } else if (parts.length >= 3 && urlCol < 0) {
      departmentName = parts[0];
      channelName = parts[1];
      listUrl = parts[2];
      rest = parts.slice(3);
    } else {
      continue;
    }

    if (!departmentName || !channelName || !listUrl) continue;

    rows.push({
      departmentName,
      channelGroup: channelGroup && channelGroup.trim() ? channelGroup.trim() : null,
      channelName,
      displayName: rest[6] ?? "",
      type: normalizeType(rest[0]),
      listUrl,
      startDate: toDate(rest[1]),
      maxItems: toMaxItems(rest[2]),
      enabled: rest[3] === undefined ? true : toBool(rest[3], true),
      autoMonitor: toBool(rest[4], false),
      isKey: toBool(rest[5] ?? "", false),
      notes: rest[7] ?? "",
    });
  }
  return rows;
}

/**
 * 解析 CSV/TSV。
 * 新增列：channelGroup / 大板块 / 板块
 */
function parseCSVText(csvText: string): ParsedRow[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const separator = lines[0].includes("\t") ? "\t" : ",";

  function splitRow(row: string): string[] {
    const out: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (inQuote) {
        if (ch === '"') {
          if (row[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuote = false;
          }
        } else {
          cur += ch;
        }
      } else {
        if (ch === '"') {
          inQuote = true;
        } else if (ch === separator) {
          out.push(cur);
          cur = "";
        } else {
          cur += ch;
        }
      }
    }
    out.push(cur);
    return out.map((c) => c.trim());
  }

  const header = splitRow(lines[0]).map((h) => h.toLowerCase());
  const colIdx: Record<string, number> = {};
  for (let i = 0; i < header.length; i++) colIdx[header[i]] = i;

  function get(map: Record<string, number>, names: string[]): (cells: string[]) => string {
    return (cells) => {
      for (const n of names) {
        const idx = map[n];
        if (idx !== undefined && cells[idx] !== undefined) return cells[idx];
      }
      return "";
    };
  }

  const g = get;
  const getDept = g(colIdx, ["departmentname", "department_name", "department", "部委"]);
  const getGroup = g(colIdx, ["channelgroup", "channel_group", "channelgroup", "group", "板块", "大板块"]);
  const getChannel = g(colIdx, ["channelname", "channel_name", "channel", "栏目"]);
  const getUrl = g(colIdx, ["listurl", "list_url", "url", "网址", "链接"]);
  const getType = g(colIdx, ["type", "类型"]);
  const getStartDate = g(colIdx, ["startdate", "start_date", "起始日期", "日期"]);
  const getMaxItems = g(colIdx, ["maxitems", "max_items", "最大条数", "条数"]);
  const getEnabled = g(colIdx, ["enabled", "启用"]);
  const getAutoMonitor = g(colIdx, ["automonitor", "auto_monitor", "automaticallymonitor", "自动监测"]);
  const getIsKey = g(colIdx, ["iskey", "is_key", "重点", "重点关注"]);
  const getDisplayName = g(colIdx, ["displayname", "display_name", "显示名", "显示名称"]);
  const getNotes = g(colIdx, ["notes", "note", "remark", "备注"]);

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitRow(lines[i]);
    const departmentName = getDept(cells);
    const channelName = getChannel(cells);
    const listUrl = getUrl(cells);
    if (!departmentName || !channelName || !listUrl) continue;
    const rawGroup = getGroup(cells);
    rows.push({
      departmentName,
      channelGroup: rawGroup && rawGroup.trim() ? rawGroup.trim() : null,
      channelName,
      displayName: getDisplayName(cells),
      type: normalizeType(getType(cells)),
      listUrl,
      startDate: toDate(getStartDate(cells)),
      maxItems: toMaxItems(getMaxItems(cells)),
      enabled: getEnabled(cells) === "" ? true : toBool(getEnabled(cells), true),
      autoMonitor: toBool(getAutoMonitor(cells), false),
      isKey: toBool(getIsKey(cells), false),
      notes: getNotes(cells),
    });
  }
  return rows;
}

export async function POST(request: Request) {
  const auth = requireAdminToken(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  await ensureMonitorSchema();

  let mode: "text" | "csv" | "json" = "text";
  let rows: ParsedRow[] = [];
  const errorMessages: string[] = [];

  const contentType = request.headers.get("content-type") || "";
  const isForm = contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded");

  try {
    if (isForm) {
      const form = await request.formData();
      const rawMode = (form.get("mode") as string) || "text";
      if (rawMode === "csv" || rawMode === "text" || rawMode === "json" || rawMode === "urls") {
        mode = rawMode === "urls" ? "text" : rawMode;
      }
      const skipExisting = (form.get("skipExisting") as string) !== "false";
      const file = form.get("file") as File | null;

      if (file) {
        const text = await file.text();
        const name = (file.name || "").toLowerCase();
        if (name.endsWith(".csv") || name.endsWith(".tsv")) {
          rows = parseCSVText(text);
        } else {
          rows = parseRawText(text);
        }
      } else {
        const raw = (form.get("content") as string) || "";
        rows = mode === "csv" ? parseCSVText(raw) : parseRawText(raw);
      }

      const result = await persistRows(rows, skipExisting);
      return NextResponse.json({ ok: true, ...result });
    }

    const body = (await request.json()) as Record<string, unknown>;
    if (Array.isArray(body.sources)) {
      rows = body.sources
        .map((s: Record<string, unknown>) => ({
          departmentName: String(s.departmentName ?? ""),
          channelGroup: s.channelGroup ? String(s.channelGroup).trim() : null,
          channelName: String(s.channelName ?? ""),
          displayName: String(s.displayName ?? ""),
          type: normalizeType(s.type as string | undefined | null),
          listUrl: String(s.listUrl ?? ""),
          startDate: toDate(s.startDate as string | undefined | null),
          maxItems: toMaxItems(s.maxItems as string | number | undefined | null),
          enabled: toBool(s.enabled as string | boolean | undefined | null, true),
          autoMonitor: toBool(s.autoMonitor as string | boolean | undefined | null, false),
          isKey: toBool(s.isKey as string | boolean | undefined | null, false),
          notes: String(s.notes ?? ""),
        }))
        .filter((r) => r.departmentName && r.channelName && r.listUrl);
    } else if (typeof body.content === "string") {
      rows = parseRawText(body.content);
    }
    const skipExisting = body.skipExisting !== false;
    const result = await persistRows(rows, skipExisting);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e), errors: errorMessages },
      { status: 400 },
    );
  }
}

async function persistRows(rows: ParsedRow[], skipExisting: boolean) {
  const existing: MonitorSourceRecord[] = await getMonitorSources();
  const existingKey = new Set(existing.map((s) => `${s.departmentName}|${s.channelGroup ?? ""}|${s.channelName}|${s.listUrl}`.toLowerCase()));

  const created: Array<{ id: string; displayName: string }> = [];
  const skipped: Array<{ line: number; reason: string; row: { departmentName: string; channelGroup: string | null; channelName: string; listUrl: string } }> = [];
  const errors: Array<{ line: number; reason: string; row: { departmentName: string; channelGroup: string | null; channelName: string; listUrl: string } }> = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.departmentName || !r.channelName || !r.listUrl) {
      skipped.push({ line: i + 1, reason: "缺少部委、栏目或网址", row: { departmentName: r.departmentName, channelGroup: r.channelGroup, channelName: r.channelName, listUrl: r.listUrl } });
      continue;
    }
    if (!SUPPORTED_TYPES.includes(r.type)) {
      errors.push({ line: i + 1, reason: `未知类型：${r.type}`, row: { departmentName: r.departmentName, channelGroup: r.channelGroup, channelName: r.channelName, listUrl: r.listUrl } });
      continue;
    }

    const key = `${r.departmentName}|${r.channelGroup ?? ""}|${r.channelName}|${r.listUrl}`.toLowerCase();
    if (skipExisting && existingKey.has(key)) {
      skipped.push({ line: i + 1, reason: "已存在相同 部委·大板块·栏目·网址", row: { departmentName: r.departmentName, channelGroup: r.channelGroup, channelName: r.channelName, listUrl: r.listUrl } });
      continue;
    }

    try {
      const id = await createMonitorSource({
        departmentName: r.departmentName,
        channelGroup: r.channelGroup ?? undefined,
        channelName: r.channelName,
        displayName: r.displayName,
        type: r.type,
        listUrl: r.listUrl,
        startDate: r.startDate,
        maxItems: r.maxItems,
        enabled: r.enabled,
        autoMonitor: r.autoMonitor,
        isKey: r.isKey,
        notes: r.notes,
      });
      created.push({ id, displayName: `${r.departmentName}${r.channelGroup ? "·" + r.channelGroup : ""}·${r.channelName}` });
      existingKey.add(key);
    } catch (e) {
      errors.push({ line: i + 1, reason: e instanceof Error ? e.message : String(e), row: { departmentName: r.departmentName, channelGroup: r.channelGroup, channelName: r.channelName, listUrl: r.listUrl } });
    }
  }

  return {
    total: rows.length,
    created: created.length,
    skipped: skipped.length,
    errors: errors.length,
    createdItems: created.slice(0, 50),
    skippedItems: skipped.slice(0, 20),
    errorItems: errors.slice(0, 20),
  };
}
