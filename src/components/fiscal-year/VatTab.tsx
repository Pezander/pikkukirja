"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";

interface VatPeriodData {
  label: string;
  start: string;
  end: string;
  vatCollected: number;
  vatDeductible: number;
  vatPayable: number;
  saved?: { status: string; submittedAt: string };
}

interface Props {
  associationId: string;
  fiscalYearId: string;
  year: number;
}

function formatEur(n: number) {
  const sign = n < 0 ? "-" : "";
  return sign + Math.abs(n).toFixed(2).replace(".", ",") + " €";
}

export function VatTab({ associationId, fiscalYearId, year }: Props) {
  const [periodType, setPeriodType] = useState<"quarter" | "month">("quarter");
  const [periods, setPeriods] = useState<VatPeriodData[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetch(
      `/api/associations/${associationId}/fiscal-years/${fiscalYearId}/vat?periodType=${periodType}`
    ).then((r) => r.json());
    setPeriods(data.periods ?? []);
    setLoading(false);
  }, [associationId, fiscalYearId, periodType]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function markSubmitted(p: VatPeriodData) {
    setSubmitting(p.label);
    await fetch(`/api/associations/${associationId}/fiscal-years/${fiscalYearId}/vat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        periodStart: p.start,
        periodEnd: p.end,
        periodType,
        vatCollected: p.vatCollected,
        vatDeductible: p.vatDeductible,
        vatPayable: p.vatPayable,
      }),
    });
    setSubmitting(null);
    load();
  }

  const totalCollected = periods.reduce((s, p) => s + p.vatCollected, 0);
  const totalDeductible = periods.reduce((s, p) => s + p.vatDeductible, 0);
  const totalPayable = periods.reduce((s, p) => s + p.vatPayable, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">ALV-seuranta {year}</h2>
          <p className="text-sm text-muted-foreground">
            Arvonlisäverokertymä jaksoittain. Merkitse ilmoitetuksi kun olet antanut ALV-ilmoituksen Verolle.
          </p>
        </div>
        <div className="flex gap-1">
          {(["quarter", "month"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setPeriodType(t)}
              className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                periodType === t ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
              }`}
            >
              {t === "quarter" ? "Neljännesvuosi" : "Kuukausi"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-muted-foreground text-sm">Ladataan...</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-2 font-medium">Jakso</th>
                  <th className="text-right py-2 font-medium w-36">Myynti-ALV</th>
                  <th className="text-right py-2 font-medium w-36">Osto-ALV</th>
                  <th className="text-right py-2 font-medium w-36">Maksettava ALV</th>
                  <th className="py-2 w-40" />
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => {
                  const isSubmitted = p.saved?.status === "submitted";
                  const hasData = p.vatCollected !== 0 || p.vatDeductible !== 0;
                  return (
                    <tr key={p.label} className={`border-b last:border-0 ${!hasData ? "opacity-50" : ""}`}>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{p.label}</span>
                          {isSubmitted && (
                            <Badge variant="secondary" className="text-xs">
                              <CheckCircle2 className="mr-1 h-3 w-3 text-green-600" />
                              Ilmoitettu {p.saved?.submittedAt ? new Date(p.saved.submittedAt).toLocaleDateString("fi-FI") : ""}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{hasData ? formatEur(p.vatCollected) : "—"}</td>
                      <td className="py-2.5 text-right tabular-nums">{hasData ? formatEur(p.vatDeductible) : "—"}</td>
                      <td className={`py-2.5 text-right tabular-nums font-medium ${p.vatPayable < 0 ? "text-green-700 dark:text-green-400" : p.vatPayable > 0 ? "text-destructive" : ""}`}>
                        {hasData ? formatEur(p.vatPayable) : "—"}
                      </td>
                      <td className="py-2.5 text-right">
                        {hasData && !isSubmitted && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={submitting === p.label}
                            onClick={() => markSubmitted(p)}
                          >
                            {submitting === p.label ? "..." : "Merkitse ilmoitetuksi"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          {(totalCollected !== 0 || totalDeductible !== 0) && (
            <Card>
              <CardContent className="pt-4 pb-4 px-4">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Myynti-ALV yhteensä</p>
                    <p className="font-semibold tabular-nums">{formatEur(totalCollected)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Osto-ALV yhteensä</p>
                    <p className="font-semibold tabular-nums">{formatEur(totalDeductible)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Nettomaksettava {year}</p>
                    <p className={`font-semibold tabular-nums ${totalPayable < 0 ? "text-green-700 dark:text-green-400" : "text-destructive"}`}>
                      {formatEur(totalPayable)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {periods.every((p) => p.vatCollected === 0 && p.vatDeductible === 0) && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p>Ei ALV-kirjauksia tällä tilikaudella.</p>
                <p className="text-sm mt-1">Merkitse ALV-summa tositteiden riveille ALV-kentässä.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
