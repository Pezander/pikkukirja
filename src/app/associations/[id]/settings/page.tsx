"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Pencil, Trash2, Settings } from "lucide-react";
import { getOrgLabels } from "@/lib/orgLabels";

interface Association {
  id: string;
  name: string;
  type: string;
  address: string;
  postalCode: string;
  city: string;
  iban: string;
  bic: string;
  bankName: string;
  contactName: string;
  phone: string;
  email: string;
  vatRate: number | null;
}

interface Account {
  id: string;
  number: string;
  name: string;
  type: string;
  isSystem: boolean;
}

const ACCOUNT_TYPES = [
  { value: "asset", label: "Vastaavaa" },
  { value: "liability", label: "Vastattavaa" },
  { value: "equity", label: "Oma pääoma" },
  { value: "income", label: "Tulot" },
  { value: "expense", label: "Menot" },
];

const TYPE_LABELS: Record<string, string> = {
  asset: "Vastaavaa", liability: "Vastattavaa",
  equity: "Oma pääoma", income: "Tulot", expense: "Menot",
};

export default function SettingsPage() {
  const { id } = useParams<{ id: string }>();
  const [assoc, setAssoc] = useState<Association | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Account dialog
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accNumber, setAccNumber] = useState("");
  const [accName, setAccName] = useState("");
  const [accType, setAccType] = useState("expense");
  const [accError, setAccError] = useState("");
  const [accSaving, setAccSaving] = useState(false);

  const load = useCallback(async () => {
    const [aRes, accRes] = await Promise.all([
      fetch(`/api/associations/${id}`),
      fetch(`/api/associations/${id}/accounts`),
    ]);
    setAssoc(await aRes.json());
    setAccounts(await accRes.json());
  }, [id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  function setField(field: keyof Association, value: string) {
    setAssoc((a) => a ? { ...a, [field]: value } : a);
  }

  async function handleSaveDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!assoc) return;
    setSaving(true);
    setError("");
    const res = await fetch(`/api/associations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: assoc.name,
        type: assoc.type,
        address: assoc.address,
        postalCode: assoc.postalCode,
        city: assoc.city,
        iban: assoc.iban,
        bic: assoc.bic,
        bankName: assoc.bankName,
        contactName: assoc.contactName,
        phone: assoc.phone,
        email: assoc.email,
        vatRate: assoc.vatRate,
      }),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } else {
      setError("Tallennus epäonnistui.");
    }
    setSaving(false);
  }

  function openNewAccount() {
    setEditingAccount(null);
    setAccNumber(""); setAccName(""); setAccType("expense"); setAccError("");
    setAccountDialogOpen(true);
  }

  function openEditAccount(acc: Account) {
    setEditingAccount(acc);
    setAccNumber(acc.number); setAccName(acc.name); setAccType(acc.type); setAccError("");
    setAccountDialogOpen(true);
  }

  async function handleSaveAccount() {
    if (!accNumber.trim() || !accName.trim()) { setAccError("Numero ja nimi ovat pakollisia."); return; }
    setAccSaving(true); setAccError("");

    const url = editingAccount
      ? `/api/associations/${id}/accounts/${editingAccount.id}`
      : `/api/associations/${id}/accounts`;
    const method = editingAccount ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number: accNumber, name: accName, type: accType }),
    });

    if (res.ok) {
      await load();
      setAccountDialogOpen(false);
    } else {
      const err = await res.json();
      setAccError(err.error ?? "Tallennus epäonnistui.");
    }
    setAccSaving(false);
  }

  async function handleDeleteAccount(acc: Account) {
    if (!confirm(`Poista tili "${acc.number} – ${acc.name}"?`)) return;
    const res = await fetch(`/api/associations/${id}/accounts/${acc.id}`, { method: "DELETE" });
    if (res.ok) {
      await load();
    } else {
      const err = await res.json();
      alert(err.error);
    }
  }

  if (!assoc) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Ladataan...</div>;
  }

  const labels = getOrgLabels(assoc.type);

  const groupedAccounts = ["asset", "liability", "equity", "income", "expense"].map((type) => ({
    type,
    label: TYPE_LABELS[type],
    accounts: accounts.filter((a) => a.type === type),
  })).filter((g) => g.accounts.length > 0);

  return (
    <>
      <div className="max-w-3xl mx-auto px-4 py-8">

        <div className="flex items-center gap-3 mb-8">
          <Settings className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Asetukset</h1>
        </div>

        {/* Association details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{labels.orgTypeName}n tiedot</CardTitle>
            <CardDescription>Nämä tiedot näkyvät laskuissa ja raporteissa.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveDetails} className="space-y-5">
              <div className="space-y-1.5">
                <Label>{labels.orgNameLabel} *</Label>
                <Input value={assoc.name} onChange={(e) => setField("name", e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Katuosoite</Label>
                  <Input value={assoc.address} onChange={(e) => setField("address", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Postinumero</Label>
                  <Input value={assoc.postalCode} onChange={(e) => setField("postalCode", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Kaupunki</Label>
                <Input value={assoc.city} onChange={(e) => setField("city", e.target.value)} />
              </div>

              <div className="border-t pt-5 space-y-4">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide text-xs">Pankkitiedot</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Pankki</Label>
                    <Input value={assoc.bankName} onChange={(e) => setField("bankName", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>BIC / SWIFT</Label>
                    <Input value={assoc.bic} onChange={(e) => setField("bic", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>IBAN</Label>
                  <Input value={assoc.iban} onChange={(e) => setField("iban", e.target.value)} className="font-mono" />
                </div>
              </div>

              <div className="border-t pt-5 space-y-4">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide text-xs">Yhteyshenkilö</p>
                <div className="space-y-1.5">
                  <Label>Nimi</Label>
                  <Input value={assoc.contactName} onChange={(e) => setField("contactName", e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Puhelin</Label>
                    <Input value={assoc.phone} onChange={(e) => setField("phone", e.target.value)} type="tel" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Sähköposti</Label>
                    <Input value={assoc.email} onChange={(e) => setField("email", e.target.value)} type="email" />
                  </div>
                </div>
              </div>

              {assoc.type === "toiminimi" && (
                <div className="border-t pt-5 space-y-4">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide text-xs">ALV-asetukset</p>
                  <div className="space-y-1.5">
                    <Label>ALV-prosentti (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      placeholder="Esim. 25.5"
                      value={assoc.vatRate ?? ""}
                      onChange={(e) => setAssoc((a) => a ? { ...a, vatRate: e.target.value === "" ? null : parseFloat(e.target.value) } : a)}
                      className="max-w-36"
                    />
                    <p className="text-xs text-muted-foreground">Jätä tyhjäksi jos ALV ei ole käytössä. Laskuissa näytetään ALV-erittely.</p>
                  </div>
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={saving}>
                  {saving ? "Tallennetaan..." : "Tallenna"}
                </Button>
                {saved && <span className="text-sm text-green-600 dark:text-green-400">✓ Tallennettu</span>}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Chart of accounts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Tilikartta</CardTitle>
                <CardDescription>Hallinnoi kirjanpidon tilejä.</CardDescription>
              </div>
              <Button size="sm" onClick={openNewAccount}>
                <Plus className="mr-1 h-4 w-4" />
                Lisää tili
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {groupedAccounts.map((group) => (
              <div key={group.type} className="mb-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {group.label}
                </p>
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody>
                      {group.accounts.map((acc) => (
                        <tr key={acc.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-3 py-2 font-mono text-muted-foreground w-12">{acc.number}</td>
                          <td className="py-2 flex-1">{acc.name}</td>
                          <td className="px-3 py-2 w-16">
                            <div className="flex gap-0.5 justify-end">
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditAccount(acc)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost" size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteAccount(acc)}
                                disabled={acc.isSystem}
                                title={acc.isSystem ? "Oletustitiä ei voi poistaa" : "Poista tili"}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Account dialog */}
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingAccount ? "Muokkaa tiliä" : "Uusi tili"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tilinumero *</Label>
                <Input value={accNumber} onChange={(e) => setAccNumber(e.target.value)} placeholder="Esim. 420" className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label>Tilityyppi *</Label>
                <Select value={accType} onValueChange={(v) => setAccType(v ?? "expense")}>
                  <SelectTrigger>
                    <SelectValue>{ACCOUNT_TYPES.find(t => t.value === accType)?.label ?? accType}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tilin nimi *</Label>
              <Input value={accName} onChange={(e) => setAccName(e.target.value)} placeholder="Esim. Aurauskulut" />
            </div>
            {accError && <p className="text-sm text-destructive">{accError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccountDialogOpen(false)}>Peruuta</Button>
            <Button onClick={handleSaveAccount} disabled={accSaving}>
              {accSaving ? "Tallennetaan..." : editingAccount ? "Tallenna" : "Lisää tili"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
