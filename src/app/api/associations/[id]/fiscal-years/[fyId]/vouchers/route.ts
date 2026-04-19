import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse } from "@/lib/json";
import { requireAssociationEditor } from "@/lib/auth-helpers";
import { logAction } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fyId: string }> }
) {
  const { id, fyId } = await params;
  const authResult = await requireAssociationEditor(id);
  if (authResult instanceof Response) return authResult;

  const fyOk = await prisma.fiscalYear.findFirst({
    where: { id: fyId, associationId: id },
    select: { id: true },
  });
  if (!fyOk) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { date, description, lines } = body;

  if (!date || !description || !lines?.length) {
    return NextResponse.json({ error: "date, description and lines are required" }, { status: 400 });
  }

  // Validate double-entry: debits must equal credits
  const totalDebit = lines.reduce((s: number, l: { debit: number }) => s + (l.debit ?? 0), 0);
  const totalCredit = lines.reduce((s: number, l: { credit: number }) => s + (l.credit ?? 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return NextResponse.json(
      { error: `Debit (${totalDebit.toFixed(2)}) ≠ Credit (${totalCredit.toFixed(2)}). Tosite ei ole tasapainossa.` },
      { status: 400 }
    );
  }

  // Get next voucher number for this fiscal year
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
      description,
      lines: {
        create: lines.map((l: { accountId: string; debit: number; credit: number; note?: string; vatRate?: number; vatAmount?: number }) => ({
          accountId: l.accountId,
          debit: l.debit ?? 0,
          credit: l.credit ?? 0,
          note: l.note ?? "",
          vatRate: l.vatRate ?? 0,
          vatAmount: l.vatAmount ?? 0,
        })),
      },
    },
    include: {
      lines: { include: { account: true } },
    },
  });

  logAction(authResult.user.id, authResult.user.name ?? authResult.user.email ?? "Tuntematon", "CREATE", "Voucher", voucher.id, `Tosite #${voucher.number}: ${voucher.description}`);

  return jsonResponse(voucher, { status: 201 });
}
