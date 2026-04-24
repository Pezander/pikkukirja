import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationAccess, requireAssociationEditor } from "@/lib/auth-helpers";
import { runCalculation } from "@/lib/tieyksikointi";

// GET /api/associations/[id]/road-units/calculations
// Returns all calculations (without full per-member results).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requireAssociationAccess(id);
  if (result instanceof Response) return result;

  const calculations = await prisma.roadUnitCalculation.findMany({
    where: { associationId: id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { results: true } },
    },
  });

  return NextResponse.json(calculations);
}

// POST /api/associations/[id]/road-units/calculations
// Triggers a new calculation run and persists results.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requireAssociationEditor(id);
  if (result instanceof Response) return result;

  const body = await req.json();
  const { name, pricePerUnit, adminFee, notes } = body;

  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const calculationId = await runCalculation({
    associationId: id,
    name,
    pricePerUnit: pricePerUnit ?? 0,
    adminFee: adminFee ?? 0,
    notes: notes ?? "",
  });

  const calculation = await prisma.roadUnitCalculation.findUnique({
    where: { id: calculationId },
    include: {
      results: { orderBy: { memberName: "asc" } },
      _count: { select: { results: true } },
    },
  });

  return NextResponse.json(calculation, { status: 201 });
}
