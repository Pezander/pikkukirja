"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { Account, Voucher } from "@/app/associations/[id]/fiscal-years/[fyId]/page";

interface Props {
  vouchers: Voucher[];
  accounts: Account[];
  year: number;
}

function formatEur(n: number) {
  return (n < 0 ? "-" : "") + Math.abs(n).toFixed(2).replace(".", ",") + " €";
}

function netBalance(vouchers: Voucher[], accountIds: Set<string>) {
  let debit = 0, credit = 0;
  for (const v of vouchers) {
    for (const l of v.lines) {
      if (accountIds.has(l.account.id)) {
        debit += l.debit;
        credit += l.credit;
      }
    }
  }
  return { debit, credit, net: debit - credit };
}

interface TaseRow {
  label: string;
  amount?: number;
  indent?: boolean;
  bold?: boolean;
  separator?: boolean;
  empty?: boolean;
}

export function BalanceSheetTab({ vouchers, accounts, year }: Props) {
  const byType = (type: string) =>
    new Set(accounts.filter((a) => a.type === type).map((a) => a.id));
  const byNumbers = (...prefixes: string[]) =>
    new Set(accounts.filter((a) => prefixes.some((p) => a.number.startsWith(p))).map((a) => a.id));

  // Assets: debit balance is positive
  const bankIds = byNumbers("100");
  const receivableIds = byNumbers("111");
  const bank = netBalance(vouchers, bankIds).net;
  const receivables = netBalance(vouchers, receivableIds).net;
  const totalAssets = bank + receivables;

  // Liabilities & equity
  const liabilityIds = byType("liability");
  const { net: liabilityNet } = netBalance(vouchers, liabilityIds);
  // For liabilities, credit balance = positive liability
  const totalLiabilities = -liabilityNet; // credit > debit means we owe money

  // Equity (retained earnings from previous years + current result)
  const equityIds = byNumbers("222");
  const { net: equityNet } = netBalance(vouchers, equityIds);
  const retainedEarnings = -equityNet;

  // Current year result
  const incomeIds = byType("income");
  const expenseIds = byType("expense");
  const totalIncome = netBalance(vouchers, incomeIds).credit - netBalance(vouchers, incomeIds).debit;
  const totalExpenses = netBalance(vouchers, expenseIds).debit - netBalance(vouchers, expenseIds).credit;
  const currentResult = totalIncome - totalExpenses;

  const totalEquity = retainedEarnings + currentResult;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

  const assetsRows: TaseRow[] = [
    { label: "VASTAAVAA", bold: true },
    { label: "Vaihtuvat vastaavat", bold: true, indent: true },
    { label: "Pankkitili", amount: bank, indent: true },
    ...(receivables !== 0 ? [{ label: "Siirtosaamiset", amount: receivables, indent: true }] : []),
    { label: "Vastaavaa yhteensä", amount: totalAssets, bold: true, separator: true },
  ];

  const liabilitiesRows: TaseRow[] = [
    { label: "VASTATTAVAA", bold: true },
    { label: "Oma pääoma", bold: true, indent: true },
    ...(retainedEarnings !== 0 ? [{ label: "Ed. tilikausien tulos", amount: retainedEarnings, indent: true }] : []),
    { label: `Tilikauden tulos ${year}`, amount: currentResult, indent: true },
    { label: "Oma pääoma yhteensä", amount: totalEquity, bold: true, separator: true },
    { label: "", empty: true },
    ...(totalLiabilities !== 0 ? [
      { label: "Vieras pääoma", bold: true, indent: true },
      { label: "Velat yhteensä", amount: totalLiabilities, indent: true, bold: true, separator: true },
      { label: "", empty: true },
    ] : []),
    { label: "Vastattavaa yhteensä", amount: totalLiabilitiesAndEquity, bold: true },
  ];

  function renderRows(rows: TaseRow[]) {
    return rows.map((row, i) => {
      if (row.empty) return <tr key={i}><td className="py-1" colSpan={2} /></tr>;
      if (row.bold && row.amount === undefined) {
        return (
          <tr key={i}>
            <td className={`py-2 font-semibold ${row.indent ? "pl-4" : ""} ${!row.indent ? "text-xs text-muted-foreground uppercase tracking-wide" : ""}`} colSpan={2}>
              {row.label}
            </td>
          </tr>
        );
      }
      return (
        <tr key={i} className={row.separator ? "border-t" : ""}>
          <td className={`py-1.5 ${row.indent ? "pl-4" : ""} ${row.bold ? "font-semibold" : ""}`}>
            {row.label}
          </td>
          <td className={`py-1.5 text-right tabular-nums w-32 ${row.bold ? "font-semibold" : ""} ${(row.amount ?? 0) < 0 ? "text-destructive" : ""}`}>
            {row.amount !== undefined ? formatEur(row.amount) : ""}
          </td>
        </tr>
      );
    });
  }

  const balanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01;

  return (
    <div className="space-y-4">
      {!balanced && vouchers.length > 0 && (
        <div className="text-sm text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 rounded-md px-4 py-3">
          Tase ei täsmää: vastaavaa {formatEur(totalAssets)} ≠ vastattavaa {formatEur(totalLiabilitiesAndEquity)}.
          Tarkista että kaikki tositteet on kirjattu oikein.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="mb-4 text-center">
              <p className="font-semibold text-lg">Tase — Vastaavaa</p>
              <p className="text-sm text-muted-foreground">31.12.{year}</p>
            </div>
            <table className="w-full text-sm">
              <tbody>{renderRows(assetsRows)}</tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="mb-4 text-center">
              <p className="font-semibold text-lg">Tase — Vastattavaa</p>
              <p className="text-sm text-muted-foreground">31.12.{year}</p>
            </div>
            <table className="w-full text-sm">
              <tbody>{renderRows(liabilitiesRows)}</tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {vouchers.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Ei tilitapahtumia.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
