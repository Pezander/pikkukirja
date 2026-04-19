"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
}

const ACTION_CLASSES: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700",
  UPDATE: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
};

const ENTITY_TYPES = ["", "Voucher", "Invoice", "Member", "FiscalYear", "User"];
const ENTITY_LABELS: Record<string, string> = {
  "": "Kaikki",
  Voucher: "Tositteet",
  Invoice: "Laskut",
  Member: "Jäsenet",
  FiscalYear: "Tilikaudet",
  User: "Käyttäjät",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("fi-FI", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityType, setEntityType] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const url = entityType
      ? `/api/admin/audit-log?entityType=${entityType}`
      : "/api/admin/audit-log";
    const res = await fetch(url);
    if (res.ok) setEntries(await res.json());
    setLoading(false);
  }, [entityType]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link href="/admin/users" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Käyttäjähallinta
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Tapahtumaloki</h1>
          </div>
          <Select value={entityType} onValueChange={(v) => setEntityType(v ?? "")}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Suodata kohteella" />
            </SelectTrigger>
            <SelectContent>
              {ENTITY_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{ENTITY_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground py-12">Ladataan...</div>
        ) : entries.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Ei tapahtumia.
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Aika</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Käyttäjä</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Toiminto</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Kohde</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Kuvaus</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-t hover:bg-muted/20">
                    <td className="px-4 py-2.5 text-muted-foreground tabular-nums whitespace-nowrap">
                      {formatDateTime(entry.timestamp)}
                    </td>
                    <td className="px-4 py-2.5 font-medium">{entry.userName}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_CLASSES[entry.action] ?? "bg-muted text-muted-foreground"}`}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{ENTITY_LABELS[entry.entityType] ?? entry.entityType}</td>
                    <td className="px-4 py-2.5">{entry.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
