import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationAccess } from "@/lib/auth-helpers";
import { renderToBuffer } from "@react-pdf/renderer";
import { AnnualMeetingPDF } from "@/components/invoice/AnnualMeetingPDF";
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
    prisma.fiscalYear.findUnique({
      where: { id: fyId },
      include: {
        vouchers: {
          include: { lines: { include: { account: true } } },
        },
      },
    }),
    prisma.account.findMany({
      where: { associationId: id },
      orderBy: { number: "asc" },
    }),
  ]);

  if (!association || !fy || fy.associationId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let reportSections: { id: string; title: string; body: string }[] = [];
  try {
    reportSections = JSON.parse(fy.reportSections || "[]");
  } catch {
    reportSections = [];
  }

  let liitetiedot: { id: string; title: string; body: string }[] = [];
  try {
    liitetiedot = JSON.parse(fy.liitetiedot || "[]");
  } catch {
    liitetiedot = [];
  }

  const element = React.createElement(AnnualMeetingPDF, {
    vouchers: fy.vouchers,
    accounts,
    year: fy.year,
    association,
    reportSections,
    liitetiedot,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as any);

  const filename = `vuosikokous_${association.name.replace(/\s+/g, "_")}_${fy.year}.pdf`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
