import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationAccess } from "@/lib/auth-helpers";

export async function POST(
  req: NextRequest,
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

  const { date, description, totalDebit, excludeVoucherId } = await req.json();

  if (!date || !totalDebit || !description) {
    return NextResponse.json({ duplicates: [] });
  }

  const targetDate = new Date(date);
  const threeDays = 3 * 24 * 60 * 60 * 1000;
  const dateMin = new Date(targetDate.getTime() - threeDays);
  const dateMax = new Date(targetDate.getTime() + threeDays);

  const candidates = await prisma.voucher.findMany({
    where: {
      fiscalYearId: fyId,
      date: { gte: dateMin, lte: dateMax },
      ...(excludeVoucherId ? { id: { not: excludeVoucherId } } : {}),
    },
    include: { lines: true },
    orderBy: { number: "asc" },
  });

  // Tokenize description for overlap check (words longer than 3 chars)
  const tokens = description.toLowerCase().split(/\s+/).filter((t: string) => t.length > 3);

  const duplicates = candidates.filter((v) => {
    // Amount proximity check: within 2%
    const voucherDebit = v.lines.reduce((s, l) => s + l.debit, 0);
    if (voucherDebit === 0 && totalDebit > 0) return false;
    const max = Math.max(voucherDebit, totalDebit);
    const proximity = max > 0 ? Math.abs(voucherDebit - totalDebit) / max : 0;
    if (proximity > 0.02) return false;

    // Description overlap check: any token from the new description appears in the existing description
    if (tokens.length > 0) {
      const vDesc = v.description.toLowerCase();
      const hasOverlap = tokens.some((t: string) => vDesc.includes(t));
      if (!hasOverlap) return false;
    }

    return true;
  });

  return NextResponse.json({
    duplicates: duplicates.map((v) => ({
      id: v.id,
      number: v.number,
      date: v.date,
      description: v.description,
      totalDebit: v.lines.reduce((s, l) => s + l.debit, 0),
    })),
  });
}
