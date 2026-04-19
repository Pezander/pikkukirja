import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationAccess } from "@/lib/auth-helpers";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePDF } from "@/components/invoice/InvoicePDF";
import { buildFinnishBarcodeString, generateFinnishBarcodeImage } from "@/lib/finnish-barcode";
import JSZip from "jszip";
import React from "react";

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

  const [association, invoices] = await Promise.all([
    prisma.association.findUnique({ where: { id } }),
    prisma.invoice.findMany({
      where: { fiscalYearId: fyId },
      include: { member: true, lineItems: true },
      orderBy: { invoiceNumber: "asc" },
    }),
  ]);

  if (!association) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (invoices.length === 0) return NextResponse.json({ error: "Ei laskuja" }, { status: 404 });

  const zip = new JSZip();

  for (const raw of invoices) {
    const invoice = {
      ...raw,
      issueDate: raw.issueDate.toISOString(),
      dueDate: raw.dueDate.toISOString(),
      paidAt: raw.paidAt?.toISOString() ?? null,
    };

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
    const element = React.createElement(InvoicePDF, { invoice, association, barcodeSrc, virtuaaliviivakoodi } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(element as any);
    const safeName = invoice.member.name.replace(/[^a-zA-Z0-9äöåÄÖÅ_\-]/g, "_");
    zip.file(`lasku_${invoice.invoiceNumber}_${safeName}.pdf`, buffer);
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const fy = await prisma.fiscalYear.findUnique({ where: { id: fyId } });
  const filename = `laskut_${association.name.replace(/\s+/g, "_")}_${fy?.year ?? ""}.zip`;

  return new NextResponse(zipBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
