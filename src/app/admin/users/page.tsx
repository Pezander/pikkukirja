"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Shield, AlertTriangle, ClipboardList, Mail, Clock, Database } from "lucide-react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface Association {
  id: string;
  name: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  accesses: { associationId: string }[];
}

const EMPTY_FORM = { name: "", email: "", password: "", role: "user", accessIds: [] as string[] };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [associations, setAssociations] = useState<Association[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [backupWarning, setBackupWarning] = useState<{ warning: boolean; daysSince: number | null; lastBackupAt: string | null } | null>(null);

  const load = useCallback(async () => {
    const [uRes, aRes, bRes] = await Promise.all([
      fetch("/api/admin/users"),
      fetch("/api/associations"),
      fetch("/api/admin/backup/status"),
    ]);
    setUsers(await uRes.json());
    setAssociations(await aRes.json());
    if (bRes.ok) setBackupWarning(await bRes.json());
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError("");
    setDialogOpen(true);
  }

  function openEdit(u: User) {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: "", role: u.role, accessIds: u.accesses.map((a) => a.associationId) });
    setError("");
    setDialogOpen(true);
  }

  function toggleAccess(id: string) {
    setForm((f) => ({
      ...f,
      accessIds: f.accessIds.includes(id) ? f.accessIds.filter((x) => x !== id) : [...f.accessIds, id],
    }));
  }

  async function handleSave() {
    if (!form.name || !form.email) { setError("Nimi ja sähköposti vaaditaan"); return; }
    if (!editing && !form.password) { setError("Salasana vaaditaan uudelle käyttäjälle"); return; }
    if (form.password && (form.password.length < 8 || !/[\d\W]/.test(form.password))) {
      setError("Salasanan on oltava vähintään 8 merkkiä ja sisällettävä vähintään yksi numero tai erikoismerkki.");
      return;
    }
    setSaving(true);
    setError("");

    const url = editing ? `/api/admin/users/${editing.id}` : "/api/admin/users";
    const method = editing ? "PATCH" : "POST";
    const body: Record<string, string> = { name: form.name, email: form.email, role: form.role };
    if (form.password) body.password = form.password;

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? "Tallennus epäonnistui");
      setSaving(false);
      return;
    }

    // Save tiekunta accesses for non-admin users
    if (form.role !== "admin") {
      const saved = await res.json();
      const userId = editing ? editing.id : saved.id;
      await fetch(`/api/admin/users/${userId}/accesses`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ associationIds: form.accessIds }),
      });
    }

    await load();
    setDialogOpen(false);
    setSaving(false);
  }

  async function handleDelete(u: User) {
    if (!confirm(`Poista käyttäjä "${u.name}"?`)) return;
    await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    await load();
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Ladataan...</div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Etusivu
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Käyttäjähallinta</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/smtp">
              <Button variant="outline">
                <Mail className="mr-2 h-4 w-4" />
                SMTP
              </Button>
            </Link>
            <Link href="/admin/cron">
              <Button variant="outline">
                <Clock className="mr-2 h-4 w-4" />
                Muistutukset
              </Button>
            </Link>
            <Link href="/admin/report-schedule">
              <Button variant="outline">
                <Mail className="mr-2 h-4 w-4" />
                Raportit
              </Button>
            </Link>
            <Link href="/admin/audit-log">
              <Button variant="outline">
                <ClipboardList className="mr-2 h-4 w-4" />
                Tapahtumaloki
              </Button>
            </Link>
            <Link href="/admin/backup">
              <Button variant="outline">
                <Database className="mr-2 h-4 w-4" />
                Varmuuskopiointi
              </Button>
            </Link>
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              Lisää käyttäjä
            </Button>
          </div>
        </div>

        {backupWarning?.warning && (
          <div className="mb-6 flex items-start gap-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-md px-4 py-3 text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-yellow-600" />
            <span>
              {backupWarning.daysSince === null
                ? "Varmuuskopiota ei ole koskaan otettu."
                : `Varmuuskopiota ei ole otettu ${backupWarning.daysSince} päivään.`}
              {" "}Ota varmuuskopio käyttämällä yllä olevaa nappia.
            </span>
          </div>
        )}

        {users.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">Ei käyttäjiä.</CardContent></Card>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nimi</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Sähköposti</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Rooli</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Organisaatiot</th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                        {u.role === "admin" ? "Admin" : u.role === "viewer" ? "Vain luku" : "Käyttäjä"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {u.role === "admin"
                        ? "Kaikki"
                        : u.role === "viewer"
                          ? (u.accesses.length === 0 ? <span className="text-muted-foreground italic">Kaikki (vain luku)</span> : associations.filter((a) => u.accesses.some((ac) => ac.associationId === a.id)).map((a) => a.name).join(", ") + " (vain luku)")
                        : u.accesses.length === 0
                          ? <span className="text-destructive">Ei pääsyä</span>
                          : associations
                              .filter((a) => u.accesses.some((ac) => ac.associationId === a.id))
                              .map((a) => a.name)
                              .join(", ")
                      }
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(u)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(u)}>
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

      {/* Add/Edit user dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Muokkaa käyttäjää" : "Uusi käyttäjä"}</DialogTitle>
          </DialogHeader>
          <form autoComplete="off" onSubmit={(e) => e.preventDefault()} className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Nimi</Label>
              <Input autoComplete="off" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Sähköposti</Label>
              <Input autoComplete="off" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{editing ? "Uusi salasana (jätä tyhjäksi jos ei muutosta)" : "Salasana"}</Label>
              <Input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
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
            {form.role !== "admin" && associations.length > 0 && (
              <div className="space-y-1.5">
                <Label>Organisaatiot</Label>
                <div className="border rounded-md divide-y">
                  {associations.map((a) => (
                    <label key={a.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.accessIds.includes(a.id)}
                        onChange={() => toggleAccess(a.id)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm">{a.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Peruuta</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Tallennetaan..." : "Tallenna"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
