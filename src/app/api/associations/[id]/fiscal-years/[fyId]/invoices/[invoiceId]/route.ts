import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationEditor } from "@/lib/auth-helpers";
import { logAction } from "@/lib/audit";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fyId: string; invoiceId: string }> }
) {
  const { id, fyId, invoiceId } = await params;
  const authResult = await requireAssociationEditor(id);
  if (authResult instanceof Response) return authResult;

  const existingInvoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, fiscalYearId: fyId, fiscalYear: { associationId: id } },
    select: { id: true },
  });
  if (!existingInvoice) return NextResponse.json({ error: "Laskua ei löydy" }, { status: 404 });

  const body = await req.json();

  // Payment-only update (from mark-paid / payment dialog)
  if ("paidAt" in body || "paidAmount" in body) {
    const { paidAt, paidAmount } = body;
    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        paidAt: paidAt ? new Date(paidAt) : null,
        paidAmount: paidAmount ?? null,
      },
    });
    const status = invoice.paidAt ? "maksettu" : "avoin";
    logAction(authResult.user.id, authResult.user.name ?? authResult.user.email ?? "Tuntematon", "UPDATE", "Invoice", invoiceId, `Lasku ${invoice.invoiceNumber} merkitty: ${status}`);
    return NextResponse.json(invoice);
  }

  // Full invoice edit
  const { dueDate, issueDate, notes, lineItems } = body as {
    dueDate?: string;
    issueDate?: string;
    notes?: string;
    lineItems?: { name: string; units: number; unitPrice: number; amount: number }[];
  };

  const invoice = await prisma.$transaction(async (tx) => {
    if (lineItems) {
      await tx.invoiceLineItem.deleteMany({ where: { invoiceId } });
      await tx.invoiceLineItem.createMany({
        data: lineItems.map((li) => ({ ...li, invoiceId })),
      });
    }

    const existing = await tx.invoice.findUnique({ where: { id: invoiceId }, select: { adminFee: true } });
    const lineItemsTotal = lineItems ? lineItems.reduce((s, li) => s + li.amount, 0) : undefined;
    const totalAmount = lineItemsTotal !== undefined ? lineItemsTotal + (existing?.adminFee ?? 0) : undefined;
    return tx.invoice.update({
      where: { id: invoiceId },
      data: {
        ...(dueDate && { dueDate: new Date(dueDate) }),
        ...(issueDate && { issueDate: new Date(issueDate) }),
        ...(notes !== undefined && { notes }),
        ...(totalAmount !== undefined && { totalAmount }),
      },
      include: { lineItems: true },
    });
  });

  logAction(authResult.user.id, authResult.user.name ?? authResult.user.email ?? "Tuntematon", "UPDATE", "Invoice", invoiceId, `Lasku ${invoice.invoiceNumber} muokattu`);
  return NextResponse.json(invoice);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fyId: string; invoiceId: string }> }
) {
  const { id, fyId, invoiceId } = await params;
  const authResult = await requireAssociationEditor(id);
  if (authResult instanceof Response) return authResult;

  const inv = await prisma.invoice.findFirst({
    where: { id: invoiceId, fiscalYearId: fyId, fiscalYear: { associationId: id } },
  });
  if (!inv) return NextResponse.json({ error: "Laskua ei löydy" }, { status: 404 });
  await prisma.invoice.delete({ where: { id: invoiceId } });
  logAction(authResult.user.id, authResult.user.name ?? authResult.user.email ?? "Tuntematon", "DELETE", "Invoice", invoiceId, `Lasku ${inv?.invoiceNumber ?? invoiceId} poistettu`);
  return new NextResponse(null, { status: 204 });
}
