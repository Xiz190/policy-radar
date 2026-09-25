import { NextResponse } from "next/server";
import { requireAdminToken } from "@/lib/db";
import { getContentAnalyzer } from "@/lib/ai/content-analyzer";
import { getForecastItems } from "@/lib/monitor/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = requireAdminToken(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const analyzer = getContentAnalyzer();
    const body = await request.json();

    if (body.type === "analyze-item") {
      const { title, content, summary, matchedSignals } = body;
      const result = await analyzer.analyze({
        title,
        content,
        summary,
        matchedSignals,
      });
      return NextResponse.json({ ok: true, result });
    }

    if (body.type === "analyze-all") {
      const items = await getForecastItems("all", 50);
      const inputs = items.map((item) => ({
        title: item.title,
        content: item.summary || "",
        summary: item.summary,
        matchedSignals: (item.topCategories || []).map(
          (c) => c.category
        ),
      }));

      const results = await analyzer.batchAnalyze(inputs);
      const analyzedItems = items.map((item, index) => ({
        ...item,
        aiAnalysis: results[index],
      }));

      return NextResponse.json({ ok: true, items: analyzedItems });
    }

    return NextResponse.json(
      { ok: false, message: "未知请求类型" },
      { status: 400 }
    );
  } catch (error) {
    console.error("AI分析API错误:", error);
    return NextResponse.json(
      { ok: false, message: (error as Error).message || "未知错误" },
      { status: 500 }
    );
  }
}