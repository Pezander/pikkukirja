import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readReportScheduleConfig } from "@/lib/report-schedule-config";
import { isSmtpConfigured, createTransport, SMTP_FROM } from "@/lib/smtp";

function fmtEur(n: number) {
  return n.toFixed(2).replace(".", ",") + " €";
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("fi-FI");
}

function agingBucket(dueDate: Date): string {
  const days = Math.floor((Date.now() - dueDate.getTime()) / 86400000);
  if (days < 0)  return "Ei erääntynyt";
  if (days <= 30) return "1–30 pv";
  if (days <= 90) return "31–90 pv";
  return "Yli 90 pv";
}

const BUCKET_ORDER = ["Ei erääntynyt", "1–30 pv", "31–90 pv", "Yli 90 pv"];

function buildInvoiceAgingHtml(assocName: string, invoices: { invoiceNumber: string; dueDate: Date; totalAmount: number; paidAmount: number | null; member: { name: string } }[]): string {
  const open = invoices.filter((i) => !i.paidAmount || i.paidAmount < i.totalAmount - 0.005);
  if (open.length === 0) return `<p>Ei avoimia laskuja – ${assocName}</p>`;

  const grouped: Record<string, typeof open> = {};
  for (const inv of open) {
    const bucket = agingBucket(inv.dueDate);
    if (!grouped[bucket]) grouped[bucket] = [];
    grouped[bucket].push(inv);
  }

  let html = `<h2 style="font-size:16px;margin:24px 0 8px">${assocName} — Laskujen ikäanalyysi</h2>`;
  html += `<table style="border-collapse:collapse;width:100%;font-size:13px">`;
  html += `<thead><tr style="background:#f3f4f6"><th style="text-align:left;padding:6px 12px">Lasku</th><th style="text-align:left;padding:6px 12px">Jäsen</th><th style="text-align:left;padding:6px 12px">Eräpäivä</th><th style="text-align:left;padding:6px 12px">Ikä</th><th style="text-align:right;padding:6px 12px">Avoinna</th></tr></thead>`;
  html += `<tbody>`;

  for (const bucket of BUCKET_ORDER) {
    const rows = grouped[bucket];
    if (!rows) continue;
    html += `<tr><td colspan="5" style="padding:6px 12px;font-weight:600;background:#e5e7eb">${bucket}</td></tr>`;
    for (const inv of rows) {
      const remaining = inv.totalAmount - (inv.paidAmount ?? 0);
      html += `<tr style="border-top:1px solid #e5e7eb">`;
      html += `<td style="padding:4px 12px;font-family:monospace">${inv.invoiceNumber}</td>`;
      html += `<td style="padding:4px 12px">${inv.member.name}</td>`;
      html += `<td style="padding:4px 12px">${fmtDate(inv.dueDate)}</td>`;
      html += `<td style="padding:4px 12px">${bucket}</td>`;
      html += `<td style="padding:4px 12px;text-align:right">${fmtEur(remaining)}</td>`;
      html += `</tr>`;
    }
  }

  const total = open.reduce((s, i) => s + i.totalAmount - (i.paidAmount ?? 0), 0);
  html += `<tr style="border-top:2px solid #9ca3af;font-weight:600"><td colspan="4" style="padding:6px 12px">Yhteensä</td><td style="padding:6px 12px;text-align:right">${fmtEur(total)}</td></tr>`;
  html += `</tbody></table>`;
  return html;
}

function buildIncomeStatementHtml(assocName: string, fyYear: number, vouchers: { lines: { debit: number; credit: number; account: { type: string; number: string; name: string } }[] }[]): string {
  const totals: Record<string, { name: string; number: string; debit: number; credit: number }> = {};

  for (const v of vouchers) {
    for (const l of v.lines) {
      const a = l.account;
      if (a.type !== "income" && a.type !== "expense") continue;
      if (!totals[a.number]) totals[a.number] = { name: a.name, number: a.number, debit: 0, credit: 0 };
      totals[a.number].debit += l.debit;
      totals[a.number].credit += l.credit;
    }
  }

  const income = Object.values(totals).filter((a) =>
    vouchers.some((v) => v.lines.some((l) => l.account.number === a.number && l.account.type === "income"))
  );
  const expense = Object.values(totals).filter((a) =>
    vouchers.some((v) => v.lines.some((l) => l.account.number === a.number && l.account.type === "expense"))
  );

  const totalIncome = income.reduce((s, a) => s + (a.credit - a.debit), 0);
  const totalExpense = expense.reduce((s, a) => s + (a.debit - a.credit), 0);
  const result = totalIncome - totalExpense;

  let html = `<h2 style="font-size:16px;margin:24px 0 8px">${assocName} — Tuloslaskelma ${fyYear}</h2>`;
  html += `<table style="border-collapse:collapse;width:100%;font-size:13px">`;
  html += `<thead><tr style="background:#f3f4f6"><th style="text-align:left;padding:6px 12px">Tili</th><th style="text-align:right;padding:6px 12px">Summa</th></tr></thead>`;
  html += `<tbody>`;
  html += `<tr><td colspan="2" style="padding:6px 12px;font-weight:600;background:#e5e7eb">TUOTOT</td></tr>`;
  for (const a of income.sort((x, y) => x.number.localeCompare(y.number))) {
    html += `<tr style="border-top:1px solid #e5e7eb"><td style="padding:4px 12px">${a.number} ${a.name}</td><td style="padding:4px 12px;text-align:right">${fmtEur(a.credit - a.debit)}</td></tr>`;
  }
  html += `<tr style="font-weight:600;border-top:2px solid #9ca3af"><td style="padding:4px 12px">Tuotot yhteensä</td><td style="padding:4px 12px;text-align:right">${fmtEur(totalIncome)}</td></tr>`;
  html += `<tr><td colspan="2" style="padding:6px 12px;font-weight:600;background:#e5e7eb">KULUT</td></tr>`;
  for (const a of expense.sort((x, y) => x.number.localeCompare(y.number))) {
    html += `<tr style="border-top:1px solid #e5e7eb"><td style="padding:4px 12px">${a.number} ${a.name}</td><td style="padding:4px 12px;text-align:right">${fmtEur(a.debit - a.credit)}</td></tr>`;
  }
  html += `<tr style="font-weight:600;border-top:2px solid #9ca3af"><td style="padding:4px 12px">Kulut yhteensä</td><td style="padding:4px 12px;text-align:right">${fmtEur(totalExpense)}</td></tr>`;
  html += `<tr style="font-weight:700;border-top:3px solid #374151;background:#f9fafb"><td style="padding:8px 12px">TULOS</td><td style="padding:8px 12px;text-align:right;color:${result >= 0 ? "#16a34a" : "#dc2626"}">${fmtEur(result)}</td></tr>`;
  html += `</tbody></table>`;
  return html;
}

export async function GET(req: NextRequest) {
  const config = readReportScheduleConfig();

  if (!config.enabled) {
    return NextResponse.json({ ok: false, message: "Report delivery disabled." });
  }

  const authHeader = req.headers.get("authorization");
  const key = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!key || key !== config.key) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSmtpConfigured()) {
    return NextResponse.json({ error: "SMTP not configured" }, { status: 503 });
  }

  if (config.recipients.length === 0) {
    return NextResponse.json({ error: "No recipients configured" }, { status: 400 });
  }

  // Load open fiscal years, filtered by configured associations
  const fiscalYears = await prisma.fiscalYear.findMany({
    where: {
      status: "open",
      ...(config.associationIds.length > 0 ? { associationId: { in: config.associationIds } } : {}),
    },
    include: {
      association: true,
      ...(config.reportType === "income-statement"
        ? { vouchers: { include: { lines: { include: { account: true } } } } }
        : { invoices: { include: { member: true } } }),
    },
    orderBy: { association: { name: "asc" } },
  });

  if (fiscalYears.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "No open fiscal years found." });
  }

  let body = `<p style="color:#6b7280;font-size:13px">Ajoitettu raportti – ${new Date().toLocaleDateString("fi-FI")}</p>`;

  for (const fy of fiscalYears) {
    if (config.reportType === "invoice-aging") {
      const invoices = (fy as { invoices?: { invoiceNumber: string; dueDate: Date; totalAmount: number; paidAmount: number | null; member: { name: string } }[] }).invoices ?? [];
      body += buildInvoiceAgingHtml(fy.association.name, invoices);
    } else {
      const vouchers = (fy as { vouchers?: { lines: { debit: number; credit: number; account: { type: string; number: string; name: string } }[] }[] }).vouchers ?? [];
      body += buildIncomeStatementHtml(fy.association.name, fy.year, vouchers);
    }
  }

  const subject = config.reportType === "invoice-aging"
    ? `Laskujen ikäanalyysi – ${new Date().toLocaleDateString("fi-FI")}`
    : `Tuloslaskelma – ${new Date().toLocaleDateString("fi-FI")}`;

  const transport = createTransport();
  await transport.sendMail({
    from: SMTP_FROM(),
    to: config.recipients.join(", "),
    subject,
    html: `<div style="font-family:sans-serif;max-width:800px;margin:0 auto">${body}</div>`,
  });

  return NextResponse.json({ ok: true, sent: 1, recipients: config.recipients.length });
}
