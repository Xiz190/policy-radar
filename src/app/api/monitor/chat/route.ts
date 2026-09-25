import { NextRequest, NextResponse } from "next/server";
import { requireAdminToken } from "@/lib/db";
import { getItemDetailBySourceAndUrl } from "@/lib/monitor/db";
import {
  ROLE_FOCUS_LIST,
  computeAllRoleAnalyses,
  chatAnswer,
  chatOpening,
  type ChatContext,
  type ChatMessage,
} from "@/lib/monitor/role-analysis";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = requireAdminToken(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const sourceId: string = body.sourceId || "";
    const url: string = body.url || "";
    const question: string = (body.question || "").toString().trim();
    const roleId: string | undefined = body.roleId;

    if (!sourceId || !url) {
      return NextResponse.json({ ok: false, error: "缺少 sourceId 或 url" }, { status: 400 });
    }

    const item = await getItemDetailBySourceAndUrl(sourceId, url);
    if (!item) {
      return NextResponse.json({ ok: false, error: "未找到该条目" }, { status: 404 });
    }

    const role = roleId ? ROLE_FOCUS_LIST.find((r) => r.id === roleId) : undefined;
    const contextSummary: string | undefined = body.contextSummary
      ? (body.contextSummary.toString().slice(0, 600))
      : undefined;
    const chatContext: ChatContext = {
      title: item.title,
      paragraphs: item.paragraphs || [],
      categories: item.categories || [],
      matchedKeywords: item.matchedKeywords || [],
      role,
      contextSummary,
    };

    let response: ChatMessage;
    if (!question) {
      response = chatOpening(chatContext);
    } else {
      response = await chatAnswer(chatContext, question);
    }

    return NextResponse.json({ ok: true, message: response });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: err }, { status: 500 });
  }
}

// 预取：返回角色交集分析（不涉及聊天，只做结构化打分）
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sourceId = searchParams.get("sourceId") || "";
    const url = searchParams.get("url") || "";

    if (!sourceId || !url) {
      return NextResponse.json({ ok: false, error: "缺少 sourceId 或 url" }, { status: 400 });
    }

    const item = await getItemDetailBySourceAndUrl(sourceId, url);
    if (!item) {
      return NextResponse.json({ ok: false, error: "未找到该条目" }, { status: 404 });
    }

    const roles = computeAllRoleAnalyses({
      keywordScore: item.keywordScore,
      importanceLevel: item.importanceLevel,
      categories: item.categories || [],
      matchedKeywords: item.matchedKeywords || [],
      title: item.title,
    });

    return NextResponse.json({ ok: true, roles, item: {
      title: item.title,
      departmentName: item.departmentName,
      channelName: item.channelName,
      listPublishedAt: item.listPublishedAt,
      keywordScore: item.keywordScore,
      importanceLevel: item.importanceLevel,
    } });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: err }, { status: 500 });
  }
}
