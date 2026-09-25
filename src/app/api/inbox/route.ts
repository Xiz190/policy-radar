import { NextResponse } from "next/server";
import { ensureMonitorSchema, getInboxItemsByFilter } from "@/lib/monitor/db";
import { isDbAvailable } from "@/lib/db";
import { mockDelay, generateMockItems } from "@/lib/monitor/mock";

type SortType = "relevance" | "first_seen_at" | "published_at";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await ensureMonitorSchema();

    if (!isDbAvailable()) {
      await mockDelay();
      const url = new URL(request.url);
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 15)));
      const items = generateMockItems(limit);
      return NextResponse.json({ items, totalCount: 750 });
    }

    const url = new URL(request.url);

    const sortParam = url.searchParams.get("sort") || "first_seen_at";
    const sort = ["relevance", "first_seen_at", "published_at"].includes(sortParam)
      ? sortParam as SortType
      : "first_seen_at";
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 30)));
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));

    const result = await getInboxItemsByFilter({
      sort,
      limit,
      offset,
    });

    const items = result.items.map((item) => ({
      sourceId: item.sourceId,
      url: item.url,
      title: item.title,
      departmentName: item.departmentName,
      listPublishedAt: item.listPublishedAt || item.firstSeenAt,
      matchedKeywords: [],
      importanceLevel: item.importanceLevel,
      matchedCategories: (item.categories || []).map((c: { category: string }) => c.category),
      hasFunding: item.hasFunding,
      hasProcurement: item.hasProcurement,
      hasPilot: item.hasPilot,
      hasStandards: item.hasStandards,
    }));

    return NextResponse.json({
      items,
      totalCount: result.totalCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "inbox_error", detail: message },
      { status: 500 }
    );
  }
}