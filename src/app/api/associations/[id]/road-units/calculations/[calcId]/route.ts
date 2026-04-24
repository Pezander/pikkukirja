import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationAccess, requireAssociationEditor } from "@/lib/auth-helpers";

async function resolveCalc(assocId: string, calcId: string) {
  return prisma.roadUnitCalculation.findFirst({
    where: { id: calcId, associationId: assocId },
  });
}

// GET /api/associations/[id]/road-units/calculations/[calcId]
// Returns the calculation with full per-member results.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; calcId: string }> }
) {
  const { id, calcId } = await params;
  const result = await requireAssociationAccess(id);
  if (result instanceof Response) return result;

  const calc = await prisma.roadUnitCalculation.findFirst({
    where: { id: calcId, associationId: id },
    include: {
      results: { orderBy: { memberName: "asc" } },
    },
  });
  if (!calc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(calc);
}

// PATCH /api/associations/[id]/road-units/calculations/[calcId]
// Updates metadata fields (name, pricePerUnit, adminFee, notes, isActive).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; calcId: string }> }
) {
  const { id, calcId } = await params;
  const result = await requireAssociationEditor(id);
  if (result instanceof Response) return result;

  const existing = await resolveCalc(id, calcId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name, pricePerUnit, adminFee, notes, isActive } = await req.json();

  // If activating this calculation, deactivate all others first.
  if (isActive === true) {
    await prisma.roadUnitCalculation.updateMany({
      where: { associationId: id, isActive: true },
      data: { isActive: false },
    });
  }

  const updated = await prisma.roadUnitCalculation.update({
    where: { id: calcId },
    data: {
      ...(name !== undefined && { name }),
      ...(pricePerUnit !== undefined && { pricePerUnit }),
      ...(adminFee !== undefined && { adminFee }),
      ...(notes !== undefined && { notes }),
      ...(isActive !== undefined && { isActive }),
    },
    include: {
      results: { orderBy: { memberName: "asc" } },
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/associations/[id]/road-units/calculations/[calcId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; calcId: string }> }
) {
  const { id, calcId } = await params;
  const result = await requireAssociationEditor(id);
  if (result instanceof Response) return result;

  const existing = await resolveCalc(id, calcId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.roadUnitCalculation.delete({ where: { id: calcId } });
  return new NextResponse(null, { status: 204 });
}
