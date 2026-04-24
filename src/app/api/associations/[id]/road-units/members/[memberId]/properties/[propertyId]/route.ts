import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationAccess, requireAssociationEditor } from "@/lib/auth-helpers";

async function resolveProperty(assocId: string, memberId: string, propertyId: string) {
  return prisma.roadEstateProperty.findFirst({
    where: {
      id: propertyId,
      memberId,
      member: { associationId: assocId },
    },
  });
}

// GET /api/associations/[id]/road-units/members/[memberId]/properties/[propertyId]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string; propertyId: string }> }
) {
  const { id, memberId, propertyId } = await params;
  const result = await requireAssociationAccess(id);
  if (result instanceof Response) return result;

  const property = await resolveProperty(id, memberId, propertyId);
  if (!property) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const full = await prisma.roadEstateProperty.findUnique({
    where: { id: propertyId },
    include: { allocations: true },
  });
  return NextResponse.json(full);
}

// PUT /api/associations/[id]/road-units/members/[memberId]/properties/[propertyId]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string; propertyId: string }> }
) {
  const { id, memberId, propertyId } = await params;
  const result = await requireAssociationEditor(id);
  if (result instanceof Response) return result;

  const existing = await resolveProperty(id, memberId, propertyId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { kiinteistoId, name, distanceKm, notes } = await req.json();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (typeof distanceKm !== "number" || distanceKm < 0)
    return NextResponse.json({ error: "distanceKm must be a non-negative number" }, { status: 400 });

  const updated = await prisma.roadEstateProperty.update({
    where: { id: propertyId },
    data: {
      kiinteistoId: kiinteistoId ?? "",
      name,
      distanceKm,
      notes: notes ?? "",
    },
    include: { allocations: true },
  });

  return NextResponse.json(updated);
}

// DELETE /api/associations/[id]/road-units/members/[memberId]/properties/[propertyId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string; propertyId: string }> }
) {
  const { id, memberId, propertyId } = await params;
  const result = await requireAssociationEditor(id);
  if (result instanceof Response) return result;

  const existing = await resolveProperty(id, memberId, propertyId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.roadEstateProperty.delete({ where: { id: propertyId } });
  return new NextResponse(null, { status: 204 });
}
