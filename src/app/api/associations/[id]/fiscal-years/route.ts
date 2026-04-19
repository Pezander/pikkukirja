import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse } from "@/lib/json";
import { requireAssociationAccess, requireAssociationEditor } from "@/lib/auth-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAssociationAccess(id);
  if (authResult instanceof Response) return authResult;

  const fiscalYears = await prisma.fiscalYear.findMany({
    where: { associationId: id },
    orderBy: { year: "desc" },
    select: { id: true, year: true, status: true },
  });
  return NextResponse.json(fiscalYears);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAssociationEditor(id);
  if (authResult instanceof Response) return authResult;

  const { year } = await req.json();

  if (!year) return NextResponse.json({ error: "Year is required" }, { status: 400 });

  // Check no duplicate
  const existing = await prisma.fiscalYear.findUnique({
    where: { associationId_year: { associationId: id, year } },
  });
  if (existing) {
    return NextResponse.json({ error: "Tilikausi on jo olemassa" }, { status: 409 });
  }

  const fiscalYear = await prisma.fiscalYear.create({
    data: { associationId: id, year, status: "open" },
  });

  return jsonResponse(fiscalYear, { status: 201 });
}
