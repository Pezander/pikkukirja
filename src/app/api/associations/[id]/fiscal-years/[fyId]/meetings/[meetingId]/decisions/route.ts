import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationEditor } from "@/lib/auth-helpers";

export async function POST(
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
  const { title, body: decisionBody, outcome } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Otsikko on pakollinen." }, { status: 400 });
  }

  // Get next § number
  const last = await prisma.decision.findFirst({
    where: { meetingId },
    orderBy: { number: "desc" },
  });
  const nextNumber = (last?.number ?? 0) + 1;

  const decision = await prisma.decision.create({
    data: {
      meetingId,
      number: nextNumber,
      title: title.trim(),
      body: decisionBody ?? "",
      outcome: outcome ?? "passed",
    },
  });

  return NextResponse.json(decision, { status: 201 });
}
