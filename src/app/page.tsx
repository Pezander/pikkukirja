"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, ChevronRight, LogOut, KeyRound, Shield } from "lucide-react";
import { getOrgLabels } from "@/lib/orgLabels";
import { ThemeToggle } from "@/components/ThemeToggle";

interface Association {
  id: string;
  name: string;
  type: string;
  city: string;
  fiscalYears: { year: number; status: string }[];
}

const ORG_TYPE_BADGE: Record<string, string> = {
  tiekunta:       "font-mono tracking-wider uppercase bg-blue-50   text-blue-700   dark:bg-blue-950/60   dark:text-blue-300",
  metsastysseura: "font-mono tracking-wider uppercase bg-green-50  text-green-700  dark:bg-green-950/60  dark:text-green-300",
  taloyhtio:      "font-mono tracking-wider uppercase bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300",
  toiminimi:      "font-mono tracking-wider uppercase bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300",
};

export default function HomePage() {
  const { data: session } = useSession();
  const [associations, setAssociations] = useState<Association[]>([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = (session?.user as { role?: string })?.role === "admin";

  useEffect(() => {
    fetch("/api/associations")
      .then((r) => r.json())
      .then((data) => {
        setAssociations(data);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            {session?.user?.name ?? session?.user?.email}
          </span>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link href="/admin/users">
                <Button variant="ghost" size="sm">
                  <Shield className="mr-1.5 h-4 w-4" />
                  Käyttäjät
                </Button>
              </Link>
            )}
            <Link href="/profile">
              <Button variant="ghost" size="sm">
                <KeyRound className="mr-1.5 h-4 w-4" />
                Salasana
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={async () => { await signOut({ redirect: false }); window.location.href = "/login"; }}>
              <LogOut className="mr-1.5 h-4 w-4" />
              Kirjaudu ulos
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-10 text-center">
          <div className="flex justify-center mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Pikkukirja" className="h-24 w-auto" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Pikkukirja</h1>
          <p className="text-muted-foreground">Hallinnoi organisaation taloutta ja asiakirjoja</p>
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground py-12">Ladataan...</div>
        ) : associations.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-6">
              {isAdmin ? "Ei vielä yhtään organisaatiota. Aloita lisäämällä ensimmäinen." : "Sinulle ei ole vielä myönnetty pääsyä yhteenkään organisaatioon."}
            </p>
            {isAdmin && (
              <Link href="/associations/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Lisää organisaatio
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {associations.map((a) => {
              const latestYear = a.fiscalYears[0];
              const labels = getOrgLabels(a.type);
              return (
                <Link key={a.id} href={`/associations/${a.id}`}>
                  <Card className="hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <CardTitle className="text-lg">{a.name}</CardTitle>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${ORG_TYPE_BADGE[a.type] ?? ORG_TYPE_BADGE.tiekunta}`}>
                              {labels.orgTypeName}
                            </span>
                          </div>
                          {a.city && <CardDescription>{a.city}</CardDescription>}
                        </div>
                        <div className="flex items-center gap-3">
                          {latestYear && (
                            <span className="text-sm text-muted-foreground">
                              Tilikausi {latestYear.year}
                              {latestYear.status === "open" && (
                                <span className="ml-2 text-[10px] px-2 py-0.5 rounded bg-[color:var(--positive)]/15 text-[color:var(--positive)]">
                                  Auki
                                </span>
                              )}
                            </span>
                          )}
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              );
            })}

            {isAdmin && (
              <div className="pt-4 flex justify-center">
                <Link href="/associations/new">
                  <Button variant="outline">
                    <Plus className="mr-2 h-4 w-4" />
                    Lisää organisaatio
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
