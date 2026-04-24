import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationAccess, requireAssociationEditor } from "@/lib/auth-helpers";

// GET /api/associations/[id]/road-units/members/[memberId]/properties
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params;
  const result = await requireAssociationAccess(id);
  if (result instanceof Response) return result;

  const member = await prisma.member.findFirst({
    where: { id: memberId, associationId: id },
    select: { id: true },
  });
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const properties = await prisma.roadEstateProperty.findMany({
    where: { memberId },
    include: { allocations: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(properties);
}

// POST /api/associations/[id]/road-units/members/[memberId]/properties
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params;
  const result = await requireAssociationEditor(id);
  if (result instanceof Response) return result;

  const member = await prisma.member.findFirst({
    where: { id: memberId, associationId: id },
    select: { id: true },
  });
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { kiinteistoId, name, distanceKm, notes } = await req.json();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (typeof distanceKm !== "number" || distanceKm < 0)
    return NextResponse.json({ error: "distanceKm must be a non-negative number" }, { status: 400 });

  const property = await prisma.roadEstateProperty.create({
    data: {
      memberId,
      kiinteistoId: kiinteistoId ?? "",
      name,
      distanceKm,
      notes: notes ?? "",
    },
    include: { allocations: true },
  });

  return NextResponse.json(property, { status: 201 });
}
