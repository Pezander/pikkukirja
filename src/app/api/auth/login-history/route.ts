import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET() {
  const result = await requireAuth();
  if (result instanceof Response) return result;

  const events = await prisma.loginEvent.findMany({
    where: { userId: result.user.id },
    orderBy: { timestamp: "desc" },
    take: 50,
  });

  return NextResponse.json(events);
}
