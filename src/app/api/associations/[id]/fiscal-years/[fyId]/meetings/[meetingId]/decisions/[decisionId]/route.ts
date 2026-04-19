import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationEditor } from "@/lib/auth-helpers";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fyId: string; meetingId: string; decisionId: string }> }
) {
  const { id, fyId, meetingId, decisionId } = await params;
  const authResult = await requireAssociationEditor(id);
  if (authResult instanceof Response) return authResult;

  const decisionOk = await prisma.decision.findFirst({
    where: { id: decisionId, meetingId, meeting: { fiscalYearId: fyId, fiscalYear: { associationId: id } } },
    select: { id: true },
  });
  if (!decisionOk) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  const decision = await prisma.decision.update({
    where: { id: decisionId },
    data: {
      title: body.title ?? undefined,
      body: body.body ?? undefined,
      outcome: body.outcome ?? undefined,
    },
  });

  return NextResponse.json(decision);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fyId: string; meetingId: string; decisionId: string }> }
) {
  const { id, fyId, meetingId, decisionId } = await params;
  const authResult = await requireAssociationEditor(id);
  if (authResult instanceof Response) return authResult;

  const decisionOk = await prisma.decision.findFirst({
    where: { id: decisionId, meetingId, meeting: { fiscalYearId: fyId, fiscalYear: { associationId: id } } },
    select: { id: true },
  });
  if (!decisionOk) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.decision.delete({ where: { id: decisionId } });
  return NextResponse.json({ ok: true });
}
