import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationAccess } from "@/lib/auth-helpers";

// GET /api/associations/[id]/road-units/members
// Returns all members with their roadProperties and allocations.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requireAssociationAccess(id);
  if (result instanceof Response) return result;

  const members = await prisma.member.findMany({
    where: { associationId: id },
    select: {
      id: true,
      name: true,
      roadProperties: {
        include: { allocations: true },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(members);
}
