"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { Account, Voucher } from "@/app/associations/[id]/fiscal-years/[fyId]/page";

const PRIMARY_INCOME_LABEL: Record<string, string> = {
  tiekunta: "Yksikkömaksut",
  metsastysseura: "Jäsenmaksutulot",
  taloyhtio: "Hoitovastike",
  toiminimi: "Myyntitulot",
};

const MAINTENANCE_LABEL: Record<string, string> = {
  tiekunta: "Tien kunnossapito",
  metsastysseura: "Toimintakulut",
  taloyhtio: "Kiinteistön hoitokulut",
  toiminimi: "Toimintakulut",
};

interface Props {
  vouchers: Voucher[];
  accounts: Account[];
  year: number;
  orgType?: string;
  historicVouchers?: { year: number; vouchers: Voucher[] }[];
}

function formatEur(n: number) {
  const sign = n < 0 ? "-" : "";
  return sign + Math.abs(n).toFixed(2).replace(".", ",") + " €";
}

function sum(vouchers: Voucher[], accountIds: Set<string>, field: "debit" | "credit") {
  let total = 0;
  for (const v of vouchers) {
    for (const l of v.lines) {
      if (accountIds.has(l.account.id)) {
        total += field === "debit" ? l.debit : l.credit;
      }
    }
  }
  return total;
}

interface Row {
  label: string;
  amounts: (number | null)[];
  indent?: boolean;
  bold?: boolean;
  separator?: boolean;
  empty?: boolean;
}

function calcAmounts(
  vouchers: Voucher[],
  byType: (t: string) => Set<string>,
  byNumber: (p: string) => Set<string>
) {
  const incomeIds = byType("income");
  const totalIncome = sum(vouchers, incomeIds, "credit") - sum(vouchers, incomeIds, "debit");
  const memberFees = sum(vouchers, byNumber("310"), "credit") - sum(vouchers, byNumber("310"), "debit");
  const grants = sum(vouchers, byNumber("311"), "credit") - sum(vouchers, byNumber("311"), "debit");
  const adminIncome = sum(vouchers, byNumber("315"), "credit") - sum(vouchers, byNumber("315"), "debit");
  const otherIncome = totalIncome - memberFees - grants - adminIncome;
  const expenseIds = byType("expense");
  const totalExpenses = sum(vouchers, expenseIds, "debit") - sum(vouchers, expenseIds, "credit");
  const maintenance = sum(vouchers, byNumber("41"), "debit") - sum(vouchers, byNumber("41"), "credit");
  const bankFees = sum(vouchers, byNumber("406"), "debit") - sum(vouchers, byNumber("406"), "credit");
  const otherExpenses = totalExpenses - maintenance - bankFees;
  const result = totalIncome - totalExpenses;
  return { totalIncome, memberFees, grants, adminIncome, otherIncome, totalExpenses, maintenance, bankFees, otherExpenses, result };
}

export function IncomeStatementTab({
  vouchers,
  accounts,
  year,
  orgType = "tiekunta",
  historicVouchers = [],
}: Props) {
  const maxYears = Math.min(5, historicVouchers.length + 1);
  const [yearsToShow, setYearsToShow] = useState(Math.min(2, maxYears));

  const primaryIncomeLabel = PRIMARY_INCOME_LABEL[orgType] ?? PRIMARY_INCOME_LABEL.tiekunta;
  const maintenanceLabel = MAINTENANCE_LABEL[orgType] ?? MAINTENANCE_LABEL.tiekunta;
  const byType = (type: string) => new Set(accounts.filter((a) => a.type === type).map((a) => a.id));
  const byNumber = (prefix: string) =>
    new Set(accounts.filter((a) => a.number.startsWith(prefix)).map((a) => a.id));

  // Build the list of year columns: current first, then historic sorted desc
  const sortedHistoric = [...historicVouchers].sort((a, b) => b.year - a.year);
  const visibleHistoric = sortedHistoric.slice(0, yearsToShow - 1);
  const allColumns = [
    { year, vouchers },
    ...visibleHistoric,
  ];

  const computed = allColumns.map((col) => calcAmounts(col.vouchers, byType, byNumber));
  const cur = computed[0];

  const anyOtherIncome = computed.some((c) => c.otherIncome !== 0);
  const anyOtherExpenses = computed.some((c) => c.otherExpenses !== 0);

  function amts(field: keyof ReturnType<typeof calcAmounts>): (number | null)[] {
    return computed.map((c) => c[field] as number);
  }

  const rows: Row[] = [
    { label: "TULOT", amounts: [], bold: true },
    { label: primaryIncomeLabel, amounts: amts("memberFees"), indent: true },
    { label: "Avustukset", amounts: amts("grants"), indent: true },
    { label: "Tilinhoitotulot", amounts: amts("adminIncome"), indent: true },
    ...(anyOtherIncome ? [{ label: "Muut tulot", amounts: amts("otherIncome"), indent: true }] : []),
    { label: "Tulot yhteensä", amounts: amts("totalIncome"), bold: true, separator: true },
    { label: "", amounts: [], empty: true },
    { label: "MENOT", amounts: [], bold: true },
    { label: maintenanceLabel, amounts: amts("maintenance"), indent: true },
    { label: "Pankkipalvelumaksut", amounts: amts("bankFees"), indent: true },
    ...(anyOtherExpenses ? [{ label: "Muut menot", amounts: amts("otherExpenses"), indent: true }] : []),
    { label: "Menot yhteensä", amounts: amts("totalExpenses"), bold: true, separator: true },
    { label: "", amounts: [], empty: true },
    {
      label: cur.result >= 0 ? "TILIKAUDEN YLIJÄÄMÄ" : "TILIKAUDEN ALIJÄÄMÄ",
      amounts: amts("result"),
      bold: true,
    },
  ];

  const multiYear = allColumns.length > 1;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-4 flex items-start justify-between">
          <div className="text-center flex-1">
            <p className="font-semibold text-lg">Tuloslaskelma</p>
            <p className="text-sm text-muted-foreground">1.1.{year} – 31.12.{year}</p>
          </div>
          {maxYears > 1 && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
              <span className="text-xs">Vertailu:</span>
              {Array.from({ length: maxYears }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setYearsToShow(n)}
                  className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                    yearsToShow === n
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {n === 1 ? "1v" : `${n}v`}
                </button>
              ))}
            </div>
          )}
        </div>

        <table className="w-full text-sm">
          {multiYear && (
            <thead>
              <tr className="border-b">
                <th className="text-left py-1.5 font-normal text-muted-foreground text-xs" />
                {allColumns.map((col, i) => (
                  <th
                    key={col.year}
                    className={`text-right py-1.5 text-xs w-32 ${
                      i === 0 ? "font-semibold" : "font-normal text-muted-foreground"
                    }`}
                  >
                    {col.year}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {rows.map((row, i) => {
              if (row.empty) {
                return <tr key={i}><td className="py-1" colSpan={allColumns.length + 1} /></tr>;
              }
              if (row.bold && row.amounts.length === 0) {
                return (
                  <tr key={i}>
                    <td className="py-2 font-semibold text-muted-foreground uppercase tracking-wide text-xs" colSpan={allColumns.length + 1}>
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
                  {row.amounts.map((amount, ci) => (
                    <td
                      key={ci}
                      className={`py-1.5 text-right tabular-nums w-32 ${row.bold ? "font-semibold" : ""} ${
                        (amount ?? 0) < 0
                          ? ci === 0 ? "text-destructive" : "text-destructive/70"
                          : ci > 0 ? "text-muted-foreground" : ""
                      }`}
                    >
                      {amount !== null && (amount !== 0 || row.bold) ? formatEur(amount) : ""}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>

        {vouchers.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Ei tilitapahtumia.</p>
        )}
      </CardContent>
    </Card>
  );
}
