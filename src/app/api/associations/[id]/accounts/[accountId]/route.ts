import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationEditor } from "@/lib/auth-helpers";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; accountId: string }> }
) {
  const { id, accountId } = await params;
  const result = await requireAssociationEditor(id);
  if (result instanceof Response) return result;

  const existing = await prisma.account.findFirst({
    where: { id: accountId, associationId: id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const account = await prisma.account.update({
    where: { id: accountId },
    data: { name: body.name, number: body.number, type: body.type },
  });
  return NextResponse.json(account);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; accountId: string }> }
) {
  const { id, accountId } = await params;
  const result = await requireAssociationEditor(id);
  if (result instanceof Response) return result;

  const existing = await prisma.account.findFirst({
    where: { id: accountId, associationId: id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const lineCount = await prisma.voucherLine.count({ where: { accountId } });
  if (lineCount > 0) {
    return NextResponse.json(
      { error: "Tiliä ei voi poistaa, koska sillä on kirjauksia." },
      { status: 409 }
    );
  }
  await prisma.account.delete({ where: { id: accountId } });
  return new NextResponse(null, { status: 204 });
}
