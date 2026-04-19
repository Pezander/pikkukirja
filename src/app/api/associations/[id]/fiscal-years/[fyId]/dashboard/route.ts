import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationAccess } from "@/lib/auth-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fyId: string }> }
) {
  const { id, fyId } = await params;
  const authResult = await requireAssociationAccess(id);
  if (authResult instanceof Response) return authResult;


  const [fy, budgetLines] = await Promise.all([
    prisma.fiscalYear.findUnique({
      where: { id: fyId },
      include: {
        vouchers: { include: { lines: { include: { account: true } } } },
        invoices: { select: { totalAmount: true, paidAt: true, dueDate: true } },
      },
    }),
    prisma.budgetLine.findMany({
      where: { fiscalYearId: fyId },
      include: { account: true },
    }),
  ]);

  if (!fy || fy.associationId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Monthly income/expense — 12 buckets indexed 0-11
  const monthlyIncome = Array(12).fill(0) as number[];
  const monthlyExpense = Array(12).fill(0) as number[];
  let cashBalance = 0;

  for (const v of fy.vouchers) {
    const month = new Date(v.date).getMonth(); // 0-11
    for (const line of v.lines) {
      if (line.account.type === "income") {
        const net = line.credit - line.debit;
        monthlyIncome[month] += net;
      } else if (line.account.type === "expense") {
        const net = line.debit - line.credit;
        monthlyExpense[month] += net;
      } else if (line.account.number.startsWith("100")) {
        cashBalance += line.debit - line.credit;
      }
    }
  }

  // Budget vs actual per account
  const budgetVsActual = budgetLines.map((bl) => {
    let actual = 0;
    for (const v of fy.vouchers) {
      for (const line of v.lines) {
        if (line.accountId === bl.accountId) {
          if (bl.account.type === "income") actual += line.credit - line.debit;
          else if (bl.account.type === "expense") actual += line.debit - line.credit;
        }
      }
    }
    return {
      accountNumber: bl.account.number,
      accountName: bl.account.name,
      accountType: bl.account.type,
      budget: bl.amount,
      actual,
    };
  }).filter((b) => b.budget !== 0);

  // Invoice aging
  const now = new Date();
  const aging = { current: 0, overdue30: 0, overdue60: 0, overdue60plus: 0 };
  for (const inv of fy.invoices) {
    if (inv.paidAt) continue;
    const due = new Date(inv.dueDate);
    const daysOverdue = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    if (daysOverdue <= 0) aging.current += inv.totalAmount;
    else if (daysOverdue <= 30) aging.overdue30 += inv.totalAmount;
    else if (daysOverdue <= 60) aging.overdue60 += inv.totalAmount;
    else aging.overdue60plus += inv.totalAmount;
  }

  return NextResponse.json({ monthlyIncome, monthlyExpense, cashBalance, budgetVsActual, aging });
}
