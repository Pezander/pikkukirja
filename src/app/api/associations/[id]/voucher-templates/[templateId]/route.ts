import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationEditor } from "@/lib/auth-helpers";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string }> }
) {
  const { id, templateId } = await params;
  const authResult = await requireAssociationEditor(id);
  if (authResult instanceof Response) return authResult;

  const body = await req.json();
  const { name, description, recurrence, dayOfMonth, isActive, lines } = body;

  const existing = await prisma.voucherTemplate.findUnique({ where: { id: templateId } });
  if (!existing || existing.associationId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Replace lines: delete all, re-create
  await prisma.voucherTemplateLine.deleteMany({ where: { templateId } });

  const template = await prisma.voucherTemplate.update({
    where: { id: templateId },
    data: {
      name: name?.trim() ?? existing.name,
      description: description ?? existing.description,
      recurrence: recurrence ?? existing.recurrence,
      dayOfMonth: dayOfMonth ?? existing.dayOfMonth,
      isActive: isActive ?? existing.isActive,
      lines: {
        create: (lines ?? []).map((l: { accountId: string; debit: number; credit: number; note?: string }) => ({
          accountId: l.accountId,
          debit: l.debit ?? 0,
          credit: l.credit ?? 0,
          note: l.note ?? "",
        })),
      },
    },
    include: { lines: { include: { account: true } } },
  });

  return NextResponse.json(template);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string }> }
) {
  const { id, templateId } = await params;
  const authResult = await requireAssociationEditor(id);
  if (authResult instanceof Response) return authResult;

  const existing = await prisma.voucherTemplate.findUnique({ where: { id: templateId } });
  if (!existing || existing.associationId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.voucherTemplate.delete({ where: { id: templateId } });
  return NextResponse.json({ ok: true });
}
