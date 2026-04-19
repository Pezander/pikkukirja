import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationAccess } from "@/lib/auth-helpers";
import { renderToBuffer } from "@react-pdf/renderer";
import { MeetingMinutesPDF } from "@/components/invoice/MeetingMinutesPDF";
import React from "react";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fyId: string; meetingId: string }> }
) {
  const { id, fyId, meetingId } = await params;
  const authResult = await requireAssociationAccess(id);
  if (authResult instanceof Response) return authResult;


  const [association, meeting] = await Promise.all([
    prisma.association.findUnique({ where: { id } }),
    prisma.meeting.findFirst({
      where: { id: meetingId, fiscalYearId: fyId, fiscalYear: { associationId: id } },
      include: { decisions: { orderBy: { number: "asc" } } },
    }),
  ]);

  if (!association || !meeting) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(MeetingMinutesPDF, { association, meeting } as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as any);

  const dateStr = new Date(meeting.meetingDate).toLocaleDateString("fi-FI").replace(/\./g, "-");
  const filename = `kokous_${dateStr}.pdf`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
