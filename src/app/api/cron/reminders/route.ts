import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readCronConfig } from "@/lib/cron-config";
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

export async function GET(req: NextRequest) {
  const config = readCronConfig();

  if (!config.enabled) {
    return NextResponse.json({ ok: false, message: "Cron reminders disabled." }, { status: 200 });
  }

  const authHeader = req.headers.get("authorization");
  const key = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!key || key !== config.key) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSmtpConfigured()) {
    return NextResponse.json({ error: "SMTP not configured" }, { status: 503 });
  }

  const now = new Date();

  // Get all open fiscal years
  const openFiscalYears = await prisma.fiscalYear.findMany({
    where: { status: "open" },
    include: { association: true },
  });

  const transport = createTransport();
  let totalSent = 0;
  let totalNoEmail = 0;
  const errors: string[] = [];

  for (const fy of openFiscalYears) {
    const invoices = await prisma.invoice.findMany({
      where: {
        fiscalYearId: fy.id,
        paidAt: null,
        ...(config.overdueOnly ? { dueDate: { lt: now } } : {}),
      },
      include: { member: true, lineItems: true },
    });

    for (const invoice of invoices) {
      if (!invoice.member.email) { totalNoEmail++; continue; }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const element = React.createElement(InvoicePDF, { invoice, association: fy.association } as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfBuffer = await renderToBuffer(element as any);

        await transport.sendMail({
          from: SMTP_FROM(),
          to: invoice.member.email,
          subject: `MUISTUTUS: Lasku ${invoice.invoiceNumber} – ${fy.association.name}`,
          html: `
            <p>Hyvä ${escapeHtml(invoice.member.name)},</p>
            <p>muistutus avoimesta laskusta <strong>${escapeHtml(invoice.invoiceNumber)}</strong> — <strong>${escapeHtml(fy.association.name)}</strong>.</p>
            <table style="border-collapse:collapse;margin:12px 0">
              <tr><td style="padding:3px 12px 3px 0;color:#555">Eräpäivä</td><td><strong>${fmtDate(invoice.dueDate.toISOString())}</strong></td></tr>
              <tr><td style="padding:3px 12px 3px 0;color:#555">Summa</td><td><strong>${fmtEur(invoice.totalAmount)}</strong></td></tr>
              <tr><td style="padding:3px 12px 3px 0;color:#555">Viitenumero</td><td><code>${escapeHtml(invoice.member.referenceNumber)}</code></td></tr>
              ${fy.association.iban ? `<tr><td style="padding:3px 12px 3px 0;color:#555">IBAN</td><td>${escapeHtml(fy.association.iban)}</td></tr>` : ""}
            </table>
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
        totalSent++;
      } catch (err) {
        errors.push(`${fy.association.name} / ${invoice.invoiceNumber}: ${(err as Error).message}`);
      }
    }
  }

  return NextResponse.json({ ok: true, sent: totalSent, noEmail: totalNoEmail, errors });
}
