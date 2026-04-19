"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Association {
  id: string;
  name: string;
}

interface ReportScheduleConfig {
  enabled: boolean;
  key: string;
  reportType: "income-statement" | "invoice-aging";
  recipients: string[];
  associationIds: string[];
}

export default function ReportSchedulePage() {
  const [config, setConfig] = useState<ReportScheduleConfig | null>(null);
  const [associations, setAssociations] = useState<Association[]>([]);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [recipientsText, setRecipientsText] = useState("");

  const load = useCallback(async () => {
    const [cfgRes, aRes] = await Promise.all([
      fetch("/api/admin/report-schedule"),
      fetch("/api/associations"),
    ]);
    if (cfgRes.ok) {
      const cfg: ReportScheduleConfig = await cfgRes.json();
      setConfig(cfg);
      setRecipientsText(cfg.recipients.join("\n"));
    }
    if (aRes.ok) setAssociations(await aRes.json());
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function save(updates: Partial<ReportScheduleConfig> & { recipientsRaw?: string }) {
    if (!config) return;
    setSaving(true);
    const recipients = (updates.recipientsRaw ?? recipientsText)
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.includes("@"));

    const res = await fetch("/api/admin/report-schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...config, ...updates, recipients }),
    });
    if (res.ok) {
      const updated = await res.json();
      setConfig(updated);
      setRecipientsText(updated.recipients.join("\n"));
    }
    setSaving(false);
  }

  function toggleAssociation(id: string) {
    if (!config) return;
    const current = config.associationIds;
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    setConfig((c) => c ? { ...c, associationIds: next } : c);
    save({ associationIds: next });
  }

  async function runNow() {
    if (!config) return;
    setTestResult(null);
    const res = await fetch("/api/cron/report-delivery", {
      headers: { Authorization: `Bearer ${config.key}` },
    });
    const data = await res.json();
    setTestResult(JSON.stringify(data, null, 2));
  }

  if (!config) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Ladataan...</div>;
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-server.example.com";
  const cronUrl = `${origin}/api/cron/report-delivery`;
  const curlExample = `curl -s -H "Authorization: Bearer ${config.key}" "${cronUrl}"`;
  const cronExample = `0 8 * * 1 ${curlExample} > /dev/null`;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link href="/admin/users" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Käyttäjähallinta
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <Mail className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Ajoitettu raporttitoimitus</h1>
        </div>

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
              <span className="text-sm font-medium">Ota ajoitettu raporttitoimitus käyttöön</span>
            </label>

            <div className="space-y-1.5">
              <Label>Raporttityyppi</Label>
              <Select
                value={config.reportType}
                onValueChange={(v) => save({ reportType: v as "income-statement" | "invoice-aging" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoice-aging">Laskujen ikäanalyysi (avoimet laskut)</SelectItem>
                  <SelectItem value="income-statement">Tuloslaskelma</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Vastaanottajat (yksi per rivi tai pilkulla erotettuna)</Label>
              <textarea
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                value={recipientsText}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRecipientsText(e.target.value)}
                onBlur={() => save({ recipientsRaw: recipientsText })}
                placeholder={"esimerkki@email.fi\ntoinen@email.fi"}
              />
              <p className="text-xs text-muted-foreground">
                {config.recipients.length > 0
                  ? `${config.recipients.length} vastaanottajaa tallennettu`
                  : "Ei vastaanottajia – lisää sähköpostiosoitteet yllä"}
              </p>
            </div>

            {associations.length > 0 && (
              <div className="space-y-1.5">
                <Label>Organisaatiot (tyhjä = kaikki)</Label>
                <div className="border rounded-md divide-y">
                  {associations.map((a) => (
                    <label key={a.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={config.associationIds.length === 0 || config.associationIds.includes(a.id)}
                        onChange={() => toggleAssociation(a.id)}
                      />
                      <span className="text-sm">{a.name}</span>
                    </label>
                  ))}
                </div>
                {config.associationIds.length === 0 && (
                  <p className="text-xs text-muted-foreground">Kaikki organisaatiot sisällytetään raporttiin.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cron-osoite</CardTitle>
            <CardDescription>
              Aseta tämä osoite palvelimesi cron-jobiin. Raportti lähetetään sähköpostilla vastaanottajille.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted rounded-md p-3 font-mono text-xs break-all select-all">
              {curlExample}
            </div>
            <p className="text-sm text-muted-foreground">
              Esimerkki crontab-merkinnästä (joka maanantai klo 08:00):
            </p>
            <div className="bg-muted rounded-md p-3 font-mono text-xs break-all select-all">
              {cronExample}
            </div>
            <Button variant="outline" size="sm" onClick={runNow}>
              Testaa nyt
            </Button>
            {testResult && (
              <pre className="bg-muted rounded-md p-3 text-xs overflow-auto max-h-40">{testResult}</pre>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
