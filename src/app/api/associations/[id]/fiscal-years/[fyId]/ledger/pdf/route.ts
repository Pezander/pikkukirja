import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationAccess } from "@/lib/auth-helpers";
import { renderToBuffer } from "@react-pdf/renderer";
import { LedgerPDF, buildLedgerSummary } from "@/components/invoice/LedgerPDF";
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

  // Normalize Prisma Date objects to ISO strings
  const vouchers = fy.vouchers.map((v) => ({
    ...v,
    date: v.date instanceof Date ? v.date.toISOString() : v.date,
  }));

  const summary = buildLedgerSummary(vouchers, accounts);

  const element = React.createElement(LedgerPDF, {
    summary,
    associationName: association.name,
    year: fy.year,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as any);

  const filename = `paakirja_${association.name.replace(/\s+/g, "_")}_${fy.year}.pdf`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
