"use client";

import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import type { Account } from "@/app/associations/[id]/fiscal-years/[fyId]/page";

interface TemplateLine {
  id: string;
  accountId: string;
  debit: string;
  credit: string;
  note: string;
}

export interface VoucherTemplateData {
  id: string;
  name: string;
  description: string;
  recurrence: string;
  dayOfMonth: number;
  isActive: boolean;
  lines: {
    id: string;
    accountId: string;
    debit: number;
    credit: number;
    note: string;
    account: Account;
  }[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  associationId: string;
  editing?: VoucherTemplateData | null;
  onSaved: () => void;
}

const TYPE_ORDER = ["asset", "liability", "equity", "income", "expense"];
const TYPE_LABELS: Record<string, string> = {
  asset: "Vastaavaa", liability: "Vastattavaa", equity: "Oma pääoma",
  income: "Tulot", expense: "Menot",
};
const RECURRENCE_LABELS: Record<string, string> = {
  none: "Ei toistuvaa", monthly: "Kuukausittain",
  quarterly: "Neljännesvuosittain", yearly: "Vuosittain",
};

function newLine(): TemplateLine {
  return { id: Math.random().toString(36).slice(2), accountId: "", debit: "", credit: "", note: "" };
}

export function VoucherTemplateDialog({ open, onOpenChange, accounts, associationId, editing, onSaved }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [recurrence, setRecurrence] = useState("none");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [lines, setLines] = useState<TemplateLine[]>([newLine(), newLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("");
      if (editing) {
        setName(editing.name);
        setDescription(editing.description);
        setRecurrence(editing.recurrence);
        setDayOfMonth(String(editing.dayOfMonth));
        setLines(editing.lines.map((l) => ({
          id: Math.random().toString(36).slice(2),
          accountId: l.accountId,
          debit: l.debit > 0 ? String(l.debit) : "",
          credit: l.credit > 0 ? String(l.credit) : "",
          note: l.note,
        })));
      } else {
        setName(""); setDescription(""); setRecurrence("none"); setDayOfMonth("1");
        setLines([newLine(), newLine()]);
      }
    }
  }, [open, editing]);

  function updateLine(id: string, field: keyof TemplateLine, value: string) {
    setLines((prev) => prev.map((l) => l.id === id ? { ...l, [field]: value } : l));
  }

  const groupedAccounts = TYPE_ORDER
    .map((type) => ({ type, label: TYPE_LABELS[type], accounts: accounts.filter((a) => a.type === type) }))
    .filter((g) => g.accounts.length > 0);

  async function handleSave() {
    setError("");
    if (!name.trim()) { setError("Anna mallipohjalle nimi."); return; }
    const filledLines = lines.filter((l) => l.accountId && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));
    if (filledLines.length < 2) { setError("Tarvitaan vähintään 2 riviä."); return; }
    const totalDebit = filledLines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
    const totalCredit = filledLines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      setError(`Tosite ei ole tasapainossa: debet ${totalDebit.toFixed(2)} ≠ kredit ${totalCredit.toFixed(2)}`);
      return;
    }
    setSaving(true);
    const url = editing
      ? `/api/associations/${associationId}/voucher-templates/${editing.id}`
      : `/api/associations/${associationId}/voucher-templates`;
    const res = await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(), description, recurrence,
        dayOfMonth: parseInt(dayOfMonth) || 1,
        lines: filledLines.map((l) => ({
          accountId: l.accountId,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
          note: l.note,
        })),
      }),
    });
    if (res.ok) { onSaved(); }
    else { const err = await res.json(); setError(err.error ?? "Tallennus epäonnistui."); }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Muokkaa mallipohjaa" : "Uusi mallipohja"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nimi</Label>
              <Input placeholder="Esim. Kuukausivuokra" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Kuvaus (oletuskuvaus tositteelle)</Label>
              <Input placeholder="Esim. Toimistovuokra" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Toistuvuus</Label>
              <Select value={recurrence} onValueChange={(v) => v && setRecurrence(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(RECURRENCE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {recurrence !== "none" && (
              <div className="space-y-1.5">
                <Label>Kuukauden päivä</Label>
                <Input type="number" min="1" max="28" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} />
              </div>
            )}
          </div>

          {/* Lines */}
          <div>
            <div className="grid grid-cols-[1fr_100px_100px_120px_32px] gap-2 mb-1">
              <span className="text-xs text-muted-foreground font-medium">Tili</span>
              <span className="text-xs text-muted-foreground font-medium text-right">Debet (€)</span>
              <span className="text-xs text-muted-foreground font-medium text-right">Kredit (€)</span>
              <span className="text-xs text-muted-foreground font-medium">Selite</span>
              <span />
            </div>
            <div className="space-y-2">
              {lines.map((line) => {
                const sel = accounts.find((a) => a.id === line.accountId);
                return (
                  <div key={line.id} className="grid grid-cols-[1fr_100px_100px_120px_32px] gap-2 items-center">
                    <Select value={line.accountId || undefined} onValueChange={(v) => updateLine(line.id, "accountId", v ?? "")}>
                      <SelectTrigger className="h-8 text-sm">
                        {sel ? <span data-slot="select-value">{sel.number} – {sel.name}</span> : <SelectValue placeholder="Valitse tili…" />}
                      </SelectTrigger>
                      <SelectContent className="w-auto min-w-56">
                        {groupedAccounts.map((g) => (
                          <SelectGroup key={g.type}>
                            <SelectLabel className="text-xs font-semibold uppercase tracking-wide">{g.label}</SelectLabel>
                            {g.accounts.map((a) => (
                              <SelectItem key={a.id} value={a.id} className="text-sm">{a.number} – {a.name}</SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input className="h-8 text-right tabular-nums text-sm" placeholder="0,00" value={line.debit} onChange={(e) => updateLine(line.id, "debit", e.target.value)} />
                    <Input className="h-8 text-right tabular-nums text-sm" placeholder="0,00" value={line.credit} onChange={(e) => updateLine(line.id, "credit", e.target.value)} />
                    <Input className="h-8 text-sm" placeholder="Selite" value={line.note} onChange={(e) => updateLine(line.id, "note", e.target.value)} />
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setLines((p) => p.filter((l) => l.id !== line.id))} disabled={lines.length <= 2}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
            <Button type="button" variant="ghost" size="sm" className="mt-2 text-muted-foreground" onClick={() => setLines((p) => [...p, newLine()])}>
              <Plus className="mr-1 h-3.5 w-3.5" />Lisää rivi
            </Button>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Peruuta</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Tallennetaan..." : editing ? "Tallenna muutokset" : "Luo mallipohja"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
