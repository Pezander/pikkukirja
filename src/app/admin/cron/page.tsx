"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface CronConfig {
  enabled: boolean;
  key: string;
  overdueOnly: boolean;
}

export default function CronPage() {
  const [config, setConfig] = useState<CronConfig | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/cron");
    if (res.ok) setConfig(await res.json());
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function save(updates: Partial<CronConfig>) {
    if (!config) return;
    setSaving(true);
    const res = await fetch("/api/admin/cron", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...config, ...updates }),
    });
    if (res.ok) setConfig(await res.json());
    setSaving(false);
  }

  if (!config) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Ladataan...</div>;
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-server.example.com";
  const cronUrl = `${origin}/api/cron/reminders`;
  const curlExample = `curl -s -H "Authorization: Bearer ${config.key}" "${cronUrl}"`;
  const cronExample = `0 9 * * * ${curlExample} > /dev/null`;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link href="/admin/users" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Käyttäjähallinta
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <Clock className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Ajoitetut muistutukset</h1>
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
              <span className="text-sm font-medium">Ota muistutukset käyttöön</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={config.overdueOnly}
                onChange={(e) => save({ overdueOnly: e.target.checked })}
                disabled={saving}
              />
              <span className="text-sm font-medium">Lähetä muistutukset vain erääntyneistä laskuista</span>
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cron-osoite</CardTitle>
            <CardDescription>
              Aseta tämä osoite palvelimesi cron-jobiin. Osoite käy läpi kaikki avoimet tilikaudet kaikissa organisaatioissa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted rounded-md p-3 font-mono text-xs break-all select-all">
              {curlExample}
            </div>
            <p className="text-sm text-muted-foreground">
              Esimerkki crontab-merkinnästä (joka päivä klo 09:00):
            </p>
            <div className="bg-muted rounded-md p-3 font-mono text-xs break-all select-all">
              {cronExample}
            </div>
            <p className="text-xs text-muted-foreground">
              Avain välitetään Authorization-otsakkeessa, ei URL:ssa — se ei tallennu palvelinlokeihin. Jos avain paljastuu, poista data/cron-config.json ja käynnistä sovellus uudelleen.
            </p>

            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const res = await fetch("/api/cron/reminders", {
                  headers: { Authorization: `Bearer ${config.key}` },
                });
                const data = await res.json();
                alert(JSON.stringify(data, null, 2));
              }}
            >
              Testaa nyt
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
