import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationEditor } from "@/lib/auth-helpers";

interface MatchedPayment {
  invoiceId: string;
  paidAt: string;   // ISO date string from CSV
  paidAmount: number;
}

// POST — apply matched payments: mark invoices paid + optionally create vouchers
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

  const { matches, createVouchers, debitAccountId, creditAccountId }: {
    matches: MatchedPayment[];
    createVouchers: boolean;
    debitAccountId?: string;
    creditAccountId?: string;
  } = await req.json();

  if (!matches?.length) {
    return NextResponse.json({ error: "No matches provided" }, { status: 400 });
  }

  // Verify every invoice belongs to this fiscal year (and thus association)
  const invoiceIds = matches.map((m) => m.invoiceId);
  const validCount = await prisma.invoice.count({
    where: { id: { in: invoiceIds }, fiscalYearId: fyId },
  });
  if (validCount !== invoiceIds.length) {
    return NextResponse.json({ error: "Invoice reference mismatch" }, { status: 400 });
  }

  // Mark invoices as paid
  await Promise.all(
    matches.map((m) =>
      prisma.invoice.update({
        where: { id: m.invoiceId },
        data: { paidAt: new Date(m.paidAt), paidAmount: m.paidAmount },
      })
    )
  );

  const voucherResults: { created: number; skipped: number; reason?: string } = {
    created: 0,
    skipped: 0,
  };

  if (createVouchers) {
    const [bankAccount, receivablesAccount] = await Promise.all([
      debitAccountId
        ? prisma.account.findUnique({ where: { id: debitAccountId } })
        : prisma.account.findFirst({ where: { associationId: id, number: "100" } }),
      creditAccountId
        ? prisma.account.findUnique({ where: { id: creditAccountId } })
        : prisma.account.findFirst({ where: { associationId: id, number: "111" } }),
    ]);

    if (!bankAccount || !receivablesAccount) {
      voucherResults.skipped = matches.length;
      voucherResults.reason = "Valittua tiliä ei löydy — tositteet jätetty luomatta.";
    } else {
      // Get next voucher number
      const lastVoucher = await prisma.voucher.findFirst({
        where: { fiscalYearId: fyId },
        orderBy: { number: "desc" },
      });
      let nextNum = Number(lastVoucher?.number ?? 0) + 1;

      // Fetch invoice details for descriptions
      const invoices = await prisma.invoice.findMany({
        where: { id: { in: matches.map((m) => m.invoiceId) } },
        include: { member: true },
      });
      const invoiceMap = new Map(invoices.map((inv) => [inv.id, inv]));

      for (const m of matches) {
        const inv = invoiceMap.get(m.invoiceId);
        if (!inv) { voucherResults.skipped++; continue; }

        await prisma.voucher.create({
          data: {
            fiscalYearId: fyId,
            number: nextNum++,
            date: new Date(m.paidAt),
            description: `Maksu ${inv.invoiceNumber} – ${inv.member.name}`,
            lines: {
              create: [
                { accountId: bankAccount.id, debit: m.paidAmount, credit: 0, note: "" },
                { accountId: receivablesAccount.id, debit: 0, credit: m.paidAmount, note: "" },
              ],
            },
          },
        });
        voucherResults.created++;
      }
    }
  }

  return NextResponse.json({ marked: matches.length, vouchers: voucherResults });
}
