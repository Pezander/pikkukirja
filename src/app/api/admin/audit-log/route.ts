import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const result = await requireAdmin();
  if (result instanceof Response) return result;

  const entityType = req.nextUrl.searchParams.get("entityType") ?? undefined;
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "200"), 500);
  const offset = parseInt(req.nextUrl.searchParams.get("offset") ?? "0");

  const entries = await prisma.auditLog.findMany({
    where: entityType ? { entityType } : undefined,
    orderBy: { timestamp: "desc" },
    take: limit,
    skip: offset,
  });

  return NextResponse.json(entries);
}
