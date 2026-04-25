"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Pencil, Trash2, Users, RefreshCw, Download, Upload } from "lucide-react";
import { generateViitenumero } from "@/lib/viitenumero";
import { getOrgLabels } from "@/lib/orgLabels";

interface Property {
  id?: string;
  name: string;
  units: number;
}

interface Member {
  id: string;
  name: string;
  memberNumber: string;
  address: string;
  postalCode: string;
  city: string;
  email: string;
  referenceNumber: string;
  memberType: string;
  notes: string;
  properties: Property[];
}

const EMPTY_MEMBER: Omit<Member, "id"> = {
  name: "", memberNumber: "", address: "", postalCode: "", city: "",
  email: "", referenceNumber: "", memberType: "", notes: "", properties: [],
};

function newProperty(): Property {
  return { name: "", units: 0 };
}

function totalUnits(m: Member) {
  return m.properties.reduce((s, p) => s + p.units, 0);
}

export default function MembersPage() {
  const { id } = useParams<{ id: string }>();
  const [members, setMembers] = useState<Member[]>([]);
  const [assocName, setAssocName] = useState("");
  const [assocType, setAssocType] = useState("tiekunta");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [form, setForm] = useState<Omit<Member, "id">>(EMPTY_MEMBER);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  // CSV import state
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; errors: string[] } | null>(null);

  const load = useCallback(async () => {
    const [mRes, aRes] = await Promise.all([
      fetch(`/api/associations/${id}/members`),
      fetch(`/api/associations/${id}`),
    ]);
    setMembers(await mRes.json());
    const assoc = await aRes.json();
    setAssocName(assoc.name);
    setAssocType(assoc.type ?? "tiekunta");
    setLoading(false);
  }, [id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const labels = getOrgLabels(assocType);

  function openNew() {
    setEditing(null);
    setForm(EMPTY_MEMBER);
    setError("");
    setDialogOpen(true);
  }

  function openEdit(m: Member) {
    setEditing(m);
    setForm({ ...m });
    setError("");
    setDialogOpen(true);
  }

  function setField(field: keyof Omit<Member, "id" | "properties">, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function addProperty() {
    setForm((f) => ({ ...f, properties: [...f.properties, newProperty()] }));
  }

  function updateProperty(i: number, field: keyof Property, value: string | number) {
    setForm((f) => {
      const props = [...f.properties];
      props[i] = { ...props[i], [field]: value };
      return { ...f, properties: props };
    });
  }

  function removeProperty(i: number) {
    setForm((f) => ({ ...f, properties: f.properties.filter((_, j) => j !== i) }));
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Nimi on pakollinen."); return; }
    setSaving(true);
    setError("");

    const payload = {
      ...form,
      properties: labels.showProperties
        ? form.properties
            .filter((p) => p.name.trim())
            .map((p) => ({ name: p.name, units: Number(p.units) || 0 }))
        : [],
    };

    const url = editing
      ? `/api/associations/${id}/members/${editing.id}`
      : `/api/associations/${id}/members`;
    const method = editing ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      await load();
      setDialogOpen(false);
    } else {
      const err = await res.json();
      setError(err.error ?? "Tallennus epäonnistui.");
    }
    setSaving(false);
  }

  async function handleDelete(m: Member) {
    if (!confirm(`Poista ${labels.memberSingular} "${m.name}"? Tätä ei voi peruuttaa.`)) return;
    setDeleteError("");
    const res = await fetch(`/api/associations/${id}/members/${m.id}`, { method: "DELETE" });
    if (res.status === 409) {
      const err = await res.json();
      setDeleteError(err.error ?? "Poistaminen epäonnistui.");
    } else {
      await load();
    }
  }

  async function handleImport() {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    const text = await importFile.text();
    const res = await fetch(`/api/associations/${id}/members/import`, {
      method: "POST",
      headers: { "Content-Type": "text/csv" },
      body: text,
    });
    const data = await res.json();
    setImportResult(data);
    setImporting(false);
    if (data.created > 0) await load();
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Ladataan...</div>;
  }

  const totalUnitSum = members.reduce((s, m) => s + totalUnits(m), 0);

  return (
    <>
      <div className="max-w-5xl mx-auto px-4 py-8">

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">{labels.membersTitle}</h1>
              <p className="text-sm text-muted-foreground">
                {members.length} {labels.memberPlural}
                {labels.showProperties && ` · ${totalUnitSum.toFixed(2)} ${labels.unitsLabel.toLowerCase()} yhteensä`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setImportOpen(true); setImportResult(null); setImportFile(null); }}>
              <Upload className="mr-2 h-4 w-4" />
              Tuo CSV
            </Button>
            <Button variant="outline" onClick={() => window.open(`/api/associations/${id}/members/export`, "_blank")}>
              <Download className="mr-2 h-4 w-4" />
              Vie CSV
            </Button>
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              Lisää {labels.memberSingular}
            </Button>
          </div>
        </div>

        {deleteError && (
          <div className="mb-4 bg-destructive/10 border border-destructive/30 text-destructive rounded-md px-4 py-3 text-sm flex items-start gap-2">
            <span className="shrink-0">⚠</span>
            <span>{deleteError}</span>
            <button onClick={() => setDeleteError("")} className="ml-auto text-xs underline">Sulje</button>
          </div>
        )}

        {members.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Ei {labels.memberPlural}. Lisää ensimmäinen {labels.memberSingular} yllä olevalla napilla.
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nimi</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Jäsennro</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Osoite</th>
                  {labels.showMemberType && (
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{labels.memberTypeLabel}</th>
                  )}
                  {labels.showProperties && (
                    <>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">{labels.propertyLabel}t</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">{labels.unitsLabel}</th>
                    </>
                  )}
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Viitenumero</th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-t hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">
                      {m.name}
                      {m.email && <div className="text-xs text-muted-foreground">{m.email}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {m.memberNumber || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {[m.address, m.postalCode, m.city].filter(Boolean).join(", ")}
                    </td>
                    {labels.showMemberType && (
                      <td className="px-4 py-3 text-muted-foreground">
                        {labels.memberTypeOptions.find((o) => o.value === m.memberType)?.label ?? (m.memberType || "—")}
                      </td>
                    )}
                    {labels.showProperties && (
                      <>
                        <td className="px-4 py-3">
                          {m.properties.length === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <div className="space-y-0.5">
                              {m.properties.map((p, i) => (
                                <div key={i} className="text-xs">
                                  {p.name} <span className="text-muted-foreground">({p.units} {labels.unitAbbr})</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">
                          {totalUnits(m).toFixed(2)}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {m.referenceNumber || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(m)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(m)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CSV Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tuo jäsenet CSV-tiedostosta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <p className="text-muted-foreground">
              CSV-tiedoston ensimmäisen rivin tulee olla otsikkorivi. Tuetut sarakkeet:
            </p>
            <code className="block bg-muted rounded px-3 py-2 text-xs">
              Nimi,Jäsennumero,Osoite,Postinumero,Kaupunki,Sähköposti,Viitenumero,Jäsentyyppi,Muistiinpanot
            </code>
            <p className="text-muted-foreground text-xs">Vain Nimi on pakollinen. Viitenumero generoidaan automaattisesti jos se on tyhjä.</p>
            <input
              type="file"
              accept=".csv,text/csv"
              className="block w-full text-sm border rounded-md px-3 py-2"
              onChange={(e) => { setImportFile(e.target.files?.[0] ?? null); setImportResult(null); }}
            />
            {importResult && (
              <div className={`rounded-md px-3 py-2 text-sm ${importResult.created > 0 ? "bg-green-50 text-green-700 border border-green-200" : "bg-muted"}`}>
                {importResult.created > 0 && <p>{importResult.created} jäsentä tuotu onnistuneesti.</p>}
                {importResult.errors.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs text-destructive">
                    {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Sulje</Button>
            <Button onClick={handleImport} disabled={!importFile || importing}>
              {importing ? "Tuodaan..." : "Tuo jäsenet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Muokkaa ${labels.memberSingular}a` : `Uusi ${labels.memberSingular}`}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nimi *</Label>
              <Input value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Etunimi Sukunimi" />
            </div>

            <div className="space-y-1.5">
              <Label>Jäsennumero</Label>
              <Input value={form.memberNumber} onChange={(e) => setField("memberNumber", e.target.value)} placeholder="Esim. RHY-jäsennumero" className="font-mono" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Osoite</Label>
                <Input autoComplete="off" value={form.address} onChange={(e) => setField("address", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Postinumero</Label>
                <Input autoComplete="off" value={form.postalCode} onChange={(e) => setField("postalCode", e.target.value)} className="max-w-28" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Kaupunki</Label>
                <Input autoComplete="off" value={form.city} onChange={(e) => setField("city", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Sähköposti</Label>
                <Input type="text" autoComplete="off" value={form.email} onChange={(e) => setField("email", e.target.value)} placeholder="yksi@email.fi tai monta@email.fi, toinen@email.fi" />
                <p className="text-xs text-muted-foreground">Useita osoitteita pilkulla erotettuna.</p>
              </div>
            </div>

            {/* Member type — metsästysseura only */}
            {labels.showMemberType && (
              <div className="space-y-1.5">
                <Label>{labels.memberTypeLabel}</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={form.memberType}
                  onChange={(e) => setField("memberType", e.target.value)}
                >
                  <option value="">— Valitse jäsentyyppi —</option>
                  {labels.memberTypeOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Viitenumero</Label>
              <div className="flex gap-2">
                <Input
                  value={form.referenceNumber}
                  onChange={(e) => setField("referenceNumber", e.target.value)}
                  placeholder="Pankkiviite"
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  title="Generoi viitenumero"
                  onClick={() => {
                    const base = Date.now() % 1000000;
                    setField("referenceNumber", generateViitenumero(base));
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Voit syöttää itse tai generoida automaattisesti</p>
            </div>

            {/* Properties — tiekunta and taloyhtiö only */}
            {labels.showProperties && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>{labels.propertiesLabel}</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={addProperty} className="h-7 text-xs">
                    <Plus className="mr-1 h-3 w-3" />
                    Lisää {labels.propertyLabel.toLowerCase()}
                  </Button>
                </div>
                {form.properties.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">Ei {labels.propertyLabel.toLowerCase()}ja. Lisää yllä.</p>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[1fr_80px_32px] gap-2 text-xs text-muted-foreground mb-1">
                      <span>{labels.propertyLabel}n nimi</span>
                      <span className="text-right">{labels.unitsLabel}</span>
                      <span />
                    </div>
                    {form.properties.map((p, i) => (
                      <div key={i} className="grid grid-cols-[1fr_80px_32px] gap-2 items-center">
                        <Input
                          className="h-8 text-sm"
                          placeholder={assocType === "taloyhtio" ? "Esim. A 12" : "Esim. Oravalahdentie 5"}
                          value={p.name}
                          onChange={(e) => updateProperty(i, "name", e.target.value)}
                        />
                        <Input
                          className="h-8 text-sm text-right"
                          type="number"
                          step={assocType === "taloyhtio" ? "1" : "0.25"}
                          min="0"
                          value={p.units}
                          onChange={(e) => updateProperty(i, "units", e.target.value)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeProperty(i)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Muistiinpanot</Label>
              <Input value={form.notes} onChange={(e) => setField("notes", e.target.value)} />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Peruuta</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Tallennetaan..." : editing ? "Tallenna" : `Lisää ${labels.memberSingular}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
