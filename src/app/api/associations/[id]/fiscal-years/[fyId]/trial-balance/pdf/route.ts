import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationAccess } from "@/lib/auth-helpers";
import { renderToBuffer } from "@react-pdf/renderer";
import { TrialBalancePDF } from "@/components/invoice/TrialBalancePDF";
import React from "react";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fyId: string }> }
) {
  const { id, fyId } = await params;
  const authResult = await requireAssociationAccess(id);
  if (authResult instanceof Response) return authResult;


  const [association, fy, accounts] = await Promise.all([
    prisma.association.findUnique({ where: { id } }),
    prisma.fiscalYear.findFirst({
      where: { id: fyId, associationId: id },
      include: {
        vouchers: {
          include: { lines: { include: { account: true } } },
          orderBy: { number: "asc" },
        },
      },
    }),
    prisma.account.findMany({
      where: { associationId: id },
      orderBy: { number: "asc" },
    }),
  ]);

  if (!association || !fy) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const element = React.createElement(TrialBalancePDF, {
    vouchers: fy.vouchers,
    accounts,
    year: fy.year,
    associationName: association.name,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as any);

  const filename = `koetase_${association.name.replace(/\s+/g, "_")}_${fy.year}.pdf`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
