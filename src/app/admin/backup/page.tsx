"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Database, Download, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BackupConfig {
  enabled: boolean;
  key: string;
  backupDir: string;
  keepLast: number;
}

interface BackupStatus {
  warning: boolean;
  daysSince: number | null;
  lastBackupAt: string | null;
}

export default function BackupPage() {
  const [config, setConfig] = useState<BackupConfig | null>(null);
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [cfgRes, stRes] = await Promise.all([
      fetch("/api/admin/backup-config"),
      fetch("/api/admin/backup/status"),
    ]);
    if (cfgRes.ok) setConfig(await cfgRes.json());
    if (stRes.ok) setStatus(await stRes.json());
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function save(updates: Partial<BackupConfig>) {
    if (!config) return;
    setSaving(true);
    const res = await fetch("/api/admin/backup-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...config, ...updates }),
    });
    if (res.ok) setConfig(await res.json());
    setSaving(false);
  }

  async function runNow() {
    if (!config) return;
    setTestResult(null);
    const res = await fetch("/api/cron/backup", {
      headers: { Authorization: `Bearer ${config.key}` },
    });
    const data = await res.json();
    setTestResult(JSON.stringify(data, null, 2));
    await load();
  }

  if (!config) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Ladataan...</div>;
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-server.example.com";
  const cronUrl = `${origin}/api/cron/backup`;
  const curlExample = `curl -s -H "Authorization: Bearer ${config.key}" "${cronUrl}"`;
  const cronExample = `0 3 * * * ${curlExample} > /dev/null`;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link href="/admin/users" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Käyttäjähallinta
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <Database className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Automaattinen varmuuskopiointi</h1>
        </div>

        {status?.warning && (
          <div className="mb-6 flex items-start gap-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-md px-4 py-3 text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-yellow-600" />
            <span>
              {status.daysSince === null
                ? "Varmuuskopiota ei ole koskaan otettu."
                : `Varmuuskopiosta on ${status.daysSince} päivää.`}
            </span>
          </div>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Asetukset</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={config.enabled}
                onChange={(e) => save({ enabled: e.target.checked })}
                disabled={saving}
              />
              <span className="text-sm font-medium">Ota automaattinen varmuuskopiointi käyttöön</span>
            </label>

            <div className="space-y-1.5">
              <Label>Varmuuskopiohakemisto</Label>
              <Input
                value={config.backupDir}
                onChange={(e) => setConfig((c) => c ? { ...c, backupDir: e.target.value } : c)}
                onBlur={() => save({ backupDir: config.backupDir })}
                placeholder="data/backups"
              />
              <p className="text-xs text-muted-foreground">Suhteellinen polku sovelluksen juuresta tai absoluuttinen polku.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Säilytettävien varmuuskopioiden määrä</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={config.keepLast}
                onChange={(e) => setConfig((c) => c ? { ...c, keepLast: parseInt(e.target.value) || 7 } : c)}
                onBlur={() => save({ keepLast: config.keepLast })}
                className="w-24"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Cron-osoite</CardTitle>
            <CardDescription>
              Aseta tämä osoite palvelimesi cron-jobiin varmuuskopiointia varten.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted rounded-md p-3 font-mono text-xs break-all select-all">
              {curlExample}
            </div>
            <p className="text-sm text-muted-foreground">
              Esimerkki crontab-merkinnästä (joka päivä klo 03:00):
            </p>
            <div className="bg-muted rounded-md p-3 font-mono text-xs break-all select-all">
              {cronExample}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={runNow}>
                Ota varmuuskopio nyt
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.open("/api/admin/backup", "_blank")}>
                <Download className="mr-2 h-4 w-4" />
                Lataa tietokanta
              </Button>
            </div>
            {testResult && (
              <pre className="bg-muted rounded-md p-3 text-xs overflow-auto max-h-40">{testResult}</pre>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
