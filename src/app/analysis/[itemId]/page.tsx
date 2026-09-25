import { redirect } from "next/navigation";

type AnalysisPageProps = {
  params: Promise<{ itemId?: string }>;
  searchParams: Promise<{ sourceId?: string; url?: string }>;
};

export default async function AnalysisPage({ params, searchParams }: AnalysisPageProps) {
  const { itemId } = await params;
  const sp = await searchParams;
  const sourceId = sp.sourceId ?? "";
  const url = sp.url ?? "";

  let target = `/items/${itemId ?? "x"}`;
  const queryParts: string[] = [];
  if (sourceId) queryParts.push(`sourceId=${encodeURIComponent(sourceId)}`);
  if (url) queryParts.push(`url=${encodeURIComponent(url)}`);
  if (queryParts.length > 0) target += `?${queryParts.join("&")}`;

  redirect(target);
}
