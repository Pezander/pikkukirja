"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import type { Voucher } from "@/app/associations/[id]/fiscal-years/[fyId]/page";

interface BudgetEntry {
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  budgetAmount: number;
}

interface Props {
  associationId: string;
  fiscalYearId: string;
  vouchers: Voucher[];
  year: number;
  canEdit: boolean;
}

function formatEur(n: number) {
  const sign = n < 0 ? "-" : "";
  return sign + Math.abs(n).toFixed(2).replace(".", ",") + " €";
}

function sumVouchers(vouchers: Voucher[], accountId: string, field: "debit" | "credit") {
  let total = 0;
  for (const v of vouchers) {
    for (const l of v.lines) {
      if (l.account.id === accountId) {
        total += field === "debit" ? l.debit : l.credit;
      }
    }
  }
  return total;
}

function getActual(vouchers: Voucher[], accountId: string, accountType: string): number {
  if (accountType === "income") {
    return sumVouchers(vouchers, accountId, "credit") - sumVouchers(vouchers, accountId, "debit");
  }
  // expense
  return sumVouchers(vouchers, accountId, "debit") - sumVouchers(vouchers, accountId, "credit");
}

export function BudgetTab({ associationId, fiscalYearId, vouchers, year, canEdit }: Props) {
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/associations/${associationId}/fiscal-years/${fiscalYearId}/budget`);
    const data: BudgetEntry[] = await res.json();
    setEntries(data);
    const initial: Record<string, string> = {};
    for (const e of data) {
      initial[e.accountId] = e.budgetAmount === 0 ? "" : String(e.budgetAmount);
    }
    setEdited(initial);
    setLoading(false);
    setDirty(false);
  }, [associationId, fiscalYearId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  function handleChange(accountId: string, value: string) {
    setEdited((prev) => ({ ...prev, [accountId]: value }));
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    const payload = entries.map((e) => ({
      accountId: e.accountId,
      amount: parseFloat(edited[e.accountId] || "0") || 0,
    }));
    await fetch(`/api/associations/${associationId}/fiscal-years/${fiscalYearId}/budget`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    setSaved(true);
    setDirty(false);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) return <div className="py-12 text-center text-muted-foreground">Ladataan...</div>;

  const incomeEntries = entries.filter((e) => e.accountType === "income");
  const expenseEntries = entries.filter((e) => e.accountType === "expense");

  const totalBudgetIncome = incomeEntries.reduce((s, e) => s + (parseFloat(edited[e.accountId] || "0") || 0), 0);
  const totalBudgetExpenses = expenseEntries.reduce((s, e) => s + (parseFloat(edited[e.accountId] || "0") || 0), 0);
  const totalActualIncome = incomeEntries.reduce((s, e) => s + getActual(vouchers, e.accountId, "income"), 0);
  const totalActualExpenses = expenseEntries.reduce((s, e) => s + getActual(vouchers, e.accountId, "expense"), 0);

  function renderSection(sectionEntries: BudgetEntry[], type: "income" | "expense") {
    const totalBudget = type === "income" ? totalBudgetIncome : totalBudgetExpenses;
    const totalActual = type === "income" ? totalActualIncome : totalActualExpenses;
    const title = type === "income" ? "TULOT" : "MENOT";

    return (
      <>
        <tr>
          <td className="py-2 font-semibold text-muted-foreground uppercase tracking-wide text-xs" colSpan={4}>
            {title}
          </td>
        </tr>
        {sectionEntries.map((e) => {
          const actual = getActual(vouchers, e.accountId, e.accountType);
          const budget = parseFloat(edited[e.accountId] || "0") || 0;
          const diff = actual - budget;
          const pct = budget !== 0 ? Math.round((actual / budget) * 100) : null;
          return (
            <tr key={e.accountId} className="border-t">
              <td className="py-2 pl-4 text-sm">
                <span className="text-muted-foreground mr-2 font-mono text-xs">{e.accountNumber}</span>
                {e.accountName}
              </td>
              <td className="py-2 w-36 pr-2">
                {canEdit ? (
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    className="h-7 text-right text-sm tabular-nums"
                    value={edited[e.accountId] ?? ""}
                    onChange={(e) => handleChange(e.currentTarget.dataset.id!, e.currentTarget.value)}
                    data-id={e.accountId}
                    placeholder="0,00"
                  />
                ) : (
                  <span className="text-sm tabular-nums">{budget !== 0 ? formatEur(budget) : "—"}</span>
                )}
              </td>
              <td className={`py-2 w-32 text-right tabular-nums text-sm ${actual < 0 ? "text-destructive" : ""}`}>
                {actual !== 0 ? formatEur(actual) : "—"}
              </td>
              <td className={`py-2 w-32 text-right tabular-nums text-sm ${diff < 0 && budget !== 0 ? "text-destructive" : diff > 0 && budget !== 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                {budget !== 0 ? (
                  <>
                    {diff >= 0 ? "+" : ""}{formatEur(diff)}
                    {pct !== null && <span className="ml-1 text-xs opacity-70">({pct}%)</span>}
                  </>
                ) : "—"}
              </td>
            </tr>
          );
        })}
        <tr className="border-t bg-muted/30">
          <td className="py-2 font-semibold text-sm">{type === "income" ? "Tulot yhteensä" : "Menot yhteensä"}</td>
          <td className="py-2 w-36 pr-2 text-right tabular-nums font-semibold text-sm">
            {totalBudget !== 0 ? formatEur(totalBudget) : "—"}
          </td>
          <td className={`py-2 w-32 text-right tabular-nums font-semibold text-sm ${totalActual < 0 ? "text-destructive" : ""}`}>
            {totalActual !== 0 ? formatEur(totalActual) : "—"}
          </td>
          <td className={`py-2 w-32 text-right tabular-nums font-semibold text-sm ${totalActual - totalBudget < 0 && totalBudget !== 0 ? "text-destructive" : totalActual - totalBudget > 0 && totalBudget !== 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
            {totalBudget !== 0 ? (
              <>{(totalActual - totalBudget) >= 0 ? "+" : ""}{formatEur(totalActual - totalBudget)}</>
            ) : "—"}
          </td>
        </tr>
      </>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-semibold text-lg">Budjetti {year}</p>
            <p className="text-sm text-muted-foreground">Budjetti vs. toteutuma</p>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              {saved && <span className="text-sm text-green-600 dark:text-green-400">✓ Tallennettu</span>}
              <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {saving ? "Tallennetaan..." : "Tallenna"}
              </Button>
            </div>
          )}
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 font-medium text-muted-foreground text-xs">Tili</th>
              <th className="text-right py-2 font-medium text-muted-foreground text-xs w-36 pr-2">Budjetti (€)</th>
              <th className="text-right py-2 font-medium text-muted-foreground text-xs w-32">Toteutuma</th>
              <th className="text-right py-2 font-medium text-muted-foreground text-xs w-32">Erotus</th>
            </tr>
          </thead>
          <tbody>
            {renderSection(incomeEntries, "income")}
            <tr><td className="py-2" colSpan={4} /></tr>
            {renderSection(expenseEntries, "expense")}
            <tr className="border-t">
              <td className="py-2 font-semibold text-sm">Tulos</td>
              <td className="py-2 w-36 pr-2 text-right tabular-nums font-semibold text-sm">
                {(totalBudgetIncome - totalBudgetExpenses) !== 0 ? formatEur(totalBudgetIncome - totalBudgetExpenses) : "—"}
              </td>
              <td className={`py-2 w-32 text-right tabular-nums font-semibold text-sm ${(totalActualIncome - totalActualExpenses) < 0 ? "text-destructive" : ""}`}>
                {formatEur(totalActualIncome - totalActualExpenses)}
              </td>
              <td className="py-2 w-32 text-right tabular-nums text-muted-foreground text-sm">—</td>
            </tr>
          </tbody>
        </table>

        {entries.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Ei tili- tai budjettitietoja.</p>
        )}
      </CardContent>
    </Card>
  );
}
