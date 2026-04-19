"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import type { Account, Voucher } from "@/app/associations/[id]/fiscal-years/[fyId]/page";

interface Props {
  vouchers: Voucher[];
  accounts: Account[];
  year: number;
  associationId: string;
  fiscalYearId: string;
}

const TYPE_ORDER = ["asset", "liability", "equity", "income", "expense"];
const TYPE_LABELS: Record<string, string> = {
  asset: "Vastaavaa",
  liability: "Vastattavaa",
  equity: "Oma pääoma",
  income: "Tulot",
  expense: "Menot",
};

function formatEur(n: number) {
  if (n === 0) return "–";
  return n.toFixed(2).replace(".", ",") + " €";
}

export function TrialBalanceTab({ vouchers, accounts, year, associationId, fiscalYearId }: Props) {
  // Compute per-account totals
  const accountTotals = accounts.map((acc) => {
    let totalDebit = 0;
    let totalCredit = 0;
    for (const v of vouchers) {
      for (const l of v.lines) {
        if (l.account.id === acc.id) {
          totalDebit += l.debit;
          totalCredit += l.credit;
        }
      }
    }
    return { account: acc, totalDebit, totalCredit, net: totalDebit - totalCredit };
  }).filter((row) => row.totalDebit > 0 || row.totalCredit > 0);

  const grandDebit = accountTotals.reduce((s, r) => s + r.totalDebit, 0);
  const grandCredit = accountTotals.reduce((s, r) => s + r.totalCredit, 0);
  const balanced = Math.abs(grandDebit - grandCredit) < 0.01;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Koetase {year}</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(`/api/associations/${associationId}/fiscal-years/${fiscalYearId}/trial-balance/pdf`, "_blank")}
        >
          <Download className="mr-2 h-4 w-4" />
          Lataa PDF
        </Button>
      </div>

      {accountTotals.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ei kirjauksia.</p>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-20">Tilinro</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tilin nimi</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Debet</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Kredit</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {TYPE_ORDER.map((type) => {
                const rows = accountTotals.filter((r) => r.account.type === type);
                if (rows.length === 0) return null;
                const subtotalDebit = rows.reduce((s, r) => s + r.totalDebit, 0);
                const subtotalCredit = rows.reduce((s, r) => s + r.totalCredit, 0);
                const subtotalNet = subtotalDebit - subtotalCredit;
                return (
                  <tbody key={type}>
                    <tr className="bg-muted/20">
                      <td colSpan={5} className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {TYPE_LABELS[type]}
                      </td>
                    </tr>
                    {rows.sort((a, b) => a.account.number.localeCompare(b.account.number)).map((row) => (
                      <tr key={row.account.id} className="border-t hover:bg-muted/10">
                        <td className="px-4 py-2 font-mono text-muted-foreground">{row.account.number}</td>
                        <td className="px-4 py-2">{row.account.name}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{formatEur(row.totalDebit)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{formatEur(row.totalCredit)}</td>
                        <td className={`px-4 py-2 text-right tabular-nums font-medium ${row.net < 0 ? "text-destructive" : ""}`}>
                          {formatEur(row.net)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t bg-muted/10">
                      <td colSpan={2} className="px-4 py-2 text-xs text-muted-foreground">Yhteensä: {TYPE_LABELS[type]}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold">{formatEur(subtotalDebit)}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold">{formatEur(subtotalCredit)}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold">{formatEur(subtotalNet)}</td>
                    </tr>
                  </tbody>
                );
              })}

              {/* Grand total */}
              <tr className="border-t-2 bg-muted/30">
                <td colSpan={2} className="px-4 py-3 font-bold">Yhteensä kaikki tilit</td>
                <td className="px-4 py-3 text-right tabular-nums font-bold">{grandDebit.toFixed(2).replace(".", ",") + " €"}</td>
                <td className="px-4 py-3 text-right tabular-nums font-bold">{grandCredit.toFixed(2).replace(".", ",") + " €"}</td>
                <td className={`px-4 py-3 text-right tabular-nums font-bold ${balanced ? "text-green-600" : "text-destructive"}`}>
                  {balanced ? "✓ Tasapainossa" : (grandDebit - grandCredit).toFixed(2).replace(".", ",") + " €"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
