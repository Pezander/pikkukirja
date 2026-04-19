"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface SmtpStatus {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  hasPass: boolean;
  from: string;
  configured: boolean;
  source: "env" | "file";
}

export default function SmtpConfigPage() {
  const [status, setStatus] = useState<SmtpStatus | null>(null);
  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [secure, setSecure] = useState(false);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [from, setFrom] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/smtp");
    if (res.ok) {
      const data: SmtpStatus = await res.json();
      setStatus(data);
      setHost(data.host);
      setPort(String(data.port));
      setSecure(data.secure);
      setUser(data.user);
      setFrom(data.from);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/smtp", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host, port: parseInt(port), secure, user, pass: pass || undefined, from }),
    });
    if (res.ok) {
      setSaved(true);
      setPass("");
      setTimeout(() => setSaved(false), 3000);
      await load();
    } else {
      setError("Tallennus epäonnistui.");
    }
    setSaving(false);
  }

  if (!status) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Ladataan...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link href="/admin/users" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Käyttäjähallinta
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <Mail className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">SMTP-asetukset</h1>
          <span className={`ml-auto inline-flex items-center gap-1.5 text-sm font-medium ${status.configured ? "text-green-600" : "text-muted-foreground"}`}>
            {status.configured
              ? <><CheckCircle className="h-4 w-4" /> Sähköposti käytössä</>
              : <><XCircle className="h-4 w-4" /> Ei käytössä</>}
          </span>
        </div>

        {status.source === "env" && (
          <div className="mb-6 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 rounded-md px-4 py-3 text-sm">
            SMTP on määritetty ympäristömuuttujilla. Alla olevat asetukset ovat vain varmuuskopio — ympäristömuuttujat ohittavat ne.
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Palvelimen asetukset</CardTitle>
            <CardDescription>Asetukset tallennetaan palvelimelle data/smtp-config.json-tiedostoon.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>SMTP-palvelin</Label>
                  <Input placeholder="smtp.example.com" value={host} onChange={(e) => setHost(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Portti</Label>
                  <Input type="number" placeholder="587" value={port} onChange={(e) => setPort(e.target.value)} />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="secure"
                  checked={secure}
                  onChange={(e) => setSecure(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="secure">SSL/TLS (portti 465)</Label>
              </div>

              <div className="space-y-1.5">
                <Label>Käyttäjätunnus</Label>
                <Input placeholder="lähetys@example.com" value={user} onChange={(e) => setUser(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>{status.hasPass ? "Salasana (jätä tyhjäksi jos ei muutosta)" : "Salasana"}</Label>
                <Input type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>Lähettäjän osoite (valinnainen)</Label>
                <Input placeholder="Pikkukirja &lt;kirjanpito@example.com&gt;" value={from} onChange={(e) => setFrom(e.target.value)} />
                <p className="text-xs text-muted-foreground">Jos tyhjä, käytetään käyttäjätunnusta.</p>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
              {saved && <p className="text-sm text-green-600">Tallennettu.</p>}

              <Button type="submit" disabled={saving}>
                {saving ? "Tallennetaan..." : "Tallenna asetukset"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
