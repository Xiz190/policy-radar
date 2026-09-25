import { SearchClient } from "./search-client";

// 服务端读网址里的 ?q=，页面按请求生成完整 HTML（不再预渲染出空壳、打开先白一下）
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { q } = await searchParams;
  return <SearchClient initialQ={typeof q === "string" ? q : ""} />;
}
