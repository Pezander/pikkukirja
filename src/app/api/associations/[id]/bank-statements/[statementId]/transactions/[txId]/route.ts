import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationEditor } from "@/lib/auth-helpers";

// PATCH — match or unmatch a bank transaction to a voucher
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; statementId: string; txId: string }> }
) {
  const { id, statementId, txId } = await params;
  const authResult = await requireAssociationEditor(id);
  if (authResult instanceof Response) return authResult;


  // Verify statement belongs to association
  const statement = await prisma.bankStatement.findFirst({ where: { id: statementId, associationId: id } });
  if (!statement) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const voucherId: string | null = body.voucherId ?? null;

  const updated = await prisma.bankTransaction.update({
    where: { id: txId },
    data: { voucherId },
    include: { voucher: { select: { id: true, number: true, description: true } } },
  });

  return NextResponse.json(updated);
}
