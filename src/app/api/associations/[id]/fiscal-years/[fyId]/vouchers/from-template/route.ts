import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationEditor } from "@/lib/auth-helpers";
import { logAction } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fyId: string }> }
) {
  const { id, fyId } = await params;
  const authResult = await requireAssociationEditor(id);
  if (authResult instanceof Response) return authResult;

  const body = await req.json();
  const { templateId, date, description } = body;

  if (!templateId || !date) {
    return NextResponse.json({ error: "templateId and date are required" }, { status: 400 });
  }

  const template = await prisma.voucherTemplate.findUnique({
    where: { id: templateId },
    include: { lines: true },
  });

  if (!template || template.associationId !== id) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const fy = await prisma.fiscalYear.findUnique({ where: { id: fyId } });
  if (!fy || fy.associationId !== id) {
    return NextResponse.json({ error: "Fiscal year not found" }, { status: 404 });
  }
  if (fy.status !== "open") {
    return NextResponse.json({ error: "Tilikausi on suljettu." }, { status: 400 });
  }

  const lastVoucher = await prisma.voucher.findFirst({
    where: { fiscalYearId: fyId },
    orderBy: { number: "desc" },
  });
  const nextNumber = Number(lastVoucher?.number ?? 0) + 1;

  const voucher = await prisma.voucher.create({
    data: {
      fiscalYearId: fyId,
      number: nextNumber,
      date: new Date(date),
      description: description?.trim() || template.description || template.name,
      lines: {
        create: template.lines.map((l) => ({
          accountId: l.accountId,
          debit: l.debit,
          credit: l.credit,
          note: l.note,
        })),
      },
    },
    include: { lines: { include: { account: true } } },
  });

  logAction(
    authResult.user.id,
    authResult.user.name ?? authResult.user.email ?? "Tuntematon",
    "CREATE",
    "Voucher",
    voucher.id,
    `Tosite #${voucher.number} mallipohjasta "${template.name}": ${voucher.description}`
  );

  return NextResponse.json(voucher, { status: 201 });
}
