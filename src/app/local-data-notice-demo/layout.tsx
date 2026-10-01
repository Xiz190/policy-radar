import { notFound } from "next/navigation";
import { isPublicDemo } from "@/lib/demo-mode";

// 开发用的演示/测试页：本地照常打开，公开演示站（PUBLIC_DEMO=1）上一律 404，访客看不到
export const dynamic = "force-dynamic";

export default function DevOnlyLayout({ children }: { children: React.ReactNode }) {
  if (isPublicDemo()) notFound();
  return children;
}
