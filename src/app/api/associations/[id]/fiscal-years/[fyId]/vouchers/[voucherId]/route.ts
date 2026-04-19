import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse } from "@/lib/json";
import { requireAssociationEditor } from "@/lib/auth-helpers";
import { logAction } from "@/lib/audit";
import fs from "fs";
import path from "path";

const ATTACHMENTS_DIR = path.resolve(process.cwd(), "data/attachments");

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fyId: string; voucherId: string }> }
) {
  const { id, fyId, voucherId } = await params;
  const result = await requireAssociationEditor(id);
  if (result instanceof Response) return result;

  const voucherOk = await prisma.voucher.findFirst({
    where: { id: voucherId, fiscalYearId: fyId, fiscalYear: { associationId: id } },
    select: { id: true },
  });
  if (!voucherOk) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { date, description, lines } = await req.json();

  if (!date || !description || !lines?.length) {
    return NextResponse.json({ error: "date, description and lines required" }, { status: 400 });
  }

  const totalDebit = lines.reduce((s: number, l: { debit: number }) => s + (l.debit ?? 0), 0);
  const totalCredit = lines.reduce((s: number, l: { credit: number }) => s + (l.credit ?? 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return NextResponse.json(
      { error: `Debit (${totalDebit.toFixed(2)}) ≠ Credit (${totalCredit.toFixed(2)}). Tosite ei ole tasapainossa.` },
      { status: 400 }
    );
  }

  await prisma.voucherLine.deleteMany({ where: { voucherId } });

  const voucher = await prisma.voucher.update({
    where: { id: voucherId, fiscalYearId: fyId },
    data: {
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
    include: { lines: { include: { account: true } } },
  });

  return jsonResponse(voucher);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fyId: string; voucherId: string }> }
) {
  const { id, fyId, voucherId } = await params;
  const result = await requireAssociationEditor(id);
  if (result instanceof Response) return result;

  const deleted = await prisma.voucher.findFirst({
    where: { id: voucherId, fiscalYearId: fyId, fiscalYear: { associationId: id } },
    include: { attachments: true },
  });
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.voucher.delete({ where: { id: voucherId, fiscalYearId: fyId } });
  // Delete attachment files from disk (DB rows cascade-deleted by Prisma)
  for (const att of deleted?.attachments ?? []) {
    const filePath = path.join(ATTACHMENTS_DIR, att.id);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  logAction(result.user.id, result.user.name ?? result.user.email ?? "Tuntematon", "DELETE", "Voucher", voucherId, `Tosite #${deleted?.number ?? ""}: ${deleted?.description ?? ""}`);
  return new NextResponse(null, { status: 204 });
}
