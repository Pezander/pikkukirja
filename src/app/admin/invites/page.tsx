"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Association {
  id: string;
  name: string;
}

interface Invite {
  id: string;
  email: string;
  role: string;
  associationId: string;
  association: { name: string };
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

function inviteStatus(invite: Invite): "used" | "expired" | "pending" {
  if (invite.usedAt) return "used";
  if (new Date(invite.expiresAt) < new Date()) return "expired";
  return "pending";
}

const EMPTY_FORM = { email: "", role: "user", associationId: "" };

export default function AdminInvitesPage() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [associations, setAssociations] = useState<Association[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [iRes, aRes] = await Promise.all([
      fetch("/api/admin/invites"),
      fetch("/api/associations"),
    ]);
    setInvites(await iRes.json());
    setAssociations(await aRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setForm(EMPTY_FORM);
    setError("");
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.email || !form.role || !form.associationId) {
      setError("Kaikki kentät ovat pakollisia");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? "Tallennus epäonnistui");
      setSaving(false);
      return;
    }
    await load();
    setDialogOpen(false);
    setSaving(false);
  }

  async function handleRevoke(invite: Invite) {
    if (!confirm(`Peruuta kutsu osoitteelle "${invite.email}"?`)) return;
    await fetch(`/api/admin/invites/${invite.id}`, { method: "DELETE" });
    await load();
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Ladataan...</div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link href="/admin/users" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Käyttäjähallinta
        </Link>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Google-kutsut</h1>
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" />
            Uusi kutsu
          </Button>
        </div>

        {invites.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">Ei kutsuja.</CardContent></Card>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Sähköposti</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Rooli</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Organisaatio</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vanhenee</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tila</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => {
                  const status = inviteStatus(inv);
                  return (
                    <tr key={inv.id} className="border-t hover:bg-muted/20">
                      <td className="px-4 py-3 font-mono text-xs">{inv.email}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">
                          {inv.role === "admin" ? "Admin" : inv.role === "viewer" ? "Vain luku" : "Käyttäjä"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{inv.association.name}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(inv.expiresAt).toLocaleDateString("fi-FI")}
                      </td>
                      <td className="px-4 py-3">
                        {status === "used" && <Badge variant="default">Käytetty</Badge>}
                        {status === "expired" && <Badge variant="destructive">Vanhentunut</Badge>}
                        {status === "pending" && <Badge variant="outline">Odottaa</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        {status === "pending" && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleRevoke(inv)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Uusi Google-kutsu</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Sähköposti (Google-tili)</Label>
              <Input
                type="email"
                autoComplete="off"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="kayttaja@gmail.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Rooli</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v ?? f.role }))}>
                <SelectTrigger>
                  <span data-slot="select-value">
                    {form.role === "admin" ? "Admin" : form.role === "viewer" ? "Vain luku" : "Käyttäjä"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Käyttäjä</SelectItem>
                  <SelectItem value="viewer">Vain luku</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Organisaatio</Label>
              <Select value={form.associationId} onValueChange={(v) => setForm((f) => ({ ...f, associationId: v ?? f.associationId }))}>
                <SelectTrigger>
                  <span data-slot="select-value">
                    {form.associationId
                      ? associations.find((a) => a.id === form.associationId)?.name ?? "Valitse..."
                      : "Valitse..."}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {associations.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">Kutsu on voimassa 7 päivää.</p>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Peruuta</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Tallennetaan..." : "Lähetä kutsu"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
