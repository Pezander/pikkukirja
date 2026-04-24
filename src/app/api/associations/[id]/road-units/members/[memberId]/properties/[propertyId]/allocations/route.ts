import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationEditor } from "@/lib/auth-helpers";

async function resolveProperty(assocId: string, memberId: string, propertyId: string) {
  return prisma.roadEstateProperty.findFirst({
    where: { id: propertyId, memberId, member: { associationId: assocId } },
    select: { id: true },
  });
}

// POST /api/associations/[id]/road-units/members/[memberId]/properties/[propertyId]/allocations
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string; propertyId: string }> }
) {
  const { id, memberId, propertyId } = await params;
  const result = await requireAssociationEditor(id);
  if (result instanceof Response) return result;

  const prop = await resolveProperty(id, memberId, propertyId);
  if (!prop) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

  const allocation = await prisma.trafficAllocation.create({
    data: {
      roadPropertyId: propertyId,
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

  return NextResponse.json(allocation, { status: 201 });
}
