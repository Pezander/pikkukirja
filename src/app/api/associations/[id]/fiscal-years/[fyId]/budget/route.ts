import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationAccess, requireAssociationEditor } from "@/lib/auth-helpers";

// GET — return all budget lines for the fiscal year (merged with income/expense accounts)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fyId: string }> }
) {
  const { id, fyId } = await params;
  const authResult = await requireAssociationAccess(id);
  if (authResult instanceof Response) return authResult;

  const fyOk = await prisma.fiscalYear.findFirst({
    where: { id: fyId, associationId: id },
    select: { id: true },
  });
  if (!fyOk) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [accounts, budgetLines] = await Promise.all([
    prisma.account.findMany({
      where: { associationId: id, type: { in: ["income", "expense"] } },
      orderBy: { number: "asc" },
    }),
    prisma.budgetLine.findMany({
      where: { fiscalYearId: fyId },
    }),
  ]);

  const budgetMap = new Map(budgetLines.map((b) => [b.accountId, b.amount]));

  const result = accounts.map((a) => ({
    accountId: a.id,
    accountNumber: a.number,
    accountName: a.name,
    accountType: a.type,
    budgetAmount: budgetMap.get(a.id) ?? 0,
  }));

  return NextResponse.json(result);
}

// PUT — upsert budget lines for the fiscal year
export async function PUT(
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

  const body: { accountId: string; amount: number }[] = await req.json();

  const accountIds = body.map((l) => l.accountId);
  const validCount = await prisma.account.count({
    where: { id: { in: accountIds }, associationId: id },
  });
  if (validCount !== accountIds.length) {
    return NextResponse.json({ error: "Account reference mismatch" }, { status: 400 });
  }

  await Promise.all(
    body.map((line) =>
      prisma.budgetLine.upsert({
        where: { accountId_fiscalYearId: { accountId: line.accountId, fiscalYearId: fyId } },
        create: { accountId: line.accountId, fiscalYearId: fyId, amount: line.amount },
        update: { amount: line.amount },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
