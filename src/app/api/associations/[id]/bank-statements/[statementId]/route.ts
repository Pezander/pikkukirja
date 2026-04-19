import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationAccess, requireAssociationEditor } from "@/lib/auth-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; statementId: string }> }
) {
  const { id, statementId } = await params;
  const authResult = await requireAssociationAccess(id);
  if (authResult instanceof Response) return authResult;

  const statement = await prisma.bankStatement.findFirst({
    where: { id: statementId, associationId: id },
    include: {
      transactions: {
        orderBy: { date: "asc" },
        include: { voucher: { select: { id: true, number: true, description: true } } },
      },
    },
  });

  if (!statement) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(statement);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; statementId: string }> }
) {
  const { id, statementId } = await params;
  const authResult = await requireAssociationEditor(id);
  if (authResult instanceof Response) return authResult;

  const existing = await prisma.bankStatement.findFirst({ where: { id: statementId, associationId: id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.bankStatement.delete({ where: { id: statementId } });
  return new NextResponse(null, { status: 204 });
}
