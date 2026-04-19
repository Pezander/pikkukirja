"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Upload, FileText, Link2, Link2Off, Trash2, ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";

interface VoucherStub {
  id: string;
  number: number;
  description: string;
}

interface BankTransaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  reference: string;
  archiveId: string;
  voucherId: string | null;
  voucher: VoucherStub | null;
}

interface BankStatement {
  id: string;
  filename: string;
  format: string;
  importedAt: string;
  _count: { transactions: number };
  transactions?: BankTransaction[];
}

interface VoucherOption {
  id: string;
  number: number;
  date: string;
  description: string;
  fiscalYear: { id: string; year: number };
}

function formatEur(n: number) {
  const sign = n < 0 ? "−" : "+";
  const color = n < 0 ? "text-destructive" : "text-green-700 dark:text-green-400";
  return { text: sign + " " + Math.abs(n).toFixed(2).replace(".", ",") + " €", color };
}

export default function BankStatementsPage() {
  const { id } = useParams<{ id: string }>();
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [detailsMap, setDetailsMap] = useState<Record<string, BankStatement>>({});
  const [assocName, setAssocName] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Match dialog
  const [matchTarget, setMatchTarget] = useState<{ stmtId: string; tx: BankTransaction } | null>(null);
  const [voucherOptions, setVoucherOptions] = useState<VoucherOption[]>([]);
  const [voucherSearch, setVoucherSearch] = useState("");

  const load = useCallback(async () => {
    const [stmts, assoc] = await Promise.all([
      fetch(`/api/associations/${id}/bank-statements`).then((r) => r.json()),
      fetch(`/api/associations/${id}`).then((r) => r.json()),
    ]);
    setStatements(stmts);
    setAssocName(assoc.name ?? "");
    setLoading(false);
  }, [id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  // Load vouchers for match dialog
  useEffect(() => {
    if (!matchTarget) return;
    fetch(`/api/associations/${id}/fiscal-years`).then((r) => r.json()).then(async (fys: { id: string; year: number }[]) => {
      const all: VoucherOption[] = [];
      for (const fy of fys) {
        const fyData = await fetch(`/api/associations/${id}/fiscal-years/${fy.id}`).then((r) => r.json());
        for (const v of fyData.vouchers ?? []) {
          all.push({ ...v, fiscalYear: { id: fy.id, year: fy.year } });
        }
      }
      setVoucherOptions(all);
    });
  }, [matchTarget, id]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/associations/${id}/bank-statements`, { method: "POST", body: fd });
    if (!res.ok) {
      const err = await res.json();
      setUploadError(err.error ?? "Tuonti epäonnistui.");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploading(false);
    load();
  }

  async function toggleExpand(stmtId: string) {
    if (expanded[stmtId]) {
      setExpanded((p) => ({ ...p, [stmtId]: false }));
      return;
    }
    setExpanded((p) => ({ ...p, [stmtId]: true }));
    if (!detailsMap[stmtId]) {
      const data = await fetch(`/api/associations/${id}/bank-statements/${stmtId}`).then((r) => r.json());
      setDetailsMap((p) => ({ ...p, [stmtId]: data }));
    }
  }

  async function handleMatch(voucherId: string) {
    if (!matchTarget) return;
    await fetch(`/api/associations/${id}/bank-statements/${matchTarget.stmtId}/transactions/${matchTarget.tx.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voucherId }),
    });
    setMatchTarget(null);
    // Refresh statement details
    const data = await fetch(`/api/associations/${id}/bank-statements/${matchTarget.stmtId}`).then((r) => r.json());
    setDetailsMap((p) => ({ ...p, [matchTarget.stmtId]: data }));
  }

  async function handleUnmatch(stmtId: string, tx: BankTransaction) {
    await fetch(`/api/associations/${id}/bank-statements/${stmtId}/transactions/${tx.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voucherId: null }),
    });
    const data = await fetch(`/api/associations/${id}/bank-statements/${stmtId}`).then((r) => r.json());
    setDetailsMap((p) => ({ ...p, [stmtId]: data }));
  }

  async function handleDelete(stmt: BankStatement) {
    if (!confirm(`Poistetaanko tiliote "${stmt.filename}"?`)) return;
    await fetch(`/api/associations/${id}/bank-statements/${stmt.id}`, { method: "DELETE" });
    load();
  }

  const filteredVouchers = voucherOptions.filter((v) => {
    if (!voucherSearch) return true;
    const q = voucherSearch.toLowerCase();
    return v.description.toLowerCase().includes(q) || String(v.number).includes(q) || String(v.fiscalYear.year).includes(q);
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Ladataan...</div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link href={`/associations/${id}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="mr-1 h-4 w-4" />{assocName}
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Tiliotteet</h1>
            <p className="text-sm text-muted-foreground mt-1">Tuo CSV tai CAMT.053 XML. Täsmäytä tapahtumat kirjanpitoon.</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? "Tuodaan..." : "Tuo tiliote"}
            </Button>
            <input ref={fileInputRef} type="file" className="hidden" accept=".csv,.xml,.txt" onChange={handleUpload} />
            {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
          </div>
        </div>

        {statements.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p>Ei tuotuja tiliotteita.</p>
              <p className="text-sm mt-1">Tue CSV-tiedosto (OP, Nordea, S-Pankki) tai CAMT.053 XML.</p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {statements.map((stmt) => {
            const isOpen = !!expanded[stmt.id];
            const details = detailsMap[stmt.id];
            const txns = details?.transactions ?? [];
            const matched = txns.filter((t) => t.voucherId).length;

            return (
              <Card key={stmt.id}>
                <CardContent className="py-3 px-4">
                  {/* Statement header */}
                  <div className="flex items-center gap-3">
                    <button className="text-muted-foreground" onClick={() => toggleExpand(stmt.id)}>
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{stmt.filename}</span>
                        <Badge variant="outline" className="text-xs">{stmt.format === "camt053" ? "CAMT.053" : "CSV"}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(stmt.importedAt).toLocaleDateString("fi-FI")}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {stmt._count.transactions} tapahtumaa
                        {isOpen && txns.length > 0 && ` · ${matched} täsmäytetty`}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleDelete(stmt)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Transaction list */}
                  {isOpen && (
                    <div className="mt-3 border-t pt-3 space-y-1">
                      {txns.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">Ladataan...</p>
                      )}
                      {txns.map((tx) => {
                        const { text: amtText, color: amtColor } = formatEur(tx.amount);
                        return (
                          <div key={tx.id} className="flex items-center gap-3 py-1.5 border-b last:border-0">
                            <span className="text-xs text-muted-foreground w-20 shrink-0">{new Date(tx.date).toLocaleDateString("fi-FI")}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{tx.description || "—"}</p>
                              {tx.reference && <p className="text-xs text-muted-foreground">Viite: {tx.reference}</p>}
                            </div>
                            <span className={`text-sm tabular-nums font-medium shrink-0 ${amtColor}`}>{amtText}</span>
                            <div className="shrink-0 flex items-center gap-1">
                              {tx.voucher ? (
                                <>
                                  <span className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    #{tx.voucher.number}
                                  </span>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" title="Poista täsmäytys" onClick={() => handleUnmatch(stmt.id, tx)}>
                                    <Link2Off className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              ) : (
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setMatchTarget({ stmtId: stmt.id, tx }); setVoucherSearch(""); }}>
                                  <Link2 className="mr-1 h-3.5 w-3.5" />Täsmäytä
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Match to voucher dialog */}
      <Dialog open={!!matchTarget} onOpenChange={(o) => !o && setMatchTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Täsmäytä tositteeseen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {matchTarget && (
              <div className="text-sm text-muted-foreground border rounded-md px-3 py-2">
                <p className="truncate">{matchTarget.tx.description || "—"}</p>
                <p className="tabular-nums font-medium mt-0.5">{formatEur(matchTarget.tx.amount).text}</p>
              </div>
            )}
            <Input
              placeholder="Hae tositetta numerolla tai kuvauksella..."
              value={voucherSearch}
              onChange={(e) => setVoucherSearch(e.target.value)}
            />
            <div className="max-h-72 overflow-y-auto space-y-1">
              {filteredVouchers.slice(0, 50).map((v) => (
                <button
                  key={v.id}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-muted text-sm transition-colors"
                  onClick={() => handleMatch(v.id)}
                >
                  <span className="font-mono text-xs text-muted-foreground mr-2">#{v.number}</span>
                  <span className="font-medium">{v.description}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {new Date(v.date).toLocaleDateString("fi-FI")} · {v.fiscalYear.year}
                  </span>
                </button>
              ))}
              {filteredVouchers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Ei hakutuloksia.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMatchTarget(null)}>Peruuta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
