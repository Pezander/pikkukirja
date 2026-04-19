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
  if (fy.status !== "closed")
    return NextResponse.json({ error: "Sulje tilikausi ensin ennen siirtymistä" }, { status: 400 });

  const newYear = fy.year + 1;
  const existingNew = await prisma.fiscalYear.findUnique({
    where: { associationId_year: { associationId: id, year: newYear } },
  });
  if (existingNew)
    return NextResponse.json({ error: `Tilikausi ${newYear} on jo olemassa` }, { status: 409 });

  // Calculate ending balances for all accounts
  const balances = new Map<string, { accountId: string; type: string; number: string; debit: number; credit: number }>();
  for (const voucher of fy.vouchers) {
    for (const line of voucher.lines) {
      const prev = balances.get(line.accountId) ?? {
        accountId: line.accountId,
        type: line.account.type,
        number: line.account.number,
        debit: 0,
        credit: 0,
      };
      balances.set(line.accountId, {
        ...prev,
        debit: prev.debit + line.debit,
        credit: prev.credit + line.credit,
      });
    }
  }

  const account222 = await prisma.account.findFirst({ where: { associationId: id, number: "222" } });
  const account240 = await prisma.account.findFirst({ where: { associationId: id, number: "240" } });

  const openingLines: { accountId: string; debit: number; credit: number; note: string }[] = [];
  let retained222Net = 0; // net (debit - credit) of account 222 at year end
  let retained240Net = 0; // net (debit - credit) of account 240 at year end

  for (const bal of balances.values()) {
    // Skip income and expense — they were zeroed in the closing entry
    if (bal.type === "income" || bal.type === "expense") continue;

    // net > 0 = debit balance, net < 0 = credit balance
    const net = bal.debit - bal.credit;

    if (bal.accountId === account240?.id) {
      retained240Net = net;
      continue; // 240 is merged into 222 for the new year
    }

    if (bal.accountId === account222?.id) {
      retained222Net = net;
      continue; // handled separately below
    }

    if (Math.abs(net) < 0.005) continue;

    openingLines.push({
      accountId: bal.accountId,
      debit: net > 0 ? net : 0,
      credit: net < 0 ? -net : 0,
      note: "Avaustase",
    });
  }

  // Merge 222 + 240 into new year's 222 (accumulated retained earnings)
  if (account222) {
    const new222Net = retained222Net + retained240Net;
    if (Math.abs(new222Net) >= 0.005) {
      openingLines.push({
        accountId: account222.id,
        debit: new222Net > 0 ? new222Net : 0,
        credit: new222Net < 0 ? -new222Net : 0,
        note: "Avaustase",
      });
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const newFy = await tx.fiscalYear.create({
      data: { associationId: id, year: newYear, status: "open" },
    });

    if (openingLines.length > 0) {
      await tx.voucher.create({
        data: {
          fiscalYearId: newFy.id,
          number: 1,
          date: new Date(`${newYear}-01-01T00:00:00.000Z`),
          description: `Avaustase ${newYear}`,
          lines: { create: openingLines },
        },
      });
    }

    return newFy;
  });

  logAction(authResult.user.id, authResult.user.name ?? authResult.user.email ?? "Tuntematon", "CREATE", "FiscalYear", result.id, `Uusi tilikausi ${result.year} avattu`);

  return jsonResponse(result, { status: 201 });
}
