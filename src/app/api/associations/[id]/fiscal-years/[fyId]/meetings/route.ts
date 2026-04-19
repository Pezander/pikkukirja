import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationAccess, requireAssociationEditor } from "@/lib/auth-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fyId: string }> }
) {
  const { id, fyId } = await params;
  const authResult = await requireAssociationAccess(id);
  if (authResult instanceof Response) return authResult;


  const fy = await prisma.fiscalYear.findUnique({ where: { id: fyId } });
  if (!fy || fy.associationId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const meetings = await prisma.meeting.findMany({
    where: { fiscalYearId: fyId },
    include: { decisions: { orderBy: { number: "asc" } } },
    orderBy: { meetingDate: "desc" },
  });

  return NextResponse.json(meetings);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fyId: string }> }
) {
  const { id, fyId } = await params;
  const authResult = await requireAssociationEditor(id);
  if (authResult instanceof Response) return authResult;

  const body = await req.json();
  const { meetingType, meetingDate, location, attendees } = body;

  if (!meetingType || !meetingDate) {
    return NextResponse.json({ error: "meetingType ja meetingDate ovat pakollisia." }, { status: 400 });
  }

  const fy = await prisma.fiscalYear.findUnique({ where: { id: fyId } });
  if (!fy || fy.associationId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const meeting = await prisma.meeting.create({
    data: {
      fiscalYearId: fyId,
      meetingType,
      meetingDate: new Date(meetingDate),
      location: location ?? "",
      attendees: attendees ?? "",
    },
    include: { decisions: true },
  });

  return NextResponse.json(meeting, { status: 201 });
}
