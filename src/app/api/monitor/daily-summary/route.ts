import { NextResponse } from "next/server";
import { requireAdminToken, isDbAvailable } from "@/lib/db";
import {
  ensureMonitorSchema,
  ensureNotificationSchema,
  getDailySummaryData,
  getDailyTopItems,
  getUrgentUnreadCount,
  upsertNotificationState,
  getLastNotificationState,
  getSourceDirectory,
  signalPush,
} from "@/lib/monitor/db";
import { generateMockDailySummary } from "@/lib/monitor/mock";

export const dynamic = "force-dynamic";

// GET 支持：
//   ?mode=status         → 返回最近一次 daily_summary 的发送状态
//   ?mode=summary        → 返回完整汇总数据（用于 UI 展示卡片）
//   ?format=html|json    → 保留旧行为（html 返回邮件预览 html，json 返回结构化列表）
export async function GET(request: Request) {
  await ensureMonitorSchema();

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode")?.toLowerCase();
  const limit = Math.min(50, Math.max(3, Number(url.searchParams.get("limit") ?? 10)));
  const sinceHours = Math.max(1, Number(url.searchParams.get("sinceHours") ?? 24));
  const format = url.searchParams.get("format") ?? "html";

  if (!isDbAvailable()) {
    const mockData = generateMockDailySummary(sinceHours, limit);
    if (mode === "status") return NextResponse.json({ ok: true, date: null, lastSentAt: null });
    if (mode === "summary") return NextResponse.json({ ok: true, ...mockData, lastSentAt: null });
    return NextResponse.json({ ok: true, ...mockData });
  }

  await ensureNotificationSchema();

  if (mode === "status") {
    const last = await getLastNotificationState("daily_summary");
    return NextResponse.json({
      ok: true,
      date: last?.meta?.["date"] ?? null,
      sinceHours: last?.meta?.["sinceHours"] ?? null,
      urgentCount: last?.meta?.["urgentCount"] ?? null,
      itemCount: last?.meta?.["itemCount"] ?? null,
      lastSentAt: last?.lastSentAt ?? null,
      subject: last?.meta?.["subject"] ?? null,
    });
  }

  if (mode === "summary") {
    const summary = await getDailySummaryData(sinceHours, limit);
    const last = await getLastNotificationState("daily_summary");
    return NextResponse.json({ ok: true, ...summary, lastSentAt: last?.lastSentAt ?? null });
  }

  // 兼容旧格式：format=html/json
  const items = await getDailyTopItems(limit, sinceHours);
  const urgent = await getUrgentUnreadCount(sinceHours);
  const departments = await getSourceDirectory();

  const today = new Date();
  const date = today.toISOString().slice(0, 10);

  if (format === "json") {
    return NextResponse.json({
      date,
      sinceHours,
      limit,
      urgentCount: urgent,
      departmentCount: departments.length,
      totalItemsInWindow: departments.reduce((s, d) => s + d.totalCount, 0),
      items,
    });
  }

  const htmlEmail = renderDailyHtml({ date, sinceHours, urgent, departments, items, limit });
  const textEmail = renderDailyText({ date, sinceHours, urgent, departments, items, limit });

  return NextResponse.json({
    date,
    html: htmlEmail,
    text: textEmail,
    urgentCount: urgent,
    itemCount: items.length,
  });
}

// POST 用于"立即发送 / 标记已发送"，真实发送走 env 配置的 Webhook
export async function POST(request: Request) {
  const auth = requireAdminToken(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  await ensureMonitorSchema();
  await ensureNotificationSchema();

  const url = new URL(request.url);
  const limit = Math.min(50, Math.max(3, Number(url.searchParams.get("limit") ?? 10)));
  const sinceHours = Math.max(1, Number(url.searchParams.get("sinceHours") ?? 24));
  const sendTo = process.env.DAILY_SUMMARY_EMAIL || process.env.DAILY_SUMMARY_WEBHOOK || "";

  const items = await getDailyTopItems(limit, sinceHours);
  const urgent = await getUrgentUnreadCount(sinceHours);
  const departments = await getSourceDirectory();

  const today = new Date();
  const date = today.toISOString().slice(0, 10);
  const htmlEmail = renderDailyHtml({
    date,
    sinceHours,
    urgent,
    departments,
    items,
    limit,
  });
  const subject = `每日汇总 · ${date} · 加急 ${urgent} · Top ${items.length}`;

  // 若配置了 DAILY_SUMMARY_WEBHOOK，就把 payload POST 过去
  const body = await request.json().catch(() => ({}) as { dryRun?: boolean });
  let sent = false;
  let webhookError: string | null = null;
  if (body.dryRun !== true && sendTo && process.env.DAILY_SUMMARY_WEBHOOK) {
    try {
      const webhookUrl = process.env.DAILY_SUMMARY_WEBHOOK;
      const isFeishu = webhookUrl.includes("open.feishu.cn");
      const isDingtalk = webhookUrl.includes("oapi.dingtalk.com");
      const isWechatWork = webhookUrl.includes("qyapi.weixin.qq.com");

      let payload: Record<string, unknown>;
      if (isFeishu) {
        payload = buildFeishuMessage(subject, items, urgent, departments, sinceHours, date);
      } else if (isDingtalk) {
        payload = buildDingtalkMessage(subject, items, urgent);
      } else if (isWechatWork) {
        payload = buildWechatWorkMessage(subject, items, urgent);
      } else {
        payload = {
          to: process.env.DAILY_SUMMARY_EMAIL?.split(",") || [],
          subject,
          html: htmlEmail,
          urgentCount: urgent,
          items,
        };
      }

      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        webhookError = `webhook returned ${res.status}`;
      } else {
        sent = true;
      }
    } catch (e) {
      webhookError = String((e as Error).message ?? e);
    }
  }

  const meta = {
    date,
    sinceHours,
    limit,
    urgentCount: urgent,
    itemCount: items.length,
    departmentCount: departments.length,
    subject,
    sent,
    webhookError,
  };

  await upsertNotificationState("daily_summary", meta, items.length);

  // 软触发 SSE：让所有打开着的浏览器立即收到"有新的每日汇总"事件
  signalPush("daily_summary_ready");

  const last = await getLastNotificationState("daily_summary");
  return NextResponse.json({
    ok: true,
    subject,
    urgentCount: urgent,
    itemCount: items.length,
    html: htmlEmail,
    lastSentAt: last?.lastSentAt,
    sent,
    webhookError,
  });
}

// ===================== 渲染（邮件 HTML / 纯文本） =====================

function renderDailyHtml({
  date,
  sinceHours,
  urgent,
  departments,
  items,
  limit,
}: {
  date: string;
  sinceHours: number;
  urgent: number;
  departments: Awaited<ReturnType<typeof getSourceDirectory>>;
  items: Awaited<ReturnType<typeof getDailyTopItems>>;
  limit: number;
}) {
  const totalItems = departments.reduce((s, d) => s + d.totalCount, 0);
  const todayCount = departments.reduce((s, d) => s + d.todayCount, 0);
  const highlightCount = departments.reduce((s, d) => s + d.highlightCount, 0);
  const topDept = departments.slice(0, 8);

  const itemsHtml =
    items.length === 0
      ? `<p style="color:#64748b">近 ${sinceHours} 小时暂无新内容。</p>`
      : `<ol style="padding-left:20px;line-height:1.8;">${items
          .map(
            (it, idx) => `
            <li style="margin-bottom:10px;">
              <div style="font-size:14px;font-weight:600;">
                ${importanceBadge(it.importanceLevel)}
                <a href="${escapeAttr(it.url)}" style="color:#0f172a;text-decoration:none;">
                  ${escapeHtml(it.title)}
                </a>
                <span style="color:#94a3b8;font-weight:400;margin-left:6px;font-size:12px;">#${idx + 1} / 关键词分 ${it.keywordScore}</span>
              </div>
              <div style="font-size:12px;color:#64748b;margin-top:2px;">
                ${escapeHtml(it.departmentName)} · ${escapeHtml(it.channelName)} · ${it.listPublishedAt ? it.listPublishedAt.slice(0, 10) : ""}
              </div>
              <div style="font-size:12px;color:#64748b;">
                <a href="${escapeAttr(it.url)}" style="color:#334155;">${escapeHtml(it.url)}</a>
              </div>
            </li>`,
          )
          .join("")}</ol>`;

  const deptHtml =
    topDept.length === 0
      ? `<span style="color:#94a3b8;font-size:12px;">暂无来源数据</span>`
      : topDept
          .map((d) => `<tr>
              <td style="padding:4px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(d.departmentName)}</td>
              <td style="padding:4px 10px;border-bottom:1px solid #e2e8f0;text-align:right;">${d.todayCount}</td>
              <td style="padding:4px 10px;border-bottom:1px solid #e2e8f0;text-align:right;">${d.last7DaysCount}</td>
              <td style="padding:4px 10px;border-bottom:1px solid #e2e8f0;text-align:right;color:#b91c1c;">${d.urgentCount}</td>
              <td style="padding:4px 10px;border-bottom:1px solid #e2e8f0;text-align:right;color:#92400e;">${d.highlightCount}</td>
              <td style="padding:4px 10px;border-bottom:1px solid #e2e8f0;text-align:right;">${d.totalCount}</td>
            </tr>`)
          .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8" /></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0f172a;background:#f8fafc;padding:16px;">
  <div style="max-width:720px;margin:0 auto;background:#fff;border-radius:16px;padding:24px;border:1px solid #e2e8f0;">
    <div style="font-size:13px;color:#64748b;">${date} · 近 ${sinceHours} 小时</div>
    <h1 style="font-size:22px;margin:4px 0 12px 0;">每日动态汇总</h1>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:20px;">
      ${statCell("加急", urgent, "#ef4444")}
      ${statCell("⚠ 重点", highlightCount, "#f59e0b")}
      ${statCell("今日更新", todayCount, "#6366f1")}
      ${statCell("入库总数", totalItems, "#0f172a")}
    </div>

    <h2 style="font-size:16px;margin:0 0 8px 0;">Top ${Math.min(limit, items.length)} 关键内容</h2>
    ${itemsHtml}

    <h2 style="font-size:16px;margin:24px 0 8px 0;">来源更新概览 (Top ${topDept.length})</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:6px 10px;text-align:left;border-bottom:1px solid #e2e8f0;">来源</th>
          <th style="padding:6px 10px;text-align:right;border-bottom:1px solid #e2e8f0;">今日</th>
          <th style="padding:6px 10px;text-align:right;border-bottom:1px solid #e2e8f0;">7 日</th>
          <th style="padding:6px 10px;text-align:right;border-bottom:1px solid #e2e8f0;">加急</th>
          <th style="padding:6px 10px;text-align:right;border-bottom:1px solid #e2e8f0;">重点</th>
          <th style="padding:6px 10px;text-align:right;border-bottom:1px solid #e2e8f0;">总数</th>
        </tr>
      </thead>
      <tbody>${deptHtml}</tbody>
    </table>

    <div style="margin-top:24px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
      本邮件由监测任务自动生成。访问收件箱可查看完整列表。
    </div>
  </div>
</body></html>`;
}

function statCell(label: string, value: number, color: string) {
  return `<div style="border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;background:#fff;">
    <div style="font-size:11px;color:#64748b;">${label}</div>
    <div style="font-size:20px;font-weight:600;color:${color};margin-top:4px;">${value}</div>
  </div>`;
}

function importanceBadge(level: string) {
  if (level === "加急推荐") return `<span style="background:#fee2e2;color:#b91c1c;padding:2px 8px;border-radius:999px;font-size:11px;margin-right:6px;">加急</span>`;
  if (level === "重点内容") return `<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:999px;font-size:11px;margin-right:6px;">⚠ 重点</span>`;
  return "";
}

function renderDailyText({
  date,
  sinceHours,
  urgent,
  departments,
  items,
  limit,
}: {
  date: string;
  sinceHours: number;
  urgent: number;
  departments: Awaited<ReturnType<typeof getSourceDirectory>>;
  items: Awaited<ReturnType<typeof getDailyTopItems>>;
  limit: number;
}) {
  const todayCount = departments.reduce((s, d) => s + d.todayCount, 0);
  const total = departments.reduce((s, d) => s + d.totalCount, 0);
  const lines = [
    `【每日汇总】${date} · 近 ${sinceHours} 小时`,
    `加急 ${urgent}    ⚠ 重点 ${departments.reduce((s, d) => s + d.highlightCount, 0)}    今日更新 ${todayCount}    入库总数 ${total}`,
    ``,
    `Top ${Math.min(limit, items.length)} 关键内容：`,
    ...items.map((it, idx) => {
      const prefix = it.importanceLevel === "加急推荐" ? "[加急]" : it.importanceLevel === "重点内容" ? "[重点]" : "[·]";
      return `${prefix} #${idx + 1}  ${it.title}\n    ${it.departmentName} / ${it.channelName} · ${it.listPublishedAt?.slice(0, 10) ?? ""}\n    ${it.url}`;
    }),
    ``,
    `来源 Top 8：`,
    ...departments.slice(0, 8).map((d) => `  · ${d.departmentName}  今日 ${d.todayCount} · 7 日 ${d.last7DaysCount} · 加急 ${d.urgentCount} · 重点 ${d.highlightCount}`),
  ];
  return lines.join("\n");
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function escapeAttr(s: string) {
  return escapeHtml(s);
}

function buildFeishuMessage(
  subject: string,
  items: Awaited<ReturnType<typeof getDailyTopItems>>,
  urgent: number,
  departments: Awaited<ReturnType<typeof getSourceDirectory>>,
  sinceHours: number,
  _date: string,
) {
  const highlightCount = departments.reduce((s, d) => s + d.highlightCount, 0);
  const todayCount = departments.reduce((s, d) => s + d.todayCount, 0);

  const cardElements: Record<string, unknown>[] = [
    {
      tag: "div",
      text: {
        tag: "lark_md",
        content: `**${subject}**\n\n近 ${sinceHours} 小时更新`,
      },
    },
    {
      tag: "div",
      text: {
        tag: "lark_md",
        content: `加急：**${urgent}** | ⚠ 重点：**${highlightCount}** | 今日更新：**${todayCount}**`,
      },
    },
    {
      tag: "hr",
    },
    {
      tag: "div",
      text: {
        tag: "lark_md",
        content: "**Top 关键内容：**",
      },
    },
  ];

  items.slice(0, 10).forEach((item, idx) => {
    const prefix = item.importanceLevel === "加急推荐" ? "【加急】" : item.importanceLevel === "重点内容" ? "【重点】" : "";
    cardElements.push({
      tag: "div",
      text: {
        tag: "lark_md",
        content: `${prefix} **#${idx + 1}** [${item.title}](${item.url})\n> ${item.departmentName} · ${item.channelName} · ${item.listPublishedAt?.slice(0, 10) || ""}`,
      },
    });
  });

  return {
    msg_type: "interactive",
    card: {
      config: {
        wide_screen_mode: true,
        enable_forward: true,
      },
      header: {
        title: {
          tag: "plain_text",
          content: "每日动态汇总",
        },
        template: "turquoise",
      },
      elements: cardElements,
    },
  };
}

function buildDingtalkMessage(
  subject: string,
  items: Awaited<ReturnType<typeof getDailyTopItems>>,
  urgent: number,
) {
  const textLines: string[] = [`# ${subject}`, ""];

  textLines.push(`**加急：${urgent}**`);
  textLines.push("");
  textLines.push("**Top 关键内容：**");

  items.slice(0, 10).forEach((item, idx) => {
    const prefix = item.importanceLevel === "加急推荐" ? "【加急】" : item.importanceLevel === "重点内容" ? "【重点】" : "";
    textLines.push(`${prefix} #${idx + 1} [${item.title}](${item.url})`);
    textLines.push(`> ${item.departmentName} · ${item.channelName}`);
    textLines.push("");
  });

  return {
    msgtype: "markdown",
    markdown: {
      title: subject,
      text: textLines.join("\n"),
    },
  };
}

function buildWechatWorkMessage(
  subject: string,
  items: Awaited<ReturnType<typeof getDailyTopItems>>,
  urgent: number,
) {
  const textLines: string[] = [`${subject}`];

  textLines.push(`\n加急：${urgent}`);
  textLines.push("\nTop 关键内容：");

  items.slice(0, 10).forEach((item, idx) => {
    const prefix = item.importanceLevel === "加急推荐" ? "【加急】" : item.importanceLevel === "重点内容" ? "【重点】" : "";
    textLines.push(`${prefix} #${idx + 1} ${item.title}`);
    textLines.push(`   ${item.departmentName} · ${item.channelName}`);
    textLines.push(`   ${item.url}`);
  });

  return {
    msgtype: "text",
    text: {
      content: textLines.join("\n"),
    },
  };
}
