import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationAccess } from "@/lib/auth-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requireAssociationAccess(id);
  if (result instanceof Response) return result;


  const [memberCount, fiscalYears] = await Promise.all([
    prisma.member.count({ where: { associationId: id } }),
    prisma.fiscalYear.findMany({
      where: { associationId: id },
      orderBy: { year: "desc" },
      take: 1,
      include: {
        invoices: { select: { totalAmount: true, paidAt: true } },
        vouchers: { include: { lines: { include: { account: true } } } },
      },
    }),
  ]);

  const openFy = fiscalYears[0] ?? null;

  let openInvoiceCount = 0;
  let openInvoiceTotal = 0;
  let totalIncome = 0;
  let totalExpense = 0;

  if (openFy) {
    const unpaid = openFy.invoices.filter((inv) => !inv.paidAt);
    openInvoiceCount = unpaid.length;
    openInvoiceTotal = unpaid.reduce((s, inv) => s + inv.totalAmount, 0);

    for (const v of openFy.vouchers) {
      for (const line of v.lines) {
        if (line.account.type === "income") totalIncome += line.credit - line.debit;
        if (line.account.type === "expense") totalExpense += line.debit - line.credit;
      }
    }
  }

  return NextResponse.json({
    memberCount,
    openFiscalYear: openFy ? { id: openFy.id, year: openFy.year, status: openFy.status } : null,
    openInvoiceCount,
    openInvoiceTotal,
    totalIncome,
    totalExpense,
  });
}
