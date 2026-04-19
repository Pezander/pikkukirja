import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse } from "@/lib/json";
import { requireAssociationEditor } from "@/lib/auth-helpers";
import { logAction } from "@/lib/audit";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fyId: string }> }
) {
  const { id, fyId } = await params;
  const authResult = await requireAssociationEditor(id);
  if (authResult instanceof Response) return authResult;


  const fy = await prisma.fiscalYear.findFirst({
    where: { id: fyId, associationId: id },
    include: {
      vouchers: {
        include: { lines: { include: { account: true } } },
      },
    },
  });

  if (!fy) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (fy.status === "closed")
    return NextResponse.json({ error: "Tilikausi on jo suljettu" }, { status: 400 });

  const account240 = await prisma.account.findFirst({
    where: { associationId: id, number: "240" },
  });
  if (!account240)
    return NextResponse.json({ error: "Tiliä 240 (Tilikauden voitto/tappio) ei löydy" }, { status: 400 });

  // Sum debit/credit per income and expense account across all vouchers
  const balances = new Map<string, { accountId: string; type: string; debit: number; credit: number }>();
  for (const voucher of fy.vouchers) {
    for (const line of voucher.lines) {
      const type = line.account.type;
      if (type !== "income" && type !== "expense") continue;
      const prev = balances.get(line.accountId) ?? { accountId: line.accountId, type, debit: 0, credit: 0 };
      balances.set(line.accountId, {
        ...prev,
        debit: prev.debit + line.debit,
        credit: prev.credit + line.credit,
      });
    }
  }

  // Build closing voucher lines — zero out income/expense into account 240
  const lines: { accountId: string; debit: number; credit: number; note: string }[] = [];
  let credit240 = 0;
  let debit240 = 0;

  for (const bal of balances.values()) {
    if (bal.type === "income") {
      // Income normally has credit balance; to close: debit income account, credit 240
      const net = bal.credit - bal.debit;
      if (Math.abs(net) < 0.005) continue;
      lines.push({ accountId: bal.accountId, debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0, note: "Tilinpäätös" });
      if (net > 0) credit240 += net;
      else debit240 += -net;
    } else {
      // Expense normally has debit balance; to close: credit expense account, debit 240
      const net = bal.debit - bal.credit;
      if (Math.abs(net) < 0.005) continue;
      lines.push({ accountId: bal.accountId, debit: net < 0 ? -net : 0, credit: net > 0 ? net : 0, note: "Tilinpäätös" });
      if (net > 0) debit240 += net;
      else credit240 += -net;
    }
  }

  if (lines.length === 0) {
    // Nothing to close — just mark as closed
    const closed = await prisma.fiscalYear.update({ where: { id: fyId }, data: { status: "closed" } });
    logAction(authResult.user.id, authResult.user.name ?? authResult.user.email ?? "Tuntematon", "UPDATE", "FiscalYear", fyId, `Tilikausi ${fy.year} suljettu`);
    return jsonResponse(closed);
  }

  // Add the account 240 counter-entry
  const net240 = credit240 - debit240; // positive = profit, negative = loss
  lines.push({
    accountId: account240.id,
    debit: net240 < 0 ? -net240 : 0,
    credit: net240 > 0 ? net240 : 0,
    note: "Tilinpäätös",
  });

  const lastVoucher = await prisma.voucher.findFirst({
    where: { fiscalYearId: fyId },
    orderBy: { number: "desc" },
  });
  const nextNumber = (lastVoucher?.number ?? 0) + 1;

  const result = await prisma.$transaction(async (tx) => {
    const voucher = await tx.voucher.create({
      data: {
        fiscalYearId: fyId,
        number: nextNumber,
        date: new Date(`${fy.year}-12-31T00:00:00.000Z`),
        description: `Tilinpäätöstosite ${fy.year}`,
        lines: { create: lines },
      },
      include: { lines: { include: { account: true } } },
    });
    const closed = await tx.fiscalYear.update({ where: { id: fyId }, data: { status: "closed" } });
    return { voucher, fiscalYear: closed };
  });

  logAction(authResult.user.id, authResult.user.name ?? authResult.user.email ?? "Tuntematon", "UPDATE", "FiscalYear", fyId, `Tilikausi ${fy.year} suljettu tilinpäätöstositteella #${result.voucher.number}`);

  return jsonResponse(result);
}
