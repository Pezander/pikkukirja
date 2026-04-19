import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";

// PUT — replace all accesses for a user (send array of associationIds)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const result = await requireAdmin();
  if (result instanceof Response) return result;

  const { userId } = await params;
  const { associationIds } = await req.json() as { associationIds: string[] };

  await prisma.$transaction([
    prisma.associationAccess.deleteMany({ where: { userId } }),
    prisma.associationAccess.createMany({
      data: associationIds.map((associationId: string) => ({ userId, associationId })),
    }),
  ]);

  return NextResponse.json({ ok: true });
}
