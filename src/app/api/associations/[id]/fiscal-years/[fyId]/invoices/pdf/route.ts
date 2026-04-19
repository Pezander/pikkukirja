import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationAccess } from "@/lib/auth-helpers";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePDF } from "@/components/invoice/InvoicePDF";
import { buildFinnishBarcodeString, generateFinnishBarcodeImage } from "@/lib/finnish-barcode";
import React from "react";
import path from "path";
import fs from "fs";

// GET /api/associations/:id/fiscal-years/:fyId/invoices/pdf?invoiceId=xxx
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fyId: string }> }
) {
  const { id, fyId } = await params;
  const authResult = await requireAssociationAccess(id);
  if (authResult instanceof Response) return authResult;

  const invoiceId = req.nextUrl.searchParams.get("invoiceId");

  const association = await prisma.association.findUnique({ where: { id } });
  if (!association) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fyOk = await prisma.fiscalYear.findFirst({
    where: { id: fyId, associationId: id },
    select: { id: true },
  });
  if (!fyOk) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const invoiceWhere = invoiceId
    ? { id: invoiceId, fiscalYearId: fyId }
    : { fiscalYearId: fyId };

  const invoices = await prisma.invoice.findMany({
    where: invoiceWhere,
    include: { member: true, lineItems: true },
    orderBy: { invoiceNumber: "asc" },
  });

  if (invoices.length === 0) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const raw = invoices[0];

  // Normalize Prisma Date objects to ISO strings for the PDF component
  const invoice = {
    ...raw,
    issueDate: raw.issueDate.toISOString(),
    dueDate: raw.dueDate.toISOString(),
    paidAt: raw.paidAt?.toISOString() ?? null,
  };

  const logoPath = path.join(process.cwd(), "public", "logo-pdf.png");
  const logoSrc = fs.existsSync(logoPath)
    ? "data:image/png;base64," + fs.readFileSync(logoPath).toString("base64")
    : undefined;

  const virtuaaliviivakoodi = association.iban && invoice.member.referenceNumber
    ? buildFinnishBarcodeString({
        iban: association.iban,
        amountEur: invoice.totalAmount,
        referenceNumber: invoice.member.referenceNumber,
        dueDate: invoice.dueDate,
      }) ?? undefined
    : undefined;
  const barcodeSrc = virtuaaliviivakoodi
    ? (await generateFinnishBarcodeImage(virtuaaliviivakoodi)) ?? undefined
    : undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(InvoicePDF, { invoice, association, logoSrc, barcodeSrc, virtuaaliviivakoodi } as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as any);

  const filename = `lasku_${invoice.invoiceNumber}_${invoice.member.name.replace(/\s+/g, "_")}.pdf`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
