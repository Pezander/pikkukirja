"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";
import type { Account, Voucher } from "@/app/associations/[id]/fiscal-years/[fyId]/page";

const ENTRY_PAGE_SIZE = 100;

interface Props {
  vouchers: Voucher[];
  accounts: Account[];
  associationId: string;
  fiscalYearId: string;
}

function formatEur(n: number) {
  return n.toFixed(2).replace(".", ",") + " €";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fi-FI");
}

const TYPE_LABELS: Record<string, string> = {
  asset: "Vastaavaa",
  liability: "Vastattavaa",
  equity: "Oma pääoma",
  income: "Tulot",
  expense: "Menot",
};

export function LedgerTab({ vouchers, accounts, associationId, fiscalYearId }: Props) {
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [entryPage, setEntryPage] = useState<Record<string, number>>({});

  // Build per-account summary
  const summary = accounts.map((acc) => {
    let totalDebit = 0;
    let totalCredit = 0;
    const entries: { date: string; voucherNumber: number; description: string; debit: number; credit: number; balance: number }[] = [];

    let running = 0;
    for (const v of vouchers) {
      for (const line of v.lines) {
        if (line.account.id === acc.id) {
          totalDebit += line.debit;
          totalCredit += line.credit;
          running += line.debit - line.credit;
          entries.push({
            date: v.date,
            voucherNumber: v.number,
            description: v.description,
            debit: line.debit,
            credit: line.credit,
            balance: running,
          });
        }
      }
    }

    return { account: acc, totalDebit, totalCredit, balance: totalDebit - totalCredit, entries };
  }).filter((s) => s.totalDebit > 0 || s.totalCredit > 0);

  // Group by type
  const groups = ["asset", "liability", "equity", "income", "expense"];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(`/api/associations/${associationId}/fiscal-years/${fiscalYearId}/ledger/pdf`, "_blank")}
        >
          <Download className="mr-2 h-4 w-4" />
          Lataa PDF
        </Button>
      </div>

      {groups.map((type) => {
        const items = summary.filter((s) => s.account.type === type);
        if (items.length === 0) return null;
        return (
          <div key={type}>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {TYPE_LABELS[type]}
            </h3>
            <div className="space-y-2">
              {items.map((item) => (
                <Card
                  key={item.account.id}
                  className={`cursor-pointer transition-all ${selectedAccount === item.account.id ? "border-primary" : "hover:border-primary/50"}`}
                  onClick={() =>
                    setSelectedAccount(selectedAccount === item.account.id ? null : item.account.id)
                  }
                >
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm text-muted-foreground w-10">{item.account.number}</span>
                        <CardTitle className="text-sm font-medium">{item.account.name}</CardTitle>
                      </div>
                      <div className="flex items-center gap-6 text-sm tabular-nums">
                        <span className="text-muted-foreground">{formatEur(item.totalDebit)} / {formatEur(item.totalCredit)}</span>
                        <Badge variant="outline" className="font-mono">
                          {formatEur(Math.abs(item.balance))} {item.balance >= 0 ? "D" : "K"}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  {selectedAccount === item.account.id && (() => {
                    const pg = entryPage[item.account.id] ?? 0;
                    const totalPg = Math.max(1, Math.ceil(item.entries.length / ENTRY_PAGE_SIZE));
                    const safePg = Math.min(pg, totalPg - 1);
                    const visibleEntries = item.entries.slice(safePg * ENTRY_PAGE_SIZE, (safePg + 1) * ENTRY_PAGE_SIZE);
                    return (
                      <CardContent className="pt-0 pb-3">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-muted-foreground border-b">
                              <th className="text-left py-1 font-normal">Päivä</th>
                              <th className="text-left py-1 font-normal pl-2">Tosite</th>
                              <th className="text-left py-1 font-normal pl-2">Kuvaus</th>
                              <th className="text-right py-1 font-normal">Debet</th>
                              <th className="text-right py-1 font-normal">Kredit</th>
                              <th className="text-right py-1 font-normal">Saldo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleEntries.map((e, i) => (
                              <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                                <td className="py-1.5 text-muted-foreground">{formatDate(e.date)}</td>
                                <td className="py-1.5 pl-2 font-mono text-muted-foreground">#{e.voucherNumber}</td>
                                <td className="py-1.5 pl-2">{e.description}</td>
                                <td className="py-1.5 text-right tabular-nums">{e.debit > 0 ? formatEur(e.debit) : ""}</td>
                                <td className="py-1.5 text-right tabular-nums">{e.credit > 0 ? formatEur(e.credit) : ""}</td>
                                <td className="py-1.5 text-right tabular-nums font-medium">{formatEur(Math.abs(e.balance))}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {totalPg > 1 && (
                          <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
                            <span>
                              {safePg * ENTRY_PAGE_SIZE + 1}–{Math.min((safePg + 1) * ENTRY_PAGE_SIZE, item.entries.length)} / {item.entries.length}
                            </span>
                            <div className="flex gap-1">
                              <Button
                                variant="outline" size="icon" className="h-6 w-6"
                                disabled={safePg === 0}
                                onClick={(ev) => { ev.stopPropagation(); setEntryPage((p) => ({ ...p, [item.account.id]: safePg - 1 })); }}
                              >
                                <ChevronLeft className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="outline" size="icon" className="h-6 w-6"
                                disabled={safePg >= totalPg - 1}
                                onClick={(ev) => { ev.stopPropagation(); setEntryPage((p) => ({ ...p, [item.account.id]: safePg + 1 })); }}
                              >
                                <ChevronRight className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    );
                  })()}
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      {summary.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Ei tilitapahtumia vielä.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
