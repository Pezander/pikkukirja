import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationAccess, requireAssociationEditor } from "@/lib/auth-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAssociationAccess(id);
  if (authResult instanceof Response) return authResult;

  const templates = await prisma.voucherTemplate.findMany({
    where: { associationId: id },
    include: { lines: { include: { account: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(templates);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAssociationEditor(id);
  if (authResult instanceof Response) return authResult;

  const body = await req.json();
  const { name, description, recurrence, dayOfMonth, lines } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Nimi on pakollinen." }, { status: 400 });
  }
  if (!lines?.length) {
    return NextResponse.json({ error: "Vähintään yksi rivi vaaditaan." }, { status: 400 });
  }

  const template = await prisma.voucherTemplate.create({
    data: {
      associationId: id,
      name: name.trim(),
      description: description ?? "",
      recurrence: recurrence ?? "none",
      dayOfMonth: dayOfMonth ?? 1,
      lines: {
        create: lines.map((l: { accountId: string; debit: number; credit: number; note?: string }) => ({
          accountId: l.accountId,
          debit: l.debit ?? 0,
          credit: l.credit ?? 0,
          note: l.note ?? "",
        })),
      },
    },
    include: { lines: { include: { account: true } } },
  });

  return NextResponse.json(template, { status: 201 });
}
