"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import { VoucherTemplateDialog, type VoucherTemplateData } from "@/components/fiscal-year/VoucherTemplateDialog";
import type { Account } from "@/app/associations/[id]/fiscal-years/[fyId]/page";

const RECURRENCE_LABELS: Record<string, string> = {
  none: "Ei toistuvaa",
  monthly: "Kuukausittain",
  quarterly: "Neljännesvuosittain",
  yearly: "Vuosittain",
};

export default function VoucherTemplatesPage() {
  const { id } = useParams<{ id: string }>();
  const [templates, setTemplates] = useState<VoucherTemplateData[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VoucherTemplateData | null>(null);
  const [assocName, setAssocName] = useState("");

  const load = useCallback(async () => {
    const [tmpl, acc, assoc] = await Promise.all([
      fetch(`/api/associations/${id}/voucher-templates`).then((r) => r.json()),
      fetch(`/api/associations/${id}/accounts`).then((r) => r.json()),
      fetch(`/api/associations/${id}`).then((r) => r.json()),
    ]);
    setTemplates(tmpl);
    setAccounts(acc);
    setAssocName(assoc.name ?? "");
    setLoading(false);
  }, [id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  function openNew() { setEditing(null); setDialogOpen(true); }
  function openEdit(t: VoucherTemplateData) { setEditing(t); setDialogOpen(true); }

  async function handleDelete(t: VoucherTemplateData) {
    if (!confirm(`Poistetaanko mallipohja "${t.name}"?`)) return;
    await fetch(`/api/associations/${id}/voucher-templates/${t.id}`, { method: "DELETE" });
    load();
  }

  async function toggleActive(t: VoucherTemplateData) {
    await fetch(`/api/associations/${id}/voucher-templates/${t.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !t.isActive, lines: t.lines.map((l) => ({ accountId: l.accountId, debit: l.debit, credit: l.credit, note: l.note })) }),
    });
    load();
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Ladataan...</div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link href={`/associations/${id}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="mr-1 h-4 w-4" />{assocName}
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Tositemallipohjat</h1>
            <p className="text-sm text-muted-foreground mt-1">Tallenna toistuvia tositteita mallipohjiksi ja käytä niitä nopeasti uusia tositteita luodessa.</p>
          </div>
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" />Uusi mallipohja
          </Button>
        </div>

        {templates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <RefreshCw className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p>Ei mallipohjia vielä.</p>
              <p className="text-sm mt-1">Luo mallipohja toistuviin kirjauksiin kuten vuokriin tai vakuutuksiin.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {templates.map((t) => (
              <Card key={t.id} className={!t.isActive ? "opacity-60" : ""}>
                <CardContent className="py-4 px-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{t.name}</span>
                        {t.recurrence !== "none" && (
                          <Badge variant="secondary" className="text-xs">
                            <RefreshCw className="mr-1 h-3 w-3" />
                            {RECURRENCE_LABELS[t.recurrence]}
                          </Badge>
                        )}
                        {!t.isActive && <Badge variant="outline" className="text-xs">Pois käytöstä</Badge>}
                      </div>
                      {t.description && <p className="text-sm text-muted-foreground mt-0.5">{t.description}</p>}
                      <div className="mt-2 space-y-0.5">
                        {t.lines.map((l, i) => (
                          <div key={i} className="text-xs text-muted-foreground flex gap-3">
                            <span className="font-mono">{l.account.number} {l.account.name}</span>
                            {l.debit > 0 && <span>D {l.debit.toFixed(2)} €</span>}
                            {l.credit > 0 && <span>K {l.credit.toFixed(2)} €</span>}
                            {l.note && <span className="italic">{l.note}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => toggleActive(t)}>
                        {t.isActive ? "Poista käytöstä" : "Ota käyttöön"}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(t)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <VoucherTemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        accounts={accounts}
        associationId={id}
        editing={editing}
        onSaved={() => { load(); setDialogOpen(false); }}
      />
    </div>
  );
}
