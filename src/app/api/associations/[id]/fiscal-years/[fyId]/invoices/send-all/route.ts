import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationEditor } from "@/lib/auth-helpers";
import { isSmtpConfigured, createTransport, SMTP_FROM } from "@/lib/smtp";
import { escapeHtml } from "@/lib/utils";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePDF } from "@/components/invoice/InvoicePDF";
import React from "react";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fi-FI");
}
function fmtEur(n: number) {
  return n.toFixed(2).replace(".", ",") + " €";
}

export async function POST(
  _req: NextRequest,
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

  if (!isSmtpConfigured()) {
    return NextResponse.json(
      { error: "SMTP ei ole konfiguroitu. Lisää SMTP_HOST, SMTP_USER ja SMTP_PASS ympäristömuuttujat." },
      { status: 503 }
    );
  }


  const [invoices, association] = await Promise.all([
    prisma.invoice.findMany({
      where: { fiscalYearId: fyId },
      include: { member: true, lineItems: true },
      orderBy: { invoiceNumber: "asc" },
    }),
    prisma.association.findUnique({ where: { id } }),
  ]);

  if (!association) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const transport = createTransport();
  let sent = 0;
  let noEmail = 0;
  const failed: string[] = [];

  for (const invoice of invoices) {
    if (!invoice.member.email) { noEmail++; continue; }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const element = React.createElement(InvoicePDF, { invoice, association } as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfBuffer = await renderToBuffer(element as any);

      await transport.sendMail({
        from: SMTP_FROM(),
        to: invoice.member.email,
        subject: `Lasku ${invoice.invoiceNumber} – ${association.name}`,
        html: `
          <p>Hyvä ${escapeHtml(invoice.member.name)},</p>
          <p>ohessa lasku <strong>${escapeHtml(invoice.invoiceNumber)}</strong> organisaatiolta <strong>${escapeHtml(association.name)}</strong>.</p>
          <table style="border-collapse:collapse;margin:12px 0">
            <tr><td style="padding:3px 12px 3px 0;color:#555">Eräpäivä</td><td><strong>${fmtDate(invoice.dueDate.toISOString())}</strong></td></tr>
            <tr><td style="padding:3px 12px 3px 0;color:#555">Summa</td><td><strong>${fmtEur(invoice.totalAmount)}</strong></td></tr>
            <tr><td style="padding:3px 12px 3px 0;color:#555">Viitenumero</td><td><code>${escapeHtml(invoice.member.referenceNumber)}</code></td></tr>
            ${association.iban ? `<tr><td style="padding:3px 12px 3px 0;color:#555">IBAN</td><td>${escapeHtml(association.iban)}</td></tr>` : ""}
          </table>
          <p>Lasku on liitetty tähän viestiin PDF-muodossa.</p>
          <p style="color:#555">Ystävällisin terveisin,<br>${escapeHtml(association.name)}</p>
        `,
        attachments: [
          {
            filename: `lasku_${invoice.invoiceNumber}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      });

      await prisma.invoice.update({ where: { id: invoice.id }, data: { sentAt: new Date() } });
      sent++;
    } catch (err) {
      failed.push(`${invoice.invoiceNumber} (${invoice.member.name}): ${(err as Error).message}`);
    }
  }

  return NextResponse.json({ sent, noEmail, failed });
}
