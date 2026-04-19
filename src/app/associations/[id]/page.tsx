"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  BookOpen,
  Users,
  FileText,
  Plus,
  ChevronRight,
  Settings,
  LayoutTemplate,
  Archive,
  Landmark,
} from "lucide-react";
import { getOrgLabels } from "@/lib/orgLabels";

interface FiscalYear {
  id: string;
  year: number;
  status: string;
}

interface Association {
  id: string;
  name: string;
  type: string;
  city: string;
  contactName: string;
  phone: string;
  email: string;
  iban: string;
  bankName: string;
  fiscalYears: FiscalYear[];
}

interface Summary {
  memberCount: number;
  openFiscalYear: { id: string; year: number; status: string } | null;
  openInvoiceCount: number;
  openInvoiceTotal: number;
  totalIncome: number;
  totalExpense: number;
}

interface DashboardData {
  monthlyIncome: number[];
  monthlyExpense: number[];
  cashBalance: number;
  budgetVsActual: { accountNumber: string; accountName: string; accountType: string; budget: number; actual: number }[];
  aging: { current: number; overdue30: number; overdue60: number; overdue60plus: number };
}

const MONTH_LABELS = ["Tam", "Hel", "Maa", "Huh", "Tou", "Kes", "Hei", "Elo", "Syy", "Lok", "Mar", "Jou"];

function BarChart({ income, expense }: { income: number[]; expense: number[] }) {
  const max = Math.max(...income, ...expense, 1);
  const W = 420, H = 100, BAR_W = 14, GAP = 4, GROUP = BAR_W * 2 + GAP + 8;
  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full" aria-hidden>
      {income.map((inc, i) => {
        const exp = expense[i];
        const x = i * GROUP + 4;
        const incH = Math.max((inc / max) * H, inc > 0 ? 2 : 0);
        const expH = Math.max((exp / max) * H, exp > 0 ? 2 : 0);
        return (
          <g key={i}>
            <rect x={x} y={H - incH} width={BAR_W} height={incH} fill="var(--chart-1)" rx="2" />
            <rect x={x + BAR_W + GAP} y={H - expH} width={BAR_W} height={expH} fill="var(--chart-2)" opacity="0.9" rx="2" />
            <text x={x + BAR_W} y={H + 14} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 8 }}>
              {MONTH_LABELS[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function formatEur(n: number) {
  return n.toFixed(2).replace(".", ",") + " €";
}

export default function AssociationPage() {
  const { id } = useParams<{ id: string }>();
  const [association, setAssociation] = useState<Association | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingYear, setCreatingYear] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/associations/${id}`).then((r) => r.json()),
      fetch(`/api/associations/${id}/summary`).then((r) => r.json()),
    ]).then(([assoc, sum]) => {
      setAssociation(assoc);
      setSummary(sum);
      setLoading(false);
      // Fetch dashboard data if there's an open fiscal year
      if (sum.openFiscalYear) {
        fetch(`/api/associations/${id}/fiscal-years/${sum.openFiscalYear.id}/dashboard`)
          .then((r) => r.json())
          .then(setDashboard)
          .catch(() => null);
      }
    });
  }, [id]);

  async function createFiscalYear() {
    const currentYear = new Date().getFullYear();
    setCreatingYear(true);
    const res = await fetch(`/api/associations/${id}/fiscal-years`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: currentYear }),
    });
    if (res.ok) {
      const [assoc, sum] = await Promise.all([
        fetch(`/api/associations/${id}`).then((r) => r.json()),
        fetch(`/api/associations/${id}/summary`).then((r) => r.json()),
      ]);
      setAssociation(assoc);
      setSummary(sum);
    } else {
      const err = await res.json();
      alert(err.error);
    }
    setCreatingYear(false);
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Ladataan...</div>;
  }

  if (!association) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Organisaatiota ei löydy.</div>;
  }

  const labels = getOrgLabels(association.type);
  const openYear = association.fiscalYears.find((y) => y.status === "open");

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Back + header */}
        <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Kaikki organisaatiot
        </Link>

        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold">{association.name}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
                {labels.orgTypeName}
              </span>
            </div>
            {association.city && <p className="text-muted-foreground">{association.city}</p>}
          </div>
          <Link href={`/associations/${id}/settings`}>
            <Button variant="outline" size="sm">
              <Settings className="mr-2 h-4 w-4" />
              Asetukset
            </Button>
          </Link>
        </div>

        {/* Stats */}
        {summary && (
          <section className="mb-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-kicker mb-2">{labels.memberPlural}</p>
                <p className="text-2xl font-semibold font-mono tabular-nums tracking-tight">{summary.memberCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-kicker mb-2">Avoimet laskut</p>
                <p className="text-2xl font-semibold font-mono tabular-nums tracking-tight">{summary.openInvoiceCount}</p>
                {summary.openInvoiceTotal > 0 && (
                  <p className="text-xs text-muted-foreground">{summary.openInvoiceTotal.toFixed(2).replace(".", ",")} €</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-kicker mb-2">Tulot {summary.openFiscalYear?.year ?? ""}</p>
                <p className="text-2xl font-semibold font-mono tabular-nums tracking-tight text-[color:var(--positive)]">
                  {summary.totalIncome.toFixed(2).replace(".", ",")} €
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-kicker mb-2">Menot {summary.openFiscalYear?.year ?? ""}</p>
                <p className="text-2xl font-semibold font-mono tabular-nums tracking-tight text-destructive">
                  {summary.totalExpense.toFixed(2).replace(".", ",")} €
                </p>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Dashboard charts */}
        {dashboard && summary?.openFiscalYear && (
          <section className="mb-8 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Monthly income/expense bar chart */}
              <Card className="sm:col-span-2">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-kicker">Kassavirta · 12 kk</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "var(--chart-1)" }} />Tulot</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "var(--chart-2)" }} />Menot</span>
                    </div>
                  </div>
                  <BarChart income={dashboard.monthlyIncome} expense={dashboard.monthlyExpense} />
                </CardContent>
              </Card>

              {/* Cash + unpaid aging */}
              <div className="space-y-3">
                <Card>
                  <CardContent className="pt-4 pb-3 px-4">
                    <p className="text-xs text-muted-foreground mb-1">Pankkitilisaldo (arvio)</p>
                    <p className={`text-xl font-bold tabular-nums ${dashboard.cashBalance < 0 ? "text-destructive" : ""}`}>
                      {formatEur(dashboard.cashBalance)}
                    </p>
                  </CardContent>
                </Card>
                {(dashboard.aging.current + dashboard.aging.overdue30 + dashboard.aging.overdue60 + dashboard.aging.overdue60plus) > 0 && (
                  <Card>
                    <CardContent className="pt-4 pb-3 px-4">
                      <p className="text-xs text-muted-foreground mb-2">Maksamattomat laskut</p>
                      <div className="space-y-1.5">
                        {dashboard.aging.current > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Ei erääntynyt</span>
                            <span className="tabular-nums font-medium">{formatEur(dashboard.aging.current)}</span>
                          </div>
                        )}
                        {dashboard.aging.overdue30 > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-[color:var(--warn)]">1–30 pv myöhässä</span>
                            <span className="tabular-nums font-medium text-[color:var(--warn)]">{formatEur(dashboard.aging.overdue30)}</span>
                          </div>
                        )}
                        {dashboard.aging.overdue60 > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-destructive">31–60 pv myöhässä</span>
                            <span className="tabular-nums font-medium text-destructive">{formatEur(dashboard.aging.overdue60)}</span>
                          </div>
                        )}
                        {dashboard.aging.overdue60plus > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-destructive">Yli 60 pv myöhässä</span>
                            <span className="tabular-nums font-medium text-destructive">{formatEur(dashboard.aging.overdue60plus)}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Budget vs actual */}
            {dashboard.budgetVsActual.length > 0 && (
              <Card>
                <CardContent className="pt-4 pb-4 px-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Budjetti vs. toteuma</p>
                  <div className="space-y-2.5">
                    {dashboard.budgetVsActual.map((b) => {
                      const pct = b.budget > 0 ? Math.min((b.actual / b.budget) * 100, 100) : 0;
                      const over = b.actual > b.budget;
                      return (
                        <div key={b.accountNumber}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">{b.accountNumber} {b.accountName}</span>
                            <span className={`tabular-nums font-medium ${over ? "text-destructive" : ""}`}>
                              {formatEur(b.actual)} / {formatEur(b.budget)}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${over ? "bg-destructive" : "bg-primary"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </section>
        )}

        {/* Fiscal years */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Tilikaudet</h2>
            <Button size="sm" variant="outline" onClick={createFiscalYear} disabled={creatingYear}>
              <Plus className="mr-1 h-4 w-4" />
              {creatingYear ? "Luodaan..." : `Uusi tilikausi (${new Date().getFullYear()})`}
            </Button>
          </div>

          {association.fiscalYears.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Ei tilikausia. Luo ensimmäinen tilikausi yllä olevalla napilla.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {association.fiscalYears.map((fy) => (
                <Link key={fy.id} href={`/associations/${id}/fiscal-years/${fy.id}`}>
                  <Card className="hover:border-primary/50 transition-all cursor-pointer">
                    <CardHeader className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">Tilikausi {fy.year}</span>
                          <Badge variant={fy.status === "open" ? "default" : "secondary"}>
                            {fy.status === "open" ? "Auki" : "Suljettu"}
                          </Badge>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Quick links */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Hallinta</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link href={`/associations/${id}/members`}>
              <Card className="hover:border-primary/50 transition-all cursor-pointer h-full">
                <CardHeader>
                  <Users className="h-6 w-6 text-primary mb-2" />
                  <CardTitle className="text-base">{labels.membersTitle}</CardTitle>
                  <CardDescription>{labels.memberDescription}</CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href={`/associations/${id}/settings`}>
              <Card className="hover:border-primary/50 transition-all cursor-pointer h-full">
                <CardHeader>
                  <BookOpen className="h-6 w-6 text-primary mb-2" />
                  <CardTitle className="text-base">Tilikartta</CardTitle>
                  <CardDescription>Katso ja muokkaa tilejä</CardDescription>
                </CardHeader>
              </Card>
            </Link>

            {openYear && (
              <Link href={`/associations/${id}/fiscal-years/${openYear.id}/invoices`}>
                <Card className="hover:border-primary/50 transition-all cursor-pointer h-full">
                  <CardHeader>
                    <FileText className="h-6 w-6 text-primary mb-2" />
                    <CardTitle className="text-base">{labels.invoiceTitle} {openYear.year}</CardTitle>
                    <CardDescription>Luo ja hallinnoi laskuja</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            )}
            <Link href={`/associations/${id}/voucher-templates`}>
              <Card className="hover:border-primary/50 transition-all cursor-pointer h-full">
                <CardHeader>
                  <LayoutTemplate className="h-6 w-6 text-primary mb-2" />
                  <CardTitle className="text-base">Tositemallipohjat</CardTitle>
                  <CardDescription>Hallinnoi toistuvia kirjauksia</CardDescription>
                </CardHeader>
              </Card>
            </Link>
            <Link href={`/associations/${id}/archive`}>
              <Card className="hover:border-primary/50 transition-all cursor-pointer h-full">
                <CardHeader>
                  <Archive className="h-6 w-6 text-primary mb-2" />
                  <CardTitle className="text-base">Liitearkisto</CardTitle>
                  <CardDescription>Kuitit ja asiakirjat arkistossa</CardDescription>
                </CardHeader>
              </Card>
            </Link>
            <Link href={`/associations/${id}/bank-statements`}>
              <Card className="hover:border-primary/50 transition-all cursor-pointer h-full">
                <CardHeader>
                  <Landmark className="h-6 w-6 text-primary mb-2" />
                  <CardTitle className="text-base">Tiliotteet</CardTitle>
                  <CardDescription>Tuo ja täsmäytä pankin tiliotteet</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
