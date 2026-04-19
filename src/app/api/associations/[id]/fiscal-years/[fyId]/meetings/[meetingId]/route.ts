import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationEditor } from "@/lib/auth-helpers";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fyId: string; meetingId: string }> }
) {
  const { id, fyId, meetingId } = await params;
  const authResult = await requireAssociationEditor(id);
  if (authResult instanceof Response) return authResult;

  const meetingOk = await prisma.meeting.findFirst({
    where: { id: meetingId, fiscalYearId: fyId, fiscalYear: { associationId: id } },
    select: { id: true },
  });
  if (!meetingOk) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { meetingType, meetingDate, location, attendees } = body;

  const meeting = await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      meetingType: meetingType,
      meetingDate: meetingDate ? new Date(meetingDate) : undefined,
      location: location ?? undefined,
      attendees: attendees ?? undefined,
    },
    include: { decisions: { orderBy: { number: "asc" } } },
  });

  return NextResponse.json(meeting);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fyId: string; meetingId: string }> }
) {
  const { id, fyId, meetingId } = await params;
  const authResult = await requireAssociationEditor(id);
  if (authResult instanceof Response) return authResult;

  const meetingOk = await prisma.meeting.findFirst({
    where: { id: meetingId, fiscalYearId: fyId, fiscalYear: { associationId: id } },
    select: { id: true },
  });
  if (!meetingOk) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.meeting.delete({ where: { id: meetingId } });
  return NextResponse.json({ ok: true });
}
