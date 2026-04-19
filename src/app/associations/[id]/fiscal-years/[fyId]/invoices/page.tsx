"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, FileText, Download, RefreshCw, AlertCircle, Mail, Upload, CheckCircle2, Search, Bell, CreditCard, Trash2, Pencil, Plus, X } from "lucide-react";
import { getOrgLabels } from "@/lib/orgLabels";

interface LineItem {
  name: string;
  units: number;
  unitPrice: number;
  amount: number;
}

interface Payment {
  id: string;
  amount: number;
  paidAt: string;
  note: string;
}

interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  paidAt: string | null;
  paidAmount: number | null;
  sentAt: string | null;
  member: { id: string; name: string; referenceNumber: string; email: string | null };
  lineItems: LineItem[];
  payments: Payment[];
}

interface CsvMatch {
  invoiceId: string;
  invoiceNumber: string;
  memberName: string;
  paidAt: string;
  paidAmount: number;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fi-FI");
}

function formatEur(n: number) {
  return n.toFixed(2).replace(".", ",") + " €";
}

function isoDate(d: Date) {
  return d.toISOString().split("T")[0];
}

/** Parse Finnish bank CSV (semicolon-delimited, columns include Viite, Kirjauspäivä, Määrä) */
function parseFinnishBankCsv(text: string, invoices: InvoiceRecord[]): { matched: CsvMatch[]; unmatched: number } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { matched: [], unmatched: 0 };

  // Detect separator
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim().replace(/^"|"$/g, ""));

  const colIdx = (names: string[]) => {
    for (const n of names) {
      const i = headers.findIndex((h) => h.toLowerCase().includes(n.toLowerCase()));
      if (i !== -1) return i;
    }
    return -1;
  };

  const refCol = colIdx(["viite", "reference"]);
  const dateCol = colIdx(["kirjauspäivä", "kirjauspaiva", "päivä", "paiva", "date"]);
  const amountCol = colIdx(["määrä", "maara", "summa", "amount"]);

  if (refCol === -1 || dateCol === -1 || amountCol === -1) return { matched: [], unmatched: 0 };

  // Build ref → invoice map (strip spaces/leading zeros for matching)
  const refMap = new Map<string, InvoiceRecord>();
  for (const inv of invoices) {
    if (inv.member.referenceNumber) {
      const clean = inv.member.referenceNumber.replace(/\s/g, "").replace(/^0+/, "");
      refMap.set(clean, inv);
    }
  }

  const matched: CsvMatch[] = [];
  let unmatched = 0;

  for (const line of lines.slice(1)) {
    const cols = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cols.length <= Math.max(refCol, dateCol, amountCol)) continue;

    const rawRef = cols[refCol].replace(/\s/g, "").replace(/^0+/, "");
    const rawAmount = parseFloat(cols[amountCol].replace(",", ".").replace(/\s/g, ""));
    const rawDate = cols[dateCol];

    if (!rawRef || isNaN(rawAmount) || rawAmount <= 0) continue;

    // Parse Finnish date dd.mm.yyyy or ISO yyyy-mm-dd
    let parsedDate: Date | null = null;
    const fiMatch = rawDate.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (fiMatch) {
      parsedDate = new Date(`${fiMatch[3]}-${fiMatch[2].padStart(2, "0")}-${fiMatch[1].padStart(2, "0")}`);
    } else {
      parsedDate = new Date(rawDate);
    }
    if (!parsedDate || isNaN(parsedDate.getTime())) continue;

    const inv = refMap.get(rawRef);
    if (inv && !inv.paidAt) {
      matched.push({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        memberName: inv.member.name,
        paidAt: isoDate(parsedDate),
        paidAmount: rawAmount,
      });
    } else {
      unmatched++;
    }
  }

  return { matched, unmatched };
}

interface Account {
  id: string;
  number: string;
  name: string;
}

export default function InvoicesPage() {
  const { id, fyId } = useParams<{ id: string; fyId: string }>();
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [assocName, setAssocName] = useState("");
  const [assocType, setAssocType] = useState("tiekunta");
  const [fyYear, setFyYear] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "unpaid" | "overdue">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Email state
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendAllResult, setSendAllResult] = useState<{ sent: number; noEmail: number; failed: string[] } | null>(null);

  // Reminder state
  const [reminderOpen, setReminderOpen] = useState(false);
  const [overdueReminderOnly, setOverdueReminderOnly] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [reminderResult, setReminderResult] = useState<{ sent: number; noEmail: number; failed: string[]; skipped: number } | null>(null);

  // Payment dialog state
  const [paymentInvoice, setPaymentInvoice] = useState<InvoiceRecord | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(isoDate(new Date()));
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentCreateVoucher, setPaymentCreateVoucher] = useState(true);
  const [paymentDebitAccountId, setPaymentDebitAccountId] = useState("");
  const [paymentCreditAccountId, setPaymentCreditAccountId] = useState("");
  const [paymentVoucherCreated, setPaymentVoucherCreated] = useState<number | null>(null);

  // Edit invoice dialog state
  const [editInvoice, setEditInvoice] = useState<InvoiceRecord | null>(null);
  const [editDueDate, setEditDueDate] = useState("");
  const [editIssueDate, setEditIssueDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editLineItems, setEditLineItems] = useState<{ name: string; units: number; unitPrice: number; amount: number }[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // CSV import state
  const [importOpen, setImportOpen] = useState(false);
  const [csvMatches, setCsvMatches] = useState<CsvMatch[]>([]);
  const [csvUnmatched, setCsvUnmatched] = useState(0);
  const [createVouchers, setCreateVouchers] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [debitAccountId, setDebitAccountId] = useState("");
  const [creditAccountId, setCreditAccountId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvFileSelected, setCsvFileSelected] = useState(false);

  // Unit-based form state (tiekunta / taloyhtiö)
  const [unitPrice, setUnitPrice] = useState("");
  const [adminFee, setAdminFee] = useState("10");

  // Flat-fee form state (metsästysseura)
  const [memberTypeFees, setMemberTypeFees] = useState<Record<string, string>>({});

  const [issueDate, setIssueDate] = useState(isoDate(new Date()));
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return isoDate(d);
  });

  const load = useCallback(async () => {
    const [invRes, aRes, fyRes, smtpRes, accRes] = await Promise.all([
      fetch(`/api/associations/${id}/fiscal-years/${fyId}/invoices`),
      fetch(`/api/associations/${id}`),
      fetch(`/api/associations/${id}/fiscal-years/${fyId}`),
      fetch(`/api/admin/smtp-status`),
      fetch(`/api/associations/${id}/accounts`),
    ]);
    setInvoices(await invRes.json());
    const assoc = await aRes.json();
    setAssocName(assoc.name);
    setAssocType(assoc.type ?? "tiekunta");
    const fy = await fyRes.json();
    setFyYear(fy.year);
    if (smtpRes.ok) {
      const s = await smtpRes.json();
      setSmtpConfigured(s.configured);
    }
    if (accRes.ok) setAccounts(await accRes.json());
    setLoading(false);
  }, [id, fyId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const labels = getOrgLabels(assocType);

  async function handleGenerate() {
    setError("");

    let payload: Record<string, unknown>;

    if (assocType === "metsastysseura") {
      const fees: Record<string, number> = {};
      for (const [type, val] of Object.entries(memberTypeFees)) {
        const n = parseFloat(val);
        if (n > 0) fees[type] = n;
      }
      if (Object.keys(fees).length === 0) {
        setError("Anna vähintään yksi jäsenmaksu.");
        return;
      }
      payload = { memberTypeFees: fees, adminFee: 0, issueDate, dueDate };
    } else {
      if (!unitPrice || parseFloat(unitPrice) <= 0) {
        setError(`Anna ${labels.unitPriceLabel.toLowerCase()}.`);
        return;
      }
      payload = { unitPrice: parseFloat(unitPrice), adminFee: parseFloat(adminFee) || 0, issueDate, dueDate };
    }

    if (!confirm("Tämä poistaa vanhat laskut ja luo uudet kaikille jäsenille. Jatketaanko?")) return;

    setGenerating(true);

    const res = await fetch(`/api/associations/${id}/fiscal-years/${fyId}/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      await load();
      setGenerateOpen(false);
    } else {
      const err = await res.json();
      setError(err.error ?? "Laskujen luonti epäonnistui.");
    }
    setGenerating(false);
  }

  function downloadInvoice(invoice: InvoiceRecord) {
    window.open(`/api/associations/${id}/fiscal-years/${fyId}/invoices/pdf?invoiceId=${invoice.id}`, "_blank");
  }

  async function markPaid(invoice: InvoiceRecord) {
    if (invoice.paidAt) {
      // Clear all payments
      await fetch(`/api/associations/${id}/fiscal-years/${fyId}/invoices/${invoice.id}/payments`, {
        method: "DELETE",
      });
    } else {
      // Quick full-payment — post the remaining amount
      const remaining = invoice.totalAmount - (invoice.paidAmount ?? 0);
      await fetch(`/api/associations/${id}/fiscal-years/${fyId}/invoices/${invoice.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: remaining, paidAt: isoDate(new Date()), note: "" }),
      });
    }
    await load();
  }

  function openPaymentDialog(invoice: InvoiceRecord) {
    const remaining = invoice.totalAmount - (invoice.paidAmount ?? 0);
    setPaymentInvoice(invoice);
    setPaymentAmount(remaining.toFixed(2).replace(".", ","));
    setPaymentDate(isoDate(new Date()));
    setPaymentNote("");
    setPaymentError("");
    setPaymentCreateVoucher(true);
    setPaymentDebitAccountId(accounts.find((a) => a.number === "100")?.id ?? "");
    setPaymentCreditAccountId(accounts.find((a) => a.number === "310")?.id ?? "");
  }

  async function handleAddPayment() {
    if (!paymentInvoice) return;
    const amount = parseFloat(paymentAmount.replace(",", "."));
    if (!amount || amount <= 0) { setPaymentError("Anna positiivinen summa."); return; }
    if (!paymentDate) { setPaymentError("Anna maksupäivämäärä."); return; }
    setPaymentSaving(true);
    setPaymentError("");
    const res = await fetch(`/api/associations/${id}/fiscal-years/${fyId}/invoices/${paymentInvoice.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        paidAt: paymentDate,
        note: paymentNote,
        createVoucher: paymentCreateVoucher,
        debitAccountId: paymentCreateVoucher ? paymentDebitAccountId : undefined,
        creditAccountId: paymentCreateVoucher ? paymentCreditAccountId : undefined,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setPaymentInvoice(null);
      if (data.voucherNumber) setPaymentVoucherCreated(data.voucherNumber);
      await load();
    } else {
      const err = await res.json();
      setPaymentError(err.error ?? "Tallennus epäonnistui.");
    }
    setPaymentSaving(false);
  }

  async function sendInvoice(invoice: InvoiceRecord) {
    setSendingId(invoice.id);
    const res = await fetch(`/api/associations/${id}/fiscal-years/${fyId}/invoices/${invoice.id}/send`, {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error ?? "Lähetys epäonnistui.");
    } else {
      await load();
    }
    setSendingId(null);
  }

  async function sendAll() {
    if (!confirm(`Lähetetään laskut sähköpostilla kaikille jäsenille, joilla on sähköpostiosoite. Jatketaanko?`)) return;
    setSendingAll(true);
    const res = await fetch(`/api/associations/${id}/fiscal-years/${fyId}/invoices/send-all`, { method: "POST" });
    const data = await res.json();
    setSendAllResult(data);
    setSendingAll(false);
    await load();
  }

  async function sendReminders() {
    setSendingReminders(true);
    const res = await fetch(`/api/associations/${id}/fiscal-years/${fyId}/invoices/remind`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ overdueOnly: overdueReminderOnly }),
    });
    const data = await res.json();
    setReminderResult(data);
    setSendingReminders(false);
    await load();
  }

  async function deleteInvoice(invoice: InvoiceRecord) {
    if (!confirm(`Poistetaanko lasku ${invoice.invoiceNumber} (${invoice.member.name})? Tätä ei voi peruuttaa.`)) return;
    const res = await fetch(`/api/associations/${id}/fiscal-years/${fyId}/invoices/${invoice.id}`, { method: "DELETE" });
    if (res.ok) {
      await load();
    } else {
      alert("Laskun poistaminen epäonnistui.");
    }
  }

  function openEditDialog(invoice: InvoiceRecord) {
    setEditInvoice(invoice);
    setEditDueDate(invoice.dueDate.split("T")[0]);
    setEditIssueDate(invoice.issueDate.split("T")[0]);
    setEditNotes("");
    setEditLineItems(invoice.lineItems.map((li) => ({ ...li })));
    setEditError("");
  }

  function setEditLineItem(index: number, field: string, value: string) {
    setEditLineItems((items) => {
      const updated = items.map((li, i) => {
        if (i !== index) return li;
        const next = { ...li, [field]: field === "name" ? value : parseFloat(value) || 0 };
        if (field === "units" || field === "unitPrice") {
          next.amount = parseFloat((next.units * next.unitPrice).toFixed(2));
        }
        if (field === "amount") {
          next.amount = parseFloat(value) || 0;
        }
        return next;
      });
      return updated;
    });
  }

  function addEditLineItem() {
    setEditLineItems((items) => [...items, { name: "", units: 1, unitPrice: 0, amount: 0 }]);
  }

  function removeEditLineItem(index: number) {
    setEditLineItems((items) => items.filter((_, i) => i !== index));
  }

  async function handleSaveEdit() {
    if (!editInvoice) return;
    if (editLineItems.length === 0) { setEditError("Laskulle tarvitaan vähintään yksi rivi."); return; }
    if (editLineItems.some((li) => !li.name.trim())) { setEditError("Kaikille riveille tarvitaan nimi."); return; }
    setEditSaving(true);
    setEditError("");
    const res = await fetch(`/api/associations/${id}/fiscal-years/${fyId}/invoices/${editInvoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dueDate: editDueDate, issueDate: editIssueDate, notes: editNotes, lineItems: editLineItems }),
    });
    if (res.ok) {
      setEditInvoice(null);
      await load();
    } else {
      setEditError("Tallennus epäonnistui.");
    }
    setEditSaving(false);
  }

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileSelected(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { matched, unmatched } = parseFinnishBankCsv(text, invoices);
      setCsvMatches(matched);
      setCsvUnmatched(unmatched);
    };
    reader.readAsText(file, "utf-8");
  }

  async function applyImport() {
    if (!csvMatches.length) return;
    setImporting(true);
    const res = await fetch(`/api/associations/${id}/fiscal-years/${fyId}/invoices/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matches: csvMatches, createVouchers, debitAccountId, creditAccountId }),
    });
    const data = await res.json();
    if (res.ok) {
      let msg = `Merkitty maksetuksi: ${data.marked} laskua.`;
      if (data.vouchers?.created) msg += ` Tositteita luotu: ${data.vouchers.created}.`;
      if (data.vouchers?.skipped) msg += ` Tositteita ohitettu: ${data.vouchers.skipped}${data.vouchers.reason ? " — " + data.vouchers.reason : ""}.`;
      setImportResult(msg);
      await load();
    } else {
      setImportResult(data.error ?? "Tuonti epäonnistui.");
    }
    setImporting(false);
  }

  async function openImportDialog() {
    setCsvMatches([]);
    setCsvUnmatched(0);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setCsvFileSelected(false);
    const accs: Account[] = await fetch(`/api/associations/${id}/accounts`).then((r) => r.json());
    setAccounts(accs);
    setDebitAccountId(accs.find((a) => a.number === "100")?.id ?? accs[0]?.id ?? "");
    setCreditAccountId(accs.find((a) => a.number === "111")?.id ?? accs[0]?.id ?? "");
    setImportOpen(true);
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Ladataan...</div>;
  }

  const totalSum = invoices.reduce((s, inv) => s + inv.totalAmount, 0);
  const paidCount = invoices.filter((inv) => inv.paidAt).length;
  const now = new Date();
  const overdueInvoices = invoices.filter((inv) => !inv.paidAt && new Date(inv.dueDate) < now);
  const overdueCount = overdueInvoices.length;

  const q = searchQuery.toLowerCase().trim();
  const visibleInvoices = invoices
    .filter((inv) => {
      if (statusFilter === "paid") return !!inv.paidAt;
      if (statusFilter === "unpaid") return !inv.paidAt;
      if (statusFilter === "overdue") return !inv.paidAt && new Date(inv.dueDate) < now;
      return true;
    })
    .filter((inv) => {
      if (!q) return true;
      return (
        inv.member.name.toLowerCase().includes(q) ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.member.referenceNumber.toLowerCase().includes(q)
      );
    });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link href={`/associations/${id}/fiscal-years/${fyId}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Tilikausi {fyYear}
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">{labels.invoiceTitle} {fyYear}</h1>
              <p className="text-sm text-muted-foreground">{assocName}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            {invoices.length > 0 && (
              <>
                <Button
                  variant="outline"
                  onClick={() => window.open(`/api/associations/${id}/fiscal-years/${fyId}/invoices/zip`, "_blank")}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Lataa kaikki (ZIP)
                </Button>
                {smtpConfigured && (
                  <>
                    <Button variant="outline" onClick={sendAll} disabled={sendingAll}>
                      <Mail className="mr-2 h-4 w-4" />
                      {sendingAll ? "Lähetetään..." : "Lähetä sähköpostilla"}
                    </Button>
                    <Button variant="outline" onClick={() => { setReminderResult(null); setReminderOpen(true); }}>
                      <Bell className="mr-2 h-4 w-4" />
                      Lähetä muistutukset
                    </Button>
                  </>
                )}
                <Button variant="outline" onClick={openImportDialog}>
                  <Upload className="mr-2 h-4 w-4" />
                  Tuo maksut CSV:stä
                </Button>
              </>
            )}
            <Button onClick={() => { setError(""); setGenerateOpen(true); }}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {invoices.length > 0 ? "Luo laskut uudelleen" : "Luo laskut"}
            </Button>
          </div>
        </div>

        {/* Summary bar */}
        {invoices.length > 0 && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="py-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Laskuja yhteensä</p>
                <p className="text-2xl font-bold">{invoices.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Laskutettu yhteensä</p>
                <p className="text-2xl font-bold">{formatEur(totalSum)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Maksettu</p>
                <p className="text-2xl font-bold">{paidCount} / {invoices.length}</p>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-colors ${statusFilter === "overdue" ? "border-destructive bg-destructive/5" : overdueCount > 0 ? "border-destructive/40" : ""}`}
              onClick={() => setStatusFilter((v) => v === "overdue" ? "all" : "overdue")}
            >
              <CardContent className="py-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Erääntyneet</p>
                <p className={`text-2xl font-bold ${overdueCount > 0 ? "text-destructive" : ""}`}>{overdueCount}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Send-all result */}
        {sendAllResult && (
          <div className="mb-4 flex items-start gap-2 text-sm bg-muted rounded-md px-4 py-3">
            <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
            <div>
              Lähetetty: <strong>{sendAllResult.sent}</strong> kpl.
              {sendAllResult.noEmail > 0 && <span className="ml-2 text-muted-foreground">Ilman sähköpostia: {sendAllResult.noEmail}.</span>}
              {sendAllResult.failed.length > 0 && (
                <span className="ml-2 text-destructive">Epäonnistui: {sendAllResult.failed.join(", ")}.</span>
              )}
            </div>
            <button className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => setSendAllResult(null)}>✕</button>
          </div>
        )}

        {/* Reminder result */}
        {reminderResult && (
          <div className="mb-4 flex items-start gap-2 text-sm bg-muted rounded-md px-4 py-3">
            <Bell className="h-4 w-4 mt-0.5 text-blue-600 shrink-0" />
            <div>
              Muistutuksia lähetetty: <strong>{reminderResult.sent}</strong> kpl.
              {reminderResult.skipped > 0 && <span className="ml-2 text-muted-foreground">Ohitettu (maksettu): {reminderResult.skipped}.</span>}
              {reminderResult.noEmail > 0 && <span className="ml-2 text-muted-foreground">Ilman sähköpostia: {reminderResult.noEmail}.</span>}
              {reminderResult.failed.length > 0 && (
                <span className="ml-2 text-destructive">Epäonnistui: {reminderResult.failed.join(", ")}.</span>
              )}
            </div>
            <button className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => setReminderResult(null)}>✕</button>
          </div>
        )}

        {/* Search + filter bar */}
        {invoices.length > 0 && (
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Hae nimellä, laskunumerolla tai viitenumerolla..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Kaikki</SelectItem>
                <SelectItem value="paid">Maksettu</SelectItem>
                <SelectItem value="unpaid">Maksamatta</SelectItem>
                <SelectItem value="overdue">Erääntynyt</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Invoice list */}
        {invoices.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Ei laskuja. Luo laskut yllä olevalla napilla.
            </CardContent>
          </Card>
        ) : visibleInvoices.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Ei laskuja valituilla hakuehdoilla.
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-md border overflow-hidden">
            {statusFilter === "overdue" && (
              <div className="bg-destructive/10 text-destructive text-sm px-4 py-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Näytetään vain erääntyneet laskut — klikkaa erääntyneet-korttia palataksesi kaikkiin
              </div>
            )}
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nro</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">{labels.memberSingular.charAt(0).toUpperCase() + labels.memberSingular.slice(1)}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Eräpäivä</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Summa</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tila</th>
                  <th className="w-32" />
                </tr>
              </thead>
              <tbody>
                {visibleInvoices.map((inv) => {
                  const isOverdue = !inv.paidAt && new Date(inv.dueDate) < now;
                  const isSending = sendingId === inv.id;
                  return (
                    <tr key={inv.id} className={`border-t hover:bg-muted/20 ${isOverdue ? "bg-destructive/5" : ""}`}>
                      <td className="px-4 py-3 font-mono text-muted-foreground">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3 font-medium">
                        {inv.member.name}
                        {inv.member.referenceNumber && (
                          <div className="text-xs text-muted-foreground font-mono">{inv.member.referenceNumber}</div>
                        )}
                      </td>
                      <td className={`px-4 py-3 ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        {formatDate(inv.dueDate)}
                        {isOverdue && <span className="ml-1 text-xs">(erääntynyt)</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{formatEur(inv.totalAmount)}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={inv.paidAt ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => markPaid(inv)}
                        >
                          {inv.paidAt ? "Maksettu" : "Avoin"}
                        </Badge>
                        {!inv.paidAt && (inv.paidAmount ?? 0) > 0 && (
                          <div className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 tabular-nums">
                            {formatEur(inv.paidAmount!)} / {formatEur(inv.totalAmount)}
                          </div>
                        )}
                        {inv.sentAt && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            <Mail className="inline h-3 w-3 mr-0.5" />
                            {formatDate(inv.sentAt)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => downloadInvoice(inv)}
                          >
                            <Download className="mr-1 h-3.5 w-3.5" />
                            PDF
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => openEditDialog(inv)}
                            title="Muokkaa laskua"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {!inv.paidAt && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => openPaymentDialog(inv)}
                            >
                              <CreditCard className="mr-1 h-3.5 w-3.5" />
                              Maksu
                            </Button>
                          )}
                          {smtpConfigured && inv.member.email && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => sendInvoice(inv)}
                              disabled={isSending}
                              title={`Lähetä sähköpostiin ${inv.member.email}`}
                            >
                              <Mail className="mr-1 h-3.5 w-3.5" />
                              {isSending ? "..." : "Lähetä"}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => deleteInvoice(inv)}
                            title="Poista lasku"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Generate dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Luo {labels.invoiceTitle.toLowerCase()} {fyYear}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {assocType === "metsastysseura" ? (
              /* ── Flat-fee inputs per member type ── */
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Anna jäsenmaksu kullekin jäsentyypille. Tyhjä tai 0 = ei laskua kyseiselle tyypille.
                </p>
                {labels.memberTypeOptions.map((opt) => (
                  <div key={opt.value} className="flex items-center gap-3">
                    <Label className="w-40 shrink-0">{opt.label}</Label>
                    <div className="flex-1 relative">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        value={memberTypeFees[opt.value] ?? ""}
                        onChange={(e) => setMemberTypeFees((f) => ({ ...f, [opt.value]: e.target.value }))}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground">€</span>
                  </div>
                ))}
              </div>
            ) : (
              /* ── Unit price + admin fee ── */
              <>
                <div className="space-y-1.5">
                  <Label>{labels.unitPriceLabel} *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Esim. 12.50"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Hallinnointimaksu (€, per {labels.memberSingular})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={adminFee}
                    onChange={(e) => setAdminFee(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Kiinteä maksu joka {labels.memberSingular}lle yksiköistä riippumatta
                  </p>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Laskupäivä</Label>
                <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Eräpäivä</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>Peruuta</Button>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? "Luodaan..." : "Luo laskut"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment voucher created banner */}
      {paymentVoucherCreated !== null && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border bg-background px-4 py-3 shadow-lg text-sm">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          <span>Tosite #{paymentVoucherCreated} luotu automaattisesti.</span>
          <button onClick={() => setPaymentVoucherCreated(null)} className="ml-2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Payment dialog */}
      <Dialog open={!!paymentInvoice} onOpenChange={(open) => { if (!open) setPaymentInvoice(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Kirjaa maksu — {paymentInvoice?.invoiceNumber}
            </DialogTitle>
          </DialogHeader>
          {paymentInvoice && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                {paymentInvoice.member.name} · Avoinna {formatEur(paymentInvoice.totalAmount - (paymentInvoice.paidAmount ?? 0))}
              </p>
              {paymentInvoice.payments.length > 0 && (
                <div className="text-xs text-muted-foreground border rounded-md divide-y">
                  {paymentInvoice.payments.map((p) => (
                    <div key={p.id} className="flex justify-between px-3 py-1.5">
                      <span>{formatDate(p.paidAt)}{p.note ? ` – ${p.note}` : ""}</span>
                      <span className="tabular-nums">{formatEur(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Summa (€)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Päivämäärä</Label>
                  <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Selite (valinnainen)</Label>
                <Input placeholder="Esim. pankki, käteinen…" value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} />
              </div>

              {/* Voucher creation */}
              <div className="border rounded-md p-3 space-y-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input accent-primary"
                    checked={paymentCreateVoucher}
                    onChange={(e) => setPaymentCreateVoucher(e.target.checked)}
                  />
                  Luo kirjanpitotosite automaattisesti
                </label>
                {paymentCreateVoucher && accounts.length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Debet (vastaanottava tili)</Label>
                      <Select value={paymentDebitAccountId} onValueChange={(v) => { if (v) setPaymentDebitAccountId(v); }}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue>
                            {(() => { const a = accounts.find(x => x.id === paymentDebitAccountId); return a ? `${a.number} ${a.name}` : "Valitse tili"; })()}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((a) => (
                            <SelectItem key={a.id} value={a.id} className="text-xs">
                              {a.number} {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Kredit (tulotili)</Label>
                      <Select value={paymentCreditAccountId} onValueChange={(v) => { if (v) setPaymentCreditAccountId(v); }}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue>
                            {(() => { const a = accounts.find(x => x.id === paymentCreditAccountId); return a ? `${a.number} ${a.name}` : "Valitse tili"; })()}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((a) => (
                            <SelectItem key={a.id} value={a.id} className="text-xs">
                              {a.number} {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {paymentError && <p className="text-sm text-destructive">{paymentError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentInvoice(null)}>Peruuta</Button>
            <Button onClick={handleAddPayment} disabled={paymentSaving}>
              {paymentSaving ? "Tallennetaan..." : "Kirjaa maksu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reminder dialog */}
      <Dialog open={reminderOpen} onOpenChange={setReminderOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Lähetä maksumuistutukset</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {reminderResult ? (
              <div className="flex items-start gap-2 text-sm bg-muted rounded-md px-4 py-3">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
                <div>
                  Muistutuksia lähetetty: <strong>{reminderResult.sent}</strong> kpl.
                  {reminderResult.skipped > 0 && <span className="ml-2 text-muted-foreground">Ohitettu (maksettu): {reminderResult.skipped}.</span>}
                  {reminderResult.noEmail > 0 && <span className="ml-2 text-muted-foreground">Ilman sähköpostia: {reminderResult.noEmail}.</span>}
                  {reminderResult.failed.length > 0 && (
                    <div className="mt-1 text-destructive">Epäonnistui: {reminderResult.failed.join(", ")}.</div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Lähetetään muistutussähköposti kaikille jäsenille, joilla on avoin lasku ja sähköpostiosoite.
                </p>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overdueReminderOnly}
                    onChange={(e) => setOverdueReminderOnly(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Vain erääntyneet laskut
                </label>
              </>
            )}
          </div>
          <DialogFooter>
            {reminderResult ? (
              <Button onClick={() => setReminderOpen(false)}>Sulje</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setReminderOpen(false)}>Peruuta</Button>
                <Button onClick={sendReminders} disabled={sendingReminders}>
                  <Bell className="mr-2 h-4 w-4" />
                  {sendingReminders ? "Lähetetään..." : "Lähetä muistutukset"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV import dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tuo maksut pankin CSV-tiedostosta</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {!importResult ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Lataa tiliotteen CSV-tiedosto pankistasi. Tunnistettavia sarakkeita: <strong>Viite</strong>, <strong>Kirjauspäivä</strong>, <strong>Määrä</strong>.
                </p>
                <Input
                  type="file"
                  accept=".csv,.txt"
                  ref={fileInputRef}
                  onChange={handleCsvFile}
                />

                {csvMatches.length > 0 && (
                  <>
                    <div className="text-sm font-medium">
                      Täsmäytettiin {csvMatches.length} maksua
                      {csvUnmatched > 0 && <span className="text-muted-foreground ml-2">({csvUnmatched} ei täsmää)</span>}
                    </div>
                    <div className="rounded-md border overflow-hidden max-h-64 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Lasku</th>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Jäsen</th>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Päivä</th>
                            <th className="text-right px-3 py-2 font-medium text-muted-foreground">Summa</th>
                          </tr>
                        </thead>
                        <tbody>
                          {csvMatches.map((m) => (
                            <tr key={m.invoiceId} className="border-t">
                              <td className="px-3 py-2 font-mono text-muted-foreground">{m.invoiceNumber}</td>
                              <td className="px-3 py-2">{m.memberName}</td>
                              <td className="px-3 py-2 text-muted-foreground">{m.paidAt}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{formatEur(m.paidAmount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createVouchers}
                        onChange={(e) => setCreateVouchers(e.target.checked)}
                        className="h-4 w-4"
                      />
                      Luo kirjanpitotositteet
                    </label>
                    {createVouchers && (
                      <div className="grid grid-cols-2 gap-3 pl-6">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Debet (pankkitili)</Label>
                          <Select value={debitAccountId} onValueChange={(v) => v && setDebitAccountId(v)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Valitse tili" />
                            </SelectTrigger>
                            <SelectContent>
                              {accounts.map((a) => (
                                <SelectItem key={a.id} value={a.id} className="text-xs">
                                  {a.number} {a.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Kredit (saatavat)</Label>
                          <Select value={creditAccountId} onValueChange={(v) => v && setCreditAccountId(v)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Valitse tili" />
                            </SelectTrigger>
                            <SelectContent>
                              {accounts.map((a) => (
                                <SelectItem key={a.id} value={a.id} className="text-xs">
                                  {a.number} {a.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {csvMatches.length === 0 && csvFileSelected && (
                  <p className="text-sm text-muted-foreground">Ei täsmäyksiä löydetty. Tarkista, että CSV-tiedostossa on Viite-, Kirjauspäivä- ja Määrä-sarakkeet.</p>
                )}
              </>
            ) : (
              <div className="flex items-start gap-2 text-sm bg-muted rounded-md px-4 py-3">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
                {importResult}
              </div>
            )}
          </div>

          <DialogFooter>
            {!importResult ? (
              <>
                <Button variant="outline" onClick={() => setImportOpen(false)}>Peruuta</Button>
                <Button onClick={applyImport} disabled={csvMatches.length === 0 || importing}>
                  {importing ? "Käsitellään..." : `Merkitse maksetuksi (${csvMatches.length})`}
                </Button>
              </>
            ) : (
              <Button onClick={() => setImportOpen(false)}>Sulje</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit invoice dialog */}
      <Dialog open={!!editInvoice} onOpenChange={(open) => { if (!open) setEditInvoice(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Muokkaa laskua {editInvoice?.invoiceNumber} — {editInvoice?.member.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Laskupäivä</Label>
                <Input type="date" value={editIssueDate} onChange={(e) => setEditIssueDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Eräpäivä</Label>
                <Input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Muistiinpano (näkyy laskulla)</Label>
              <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="esim. Sisältää rästit 2023" />
            </div>

            <div className="space-y-2">
              <Label>Laskurivit</Label>
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Kuvaus</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground w-28">Yksiköt</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground w-24">€/yksikkö</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground w-24">Summa</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {editLineItems.map((li, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1.5">
                          <Input
                            value={li.name}
                            onChange={(e) => setEditLineItem(i, "name", e.target.value)}
                            className="h-8 text-sm"
                            placeholder="esim. Rästit 2023"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            type="number"
                            step="0.01"
                            value={li.units}
                            onChange={(e) => setEditLineItem(i, "units", e.target.value)}
                            className="h-8 text-sm text-right"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            type="number"
                            step="0.01"
                            value={li.unitPrice}
                            onChange={(e) => setEditLineItem(i, "unitPrice", e.target.value)}
                            className="h-8 text-sm text-right"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            type="number"
                            step="0.01"
                            value={li.amount}
                            onChange={(e) => setEditLineItem(i, "amount", e.target.value)}
                            className="h-8 text-sm text-right"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <button
                            onClick={() => removeEditLineItem(i)}
                            className="text-muted-foreground hover:text-destructive"
                            title="Poista rivi"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t bg-muted/30">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-sm font-medium text-right">Yhteensä</td>
                      <td className="px-3 py-2 text-sm font-bold text-right tabular-nums">
                        {formatEur(editLineItems.reduce((s, li) => s + li.amount, 0))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <Button variant="outline" size="sm" onClick={addEditLineItem}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Lisää rivi
              </Button>
            </div>

            {editError && <p className="text-sm text-destructive">{editError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditInvoice(null)}>Peruuta</Button>
            <Button onClick={handleSaveEdit} disabled={editSaving}>
              {editSaving ? "Tallennetaan..." : "Tallenna"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
