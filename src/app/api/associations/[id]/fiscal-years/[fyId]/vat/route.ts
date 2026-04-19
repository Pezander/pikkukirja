import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationAccess, requireAssociationEditor } from "@/lib/auth-helpers";

function quarterBounds(year: number, q: number) {
  const month = (q - 1) * 3; // 0, 3, 6, 9
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 3, 0, 23, 59, 59);
  return { start, end };
}

function monthBounds(year: number, m: number) {
  const start = new Date(year, m, 1);
  const end = new Date(year, m + 1, 0, 23, 59, 59);
  return { start, end };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fyId: string }> }
) {
  const { id, fyId } = await params;
  const authResult = await requireAssociationAccess(id);
  if (authResult instanceof Response) return authResult;

  const url = new URL(req.url);
  const periodType = url.searchParams.get("periodType") ?? "quarter";

  const [fy, savedPeriods] = await Promise.all([
    prisma.fiscalYear.findUnique({
      where: { id: fyId },
      include: {
        vouchers: { include: { lines: { include: { account: true } } } },
      },
    }),
    prisma.vatPeriod.findMany({ where: { fiscalYearId: fyId }, orderBy: { periodStart: "asc" } }),
  ]);

  if (!fy || fy.associationId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const year = fy.year;
  const periods: { label: string; start: Date; end: Date; vatCollected: number; vatDeductible: number; vatPayable: number; saved?: typeof savedPeriods[0] }[] = [];

  const count = periodType === "month" ? 12 : 4;
  for (let i = 0; i < count; i++) {
    const bounds = periodType === "month" ? monthBounds(year, i) : quarterBounds(year, i + 1);
    const label = periodType === "month"
      ? new Date(year, i, 1).toLocaleString("fi-FI", { month: "long" })
      : `Q${i + 1}`;

    let vatCollected = 0;  // output VAT (myynti-ALV)
    let vatDeductible = 0; // input VAT (osto-ALV)

    for (const v of fy.vouchers) {
      const vDate = new Date(v.date);
      if (vDate < bounds.start || vDate > bounds.end) continue;
      for (const line of v.lines) {
        if (line.vatAmount === 0) continue;
        if (line.account.type === "income") vatCollected += line.vatAmount;
        else if (line.account.type === "expense") vatDeductible += line.vatAmount;
      }
    }

    const saved = savedPeriods.find((p) => {
      const ps = new Date(p.periodStart);
      return ps.getFullYear() === bounds.start.getFullYear() && ps.getMonth() === bounds.start.getMonth();
    });

    periods.push({ label, start: bounds.start, end: bounds.end, vatCollected, vatDeductible, vatPayable: vatCollected - vatDeductible, saved });
  }

  return NextResponse.json({ periods, periodType });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fyId: string }> }
) {
  const { id, fyId } = await params;
  const authResult = await requireAssociationEditor(id);
  if (authResult instanceof Response) return authResult;

  const body = await req.json();
  const { periodStart, periodEnd, periodType, vatCollected, vatDeductible, vatPayable } = body;

  const fy = await prisma.fiscalYear.findUnique({ where: { id: fyId } });
  if (!fy || fy.associationId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Upsert by periodStart
  const existing = await prisma.vatPeriod.findFirst({ where: { fiscalYearId: fyId, periodStart: new Date(periodStart) } });
  let period;
  if (existing) {
    period = await prisma.vatPeriod.update({
      where: { id: existing.id },
      data: { status: "submitted", submittedAt: new Date(), vatCollected, vatDeductible, vatPayable },
    });
  } else {
    period = await prisma.vatPeriod.create({
      data: { fiscalYearId: fyId, periodStart: new Date(periodStart), periodEnd: new Date(periodEnd), periodType: periodType ?? "quarter", status: "submitted", submittedAt: new Date(), vatCollected, vatDeductible, vatPayable },
    });
  }

  return NextResponse.json(period);
}
