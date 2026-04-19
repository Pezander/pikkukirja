"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, AlertCircle, Paperclip, Upload, X, ExternalLink, LayoutTemplate } from "lucide-react";
import type { Account, Voucher, VoucherAttachment } from "@/app/associations/[id]/fiscal-years/[fyId]/page";

interface VoucherTemplate {
  id: string;
  name: string;
  description: string;
  lines: { accountId: string; debit: number; credit: number; note: string }[];
}

interface LineItem {
  id: string; // local only
  accountId: string;
  debit: string;
  credit: string;
  note: string;
  vatRate: string;
  vatAmount: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  associationId: string;
  fiscalYearId: string;
  editingVoucher?: Voucher | null;
  copyFrom?: Voucher | null;
  orgType?: string;
  onSaved: () => void;
}

function newLine(): LineItem {
  return { id: Math.random().toString(36).slice(2), accountId: "", debit: "", credit: "", note: "", vatRate: "", vatAmount: "" };
}

function today() {
  return new Date().toISOString().split("T")[0];
}

const TYPE_ORDER = ["asset", "liability", "equity", "income", "expense"];
const TYPE_LABELS: Record<string, string> = {
  asset: "Vastaavaa",
  liability: "Vastattavaa",
  equity: "Oma pääoma",
  income: "Tulot",
  expense: "Menot",
};

export function VoucherDialog({ open, onOpenChange, accounts, associationId, fiscalYearId, editingVoucher, copyFrom, orgType, onSaved }: Props) {
  const showVat = orgType === "toiminimi";
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<LineItem[]>([newLine(), newLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [duplicates, setDuplicates] = useState<{ id: string; number: number; date: string; description: string; totalDebit: number }[]>([]);
  const [confirmedDuplicate, setConfirmedDuplicate] = useState(false);
  const [attachments, setAttachments] = useState<VoucherAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [templates, setTemplates] = useState<VoucherTemplate[]>([]);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

  // Load templates when dialog opens
  useEffect(() => {
    if (open && !editingVoucher) {
      fetch(`/api/associations/${associationId}/voucher-templates`)
        .then((r) => r.json())
        .then((data: VoucherTemplate[]) => setTemplates(data.filter((t) => (t as { isActive?: boolean }).isActive !== false)))
        .catch(() => setTemplates([]));
    }
  }, [open, associationId, editingVoucher]);

  // Reset / prefill when opened
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("");
      setUploadError("");
      setDuplicates([]);
      setConfirmedDuplicate(false);
      if (editingVoucher) {
        setAttachments(editingVoucher.attachments ?? []);
        setDate(editingVoucher.date.split("T")[0]);
        setDescription(editingVoucher.description);
        setLines(editingVoucher.lines.map((l) => ({
          id: Math.random().toString(36).slice(2),
          accountId: l.account.id,
          debit: l.debit > 0 ? String(l.debit).replace(".", ",") : "",
          credit: l.credit > 0 ? String(l.credit).replace(".", ",") : "",
          note: l.note,
          vatRate: l.vatRate ? String(l.vatRate).replace(".", ",") : "",
          vatAmount: l.vatAmount ? String(l.vatAmount).replace(".", ",") : "",
        })));
      } else if (copyFrom) {
        setAttachments([]);
        setDate(today());
        setDescription(copyFrom.description);
        setLines(copyFrom.lines.map((l) => ({
          id: Math.random().toString(36).slice(2),
          accountId: l.account.id,
          debit: l.debit > 0 ? String(l.debit).replace(".", ",") : "",
          credit: l.credit > 0 ? String(l.credit).replace(".", ",") : "",
          note: l.note,
          vatRate: l.vatRate ? String(l.vatRate).replace(".", ",") : "",
          vatAmount: l.vatAmount ? String(l.vatAmount).replace(".", ",") : "",
        })));
      } else {
        setAttachments([]);
        setDate(today());
        setDescription("");
        setLines([newLine(), newLine()]);
      }
    }
  }, [open, editingVoucher, copyFrom]);

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit.replace(",", ".")) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit.replace(",", ".")) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;
  const hasContent = totalDebit > 0 && totalCredit > 0;

  function updateLine(id: string, field: keyof LineItem, value: string) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, newLine()]);
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  async function handleSave(skipDuplicateCheck = false) {
    setError("");
    if (!description.trim()) { setError("Anna tositteelle kuvaus."); return; }
    if (!hasContent) { setError("Syötä vähintään yksi debet- ja yksi kredit-summa."); return; }
    if (!balanced) { setError(`Tosite ei ole tasapainossa: debet ${totalDebit.toFixed(2).replace(".", ",")} ≠ kredit ${totalCredit.toFixed(2).replace(".", ",")}`); return; }

    const filledLines = lines.filter((l) => l.accountId && (parseFloat(l.debit.replace(",", ".")) > 0 || parseFloat(l.credit.replace(",", ".")) > 0));
    if (filledLines.length < 2) { setError("Tarvitaan vähintään 2 riviä."); return; }

    // Duplicate check (skip when user has confirmed or when editing)
    if (!skipDuplicateCheck && !confirmedDuplicate && !editingVoucher) {
      const checkRes = await fetch(
        `/api/associations/${associationId}/fiscal-years/${fiscalYearId}/vouchers/check-duplicate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, description, totalDebit }),
        }
      );
      if (checkRes.ok) {
        const data = await checkRes.json();
        if (data.duplicates?.length > 0) {
          setDuplicates(data.duplicates);
          return; // Show warning, wait for user confirmation
        }
      }
    }

    setSaving(true);
    const url = editingVoucher
      ? `/api/associations/${associationId}/fiscal-years/${fiscalYearId}/vouchers/${editingVoucher.id}`
      : `/api/associations/${associationId}/fiscal-years/${fiscalYearId}/vouchers`;
    const method = editingVoucher ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        description,
        lines: filledLines.map((l) => ({
          accountId: l.accountId,
          debit: parseFloat(l.debit.replace(",", ".")) || 0,
          credit: parseFloat(l.credit.replace(",", ".")) || 0,
          note: l.note,
          vatRate: parseFloat(l.vatRate.replace(",", ".")) || 0,
          vatAmount: parseFloat(l.vatAmount.replace(",", ".")) || 0,
        })),
      }),
    });

    if (res.ok) {
      onSaved();
    } else {
      const err = await res.json();
      setError(err.error ?? "Tallennus epäonnistui.");
    }
    setSaving(false);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editingVoucher) return;
    setUploadError("");
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(
      `/api/associations/${associationId}/fiscal-years/${fiscalYearId}/vouchers/${editingVoucher.id}/attachments`,
      { method: "POST", body: fd }
    );
    if (res.ok) {
      const att: VoucherAttachment = await res.json();
      setAttachments((prev) => [...prev, att]);
    } else {
      const err = await res.json();
      setUploadError(err.error ?? "Lataus epäonnistui.");
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDeleteAttachment(attachmentId: string) {
    if (!editingVoucher) return;
    const res = await fetch(
      `/api/associations/${associationId}/fiscal-years/${fiscalYearId}/vouchers/${editingVoucher.id}/attachments/${attachmentId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    }
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // Group accounts by type for the selector
  const groupedAccounts = TYPE_ORDER.map((type) => ({
    type,
    label: TYPE_LABELS[type],
    accounts: accounts.filter((a) => a.type === type),
  })).filter((g) => g.accounts.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {editingVoucher
              ? `Muokkaa tositetta #${editingVoucher.number}`
              : copyFrom
                ? `Kopioi tosite #${copyFrom.number}`
                : "Uusi tosite"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Date + description */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Päivämäärä</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Kuvaus</Label>
              <Input
                placeholder="Esim. Hiekotuslasku"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Template picker — shown only for new vouchers when templates exist */}
          {!editingVoucher && templates.length > 0 && (
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setTemplatePickerOpen((p) => !p)}
              >
                <LayoutTemplate className="mr-1.5 h-3.5 w-3.5" />
                Käytä mallipohjaa
              </Button>
              {templatePickerOpen && (
                <div className="absolute top-9 left-0 z-50 bg-popover border rounded-md shadow-md min-w-56 max-w-80 py-1">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                      onClick={() => {
                        setLines(t.lines.map((l) => ({
                          id: Math.random().toString(36).slice(2),
                          accountId: l.accountId,
                          debit: l.debit > 0 ? String(l.debit).replace(".", ",") : "",
                          credit: l.credit > 0 ? String(l.credit).replace(".", ",") : "",
                          note: l.note,
                          vatRate: "",
                          vatAmount: "",
                        })));
                        if (t.description) setDescription(t.description);
                        setTemplatePickerOpen(false);
                      }}
                    >
                      <span className="font-medium">{t.name}</span>
                      {t.description && <span className="text-muted-foreground ml-2 text-xs">{t.description}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Lines */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className={`grid gap-2 pb-1.5 border-b border-border/60 ${showVat ? "grid-cols-[1fr_90px_90px_90px_80px_120px_32px]" : "grid-cols-[1fr_100px_100px_120px_32px]"}`}>
              <span className="text-xs text-muted-foreground font-medium">Tili</span>
              <span className="text-xs text-muted-foreground font-medium text-right">Debet (€)</span>
              <span className="text-xs text-muted-foreground font-medium text-right">Kredit (€)</span>
              {showVat && <span className="text-xs text-muted-foreground font-medium text-right">ALV-%</span>}
              {showVat && <span className="text-xs text-muted-foreground font-medium text-right">ALV (€)</span>}
              <span className="text-xs text-muted-foreground font-medium">Selite</span>
              <span />
            </div>

            <div className="space-y-2">
              {lines.map((line) => {
                const selectedAccount = accounts.find((a) => a.id === line.accountId);
                const debitVal = parseFloat(line.debit.replace(",", ".")) || 0;
                const creditVal = parseFloat(line.credit.replace(",", ".")) || 0;
                const accountWarning = selectedAccount
                  ? (selectedAccount.type === "income" && debitVal > 0
                      ? "Huomio: tulo-tilille merkitään yleensä kredit"
                      : selectedAccount.type === "expense" && creditVal > 0
                        ? "Huomio: meno-tilille merkitään yleensä debet"
                        : null)
                  : null;
                return (
                <div key={line.id}>
                <div className={`grid gap-2 items-center ${showVat ? "grid-cols-[1fr_90px_90px_90px_80px_120px_32px]" : "grid-cols-[1fr_100px_100px_120px_32px]"}`}>
                  <Select value={line.accountId || undefined} onValueChange={(v) => updateLine(line.id, "accountId", v ?? "")}>
                    <SelectTrigger className="h-8 text-sm">
                      {selectedAccount
                        ? <span data-slot="select-value">{selectedAccount.number} – {selectedAccount.name}</span>
                        : <SelectValue placeholder="Valitse tili…" />
                      }
                    </SelectTrigger>
                    <SelectContent className="w-auto min-w-56">
                      {groupedAccounts.map((g) => (
                        <SelectGroup key={g.type}>
                          <SelectLabel className="text-xs font-semibold uppercase tracking-wide">
                            {g.label}
                          </SelectLabel>
                          {g.accounts.map((a) => (
                            <SelectItem key={a.id} value={a.id} className="text-sm">
                              {a.number} – {a.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    className="h-8 text-right tabular-nums text-sm"
                    placeholder="0,00"
                    value={line.debit}
                    onChange={(e) => updateLine(line.id, "debit", e.target.value)}
                  />
                  <Input
                    className="h-8 text-right tabular-nums text-sm"
                    placeholder="0,00"
                    value={line.credit}
                    onChange={(e) => updateLine(line.id, "credit", e.target.value)}
                  />
                  {showVat && (
                    <Input
                      className="h-8 text-right tabular-nums text-sm"
                      placeholder="24"
                      value={line.vatRate}
                      onChange={(e) => updateLine(line.id, "vatRate", e.target.value)}
                    />
                  )}
                  {showVat && (
                    <Input
                      className="h-8 text-right tabular-nums text-sm"
                      placeholder="0,00"
                      value={line.vatAmount}
                      onChange={(e) => updateLine(line.id, "vatAmount", e.target.value)}
                    />
                  )}
                  <Input
                    className="h-8 text-sm"
                    placeholder="Selite"
                    value={line.note}
                    onChange={(e) => updateLine(line.id, "note", e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeLine(line.id)}
                    disabled={lines.length <= 2}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {accountWarning && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 pl-1 -mt-1">{accountWarning}</p>
                )}
                </div>
              );})}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={addLine}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Lisää rivi
            </Button>
          </div>

          {/* Balance indicator */}
          <div className="flex items-center justify-between text-sm border rounded-md px-3 py-2 bg-muted/30">
            <span className="text-muted-foreground">Debet</span>
            <span className="tabular-nums font-medium">{totalDebit.toFixed(2).replace(".", ",")} €</span>
            <span className="text-muted-foreground mx-4">/</span>
            <span className="text-muted-foreground">Kredit</span>
            <span className="tabular-nums font-medium">{totalCredit.toFixed(2).replace(".", ",")} €</span>
            <span className={`ml-4 text-xs font-medium ${balanced && hasContent ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
              {balanced && hasContent ? "✓ Tasapainossa" : "Ei tasapainossa"}
            </span>
          </div>

          {/* Attachments — only shown when editing an existing voucher */}
          {editingVoucher && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5" />
                  Liitteet
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-1 h-3 w-3" />
                  {uploading ? "Ladataan..." : "Lisää liite"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                  onChange={handleUpload}
                />
              </div>

              {attachments.length > 0 && (
                <ul className="space-y-1">
                  {attachments.map((att) => (
                    <li key={att.id} className="flex items-center gap-2 text-sm rounded-md border px-3 py-1.5">
                      <span className="flex-1 truncate text-foreground">{att.originalName}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{formatBytes(att.size)}</span>
                      <a
                        href={`/api/associations/${associationId}/fiscal-years/${fiscalYearId}/vouchers/${editingVoucher.id}/attachments/${att.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        title="Avaa"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <button
                        type="button"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        title="Poista liite"
                        onClick={() => handleDeleteAttachment(att.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {uploadError && (
                <p className="text-xs text-destructive">{uploadError}</p>
              )}
            </div>
          )}

          {duplicates.length > 0 && (
            <div className="rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-700 px-3 py-2 space-y-2">
              <div className="flex items-start gap-2 text-sm text-yellow-800 dark:text-yellow-300">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Samanlainen tosite saattaa olla jo olemassa:</span>
              </div>
              <ul className="text-xs text-yellow-700 dark:text-yellow-400 space-y-1 pl-6">
                {duplicates.map((d) => (
                  <li key={d.id}>
                    #{d.number} – {new Date(d.date).toLocaleDateString("fi-FI")} – {d.description} ({d.totalDebit.toFixed(2).replace(".", ",")} €)
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDuplicates([])}>Peruuta</Button>
                <Button size="sm" className="h-7 text-xs bg-yellow-600 hover:bg-yellow-700" onClick={() => { setConfirmedDuplicate(true); setDuplicates([]); handleSave(true); }}>
                  Tallenna silti
                </Button>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Peruuta</Button>
          <Button onClick={() => handleSave(false)} disabled={saving}>
            {saving ? "Tallennetaan..." : editingVoucher ? "Tallenna muutokset" : "Tallenna tosite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
