import { NextResponse } from "next/server";
import { isOwnerRequest, isPublicDemo } from "@/lib/demo-mode";

export const dynamic = "force-dynamic";

// 前端用来决定要不要显示「演示站只读」提示条
export async function GET(request: Request) {
  const demo = isPublicDemo();
  return NextResponse.json({ demo, owner: demo ? isOwnerRequest(request) : true });
}
