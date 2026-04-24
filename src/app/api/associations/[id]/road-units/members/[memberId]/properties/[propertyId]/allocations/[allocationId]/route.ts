import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationEditor } from "@/lib/auth-helpers";

async function resolveAllocation(assocId: string, memberId: string, propertyId: string, allocationId: string) {
  return prisma.trafficAllocation.findFirst({
    where: {
      id: allocationId,
      roadPropertyId: propertyId,
      roadProperty: { memberId, member: { associationId: assocId } },
    },
  });
}

// PUT /api/associations/[id]/road-units/members/[memberId]/properties/[propertyId]/allocations/[allocationId]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string; propertyId: string; allocationId: string }> }
) {
  const { id, memberId, propertyId, allocationId } = await params;
  const result = await requireAssociationEditor(id);
  if (result instanceof Response) return result;

  const existing = await resolveAllocation(id, memberId, propertyId, allocationId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const {
    trafficType,
    subType,
    areaHa,
    correctionFactor,
    cropCorrection,
    muuTripsPerYear,
    muuVehicleWeightT,
    muuCargoWeightT,
    notes,
  } = await req.json();

  if (!trafficType)
    return NextResponse.json({ error: "trafficType required" }, { status: 400 });

  const updated = await prisma.trafficAllocation.update({
    where: { id: allocationId },
    data: {
      trafficType,
      subType: subType ?? "",
      areaHa: areaHa ?? 0,
      correctionFactor: correctionFactor ?? 1.0,
      cropCorrection: cropCorrection ?? "none",
      muuTripsPerYear: muuTripsPerYear ?? 0,
      muuVehicleWeightT: muuVehicleWeightT ?? 0,
      muuCargoWeightT: muuCargoWeightT ?? 0,
      notes: notes ?? "",
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/associations/[id]/road-units/members/[memberId]/properties/[propertyId]/allocations/[allocationId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string; propertyId: string; allocationId: string }> }
) {
  const { id, memberId, propertyId, allocationId } = await params;
  const result = await requireAssociationEditor(id);
  if (result instanceof Response) return result;

  const existing = await resolveAllocation(id, memberId, propertyId, allocationId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.trafficAllocation.delete({ where: { id: allocationId } });
  return new NextResponse(null, { status: 204 });
}
