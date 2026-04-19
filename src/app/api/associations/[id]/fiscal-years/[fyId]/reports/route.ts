import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationAccess } from "@/lib/auth-helpers";
import { renderToBuffer } from "@react-pdf/renderer";
import { YearlyReviewPDF } from "@/components/invoice/YearlyReviewPDF";
import React from "react";

// GET /api/associations/:id/fiscal-years/:fyId/reports?type=yearly
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fyId: string }> }
) {
  const { id, fyId } = await params;
  const authResult = await requireAssociationAccess(id);
  if (authResult instanceof Response) return authResult;


  const [association, fy] = await Promise.all([
    prisma.association.findUnique({ where: { id } }),
    prisma.fiscalYear.findFirst({
      where: { id: fyId, associationId: id },
      include: {
        vouchers: {
          include: { lines: { include: { account: true } } },
        },
      },
    }),
  ]);

  if (!association || !fy) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const accounts = await prisma.account.findMany({
    where: { associationId: id },
    orderBy: { number: "asc" },
  });

  const element = React.createElement(YearlyReviewPDF, {
    vouchers: fy.vouchers,
    accounts,
    year: fy.year,
    association,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as any);

  const filename = `tilinpaatos_${association.name.replace(/\s+/g, "_")}_${fy.year}.pdf`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
