import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationEditor } from "@/lib/auth-helpers";
import { logAction } from "@/lib/audit";

// POST — add a payment to an invoice
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fyId: string; invoiceId: string }> }
) {
  const { id, fyId, invoiceId } = await params;
  const authResult = await requireAssociationEditor(id);
  if (authResult instanceof Response) return authResult;

  const { amount, paidAt, note, createVoucher, debitAccountId, creditAccountId } = await req.json();

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Summa vaaditaan ja sen täytyy olla positiivinen" }, { status: 400 });
  }
  if (!paidAt) {
    return NextResponse.json({ error: "Maksupäivämäärä vaaditaan" }, { status: 400 });
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, fiscalYearId: fyId, fiscalYear: { associationId: id } },
    include: { payments: true, member: true },
  });
  if (!invoice) return NextResponse.json({ error: "Laskua ei löydy" }, { status: 404 });

  // Create the new payment
  await prisma.payment.create({
    data: {
      invoiceId,
      amount: parseFloat(amount),
      paidAt: new Date(paidAt),
      note: note ?? "",
    },
  });

  // Recalculate running total
  const allPayments = await prisma.payment.findMany({ where: { invoiceId } });
  const paidSum = allPayments.reduce((s, p) => s + p.amount, 0);
  const isFullyPaid = paidSum >= invoice.totalAmount - 0.005;

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      paidAmount: paidSum,
      paidAt: isFullyPaid ? new Date(paidAt) : null,
    },
    include: { payments: true, member: true, lineItems: true },
  });

  logAction(
    authResult.user.id,
    authResult.user.name ?? authResult.user.email ?? "Tuntematon",
    "UPDATE",
    "Invoice",
    invoiceId,
    `Maksu ${parseFloat(amount).toFixed(2)} € kirjattu laskulle ${invoice.invoiceNumber}`
  );

  // Auto-create accounting voucher if requested
  let voucherNumber: number | null = null;
  if (createVoucher) {
    const [debitAcc, creditAcc] = await Promise.all([
      debitAccountId
        ? prisma.account.findUnique({ where: { id: debitAccountId } })
        : prisma.account.findFirst({ where: { associationId: id, number: "100" } }),
      creditAccountId
        ? prisma.account.findUnique({ where: { id: creditAccountId } })
        : prisma.account.findFirst({ where: { associationId: id, number: "310" } }),
    ]);

    if (debitAcc && creditAcc) {
      const lastVoucher = await prisma.voucher.findFirst({
        where: { fiscalYearId: fyId },
        orderBy: { number: "desc" },
      });
      const nextNum = (lastVoucher?.number ?? 0) + 1;
      const paid = parseFloat(amount);

      const voucher = await prisma.voucher.create({
        data: {
          fiscalYearId: fyId,
          number: nextNum,
          date: new Date(paidAt),
          description: `Maksu ${invoice.invoiceNumber} – ${invoice.member.name}`,
          lines: {
            create: [
              { accountId: debitAcc.id, debit: paid, credit: 0, note: note ?? "" },
              { accountId: creditAcc.id, debit: 0, credit: paid, note: "" },
            ],
          },
        },
      });
      voucherNumber = voucher.number;
    }
  }

  return NextResponse.json({ ...updated, voucherNumber }, { status: 201 });
}

// DELETE — remove all payments (mark as unpaid)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fyId: string; invoiceId: string }> }
) {
  const { id, fyId, invoiceId } = await params;
  const authResult = await requireAssociationEditor(id);
  if (authResult instanceof Response) return authResult;

  const invoiceExists = await prisma.invoice.findFirst({
    where: { id: invoiceId, fiscalYearId: fyId, fiscalYear: { associationId: id } },
    select: { id: true },
  });
  if (!invoiceExists) return NextResponse.json({ error: "Laskua ei löydy" }, { status: 404 });

  await prisma.payment.deleteMany({ where: { invoiceId } });
  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { paidAt: null, paidAmount: null },
    include: { payments: true, member: true, lineItems: true },
  });

  logAction(
    authResult.user.id,
    authResult.user.name ?? authResult.user.email ?? "Tuntematon",
    "UPDATE",
    "Invoice",
    invoiceId,
    `Kaikki maksut poistettu laskulta ${updated.invoiceNumber}`
  );

  return NextResponse.json(updated);
}
