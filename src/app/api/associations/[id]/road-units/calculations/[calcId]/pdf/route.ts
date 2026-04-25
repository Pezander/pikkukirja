import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationAccess } from "@/lib/auth-helpers";
import { renderToBuffer } from "@react-pdf/renderer";
import { TieyksiköintiPDF } from "@/components/invoice/TieyksiköintiPDF";
import type { BreakdownItem, ResultRow } from "@/components/invoice/TieyksiköintiPDF";
import React from "react";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; calcId: string }> }
) {
  const { id, calcId } = await params;
  const authResult = await requireAssociationAccess(id);
  if (authResult instanceof Response) return authResult;

  const [association, calc] = await Promise.all([
    prisma.association.findUnique({ where: { id } }),
    prisma.roadUnitCalculation.findFirst({
      where: { id: calcId, associationId: id },
      include: { results: { orderBy: { memberName: "asc" } } },
    }),
  ]);

  if (!association || !calc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const addressParts = [association.address, association.postalCode, association.city].filter(Boolean);
  const associationAddress = addressParts.join(", ");

  const results: ResultRow[] = calc.results.map((r) => ({
    memberName: r.memberName,
    totalTkm: r.totalTkm,
    sharePercent: r.sharePercent,
    breakdown: (JSON.parse(r.breakdown) as BreakdownItem[]),
  }));

  const element = React.createElement(TieyksiköintiPDF, {
    associationName: association.name,
    associationAddress,
    calcName: calc.name,
    printedAt: new Date().toISOString(),
    pricePerUnit: calc.pricePerUnit,
    adminFee: calc.adminFee,
    results,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as any);

  const filename = `maksuunpanoluettelo_${association.name.replace(/\s+/g, "_")}_${calc.name.replace(/\s+/g, "_")}.pdf`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
