"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, ChevronRight } from "lucide-react";
import { getOrgLabels } from "@/lib/orgLabels";
import { TopBar } from "@/components/TopBar";

interface Association {
  id: string;
  name: string;
  type: string;
  city: string;
  fiscalYears: { year: number; status: string }[];
}

const ORG_TYPE_STYLES: Record<string, { bg: string; color: string }> = {
  tiekunta:       { bg: "oklch(0.94 0.035 220 / 0.55)", color: "oklch(0.38 0.080 220)" },
  metsastysseura: { bg: "oklch(0.94 0.035 150 / 0.55)", color: "oklch(0.38 0.080 150)" },
  taloyhtio:      { bg: "oklch(0.94 0.035 45 / 0.55)",  color: "oklch(0.38 0.080 45)"  },
  toiminimi:      { bg: "oklch(0.94 0.035 300 / 0.55)", color: "oklch(0.38 0.080 300)" },
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
    <div className="min-h-screen flex flex-col bg-background">
      <TopBar
        email={session?.user?.email}
        name={session?.user?.name}
        isAdmin={isAdmin}
      />

      <div className="flex-1 py-11 px-8">
        <div className="mx-auto" style={{ maxWidth: 680 }}>
          {/* Page header */}
          <div className="mb-6">
            <p className="font-mono text-[10px] font-medium tracking-[0.9px] uppercase text-muted-foreground mb-1">
              TERVETULOA TAKAISIN
            </p>
            <h1 className="text-3xl font-bold tracking-[-0.05em]">Organisaatiosi</h1>
            <p className="text-[13.5px] text-muted-foreground mt-1">
              Valitse organisaatio jatkaaksesi
            </p>
          </div>

          {loading ? (
            <div className="text-center text-muted-foreground py-12">Ladataan...</div>
          ) : associations.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-6">
                {isAdmin
                  ? "Ei vielä yhtään organisaatiota. Aloita lisäämällä ensimmäinen."
                  : "Sinulle ei ole vielä myönnetty pääsyä yhteenkään organisaatioon."}
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
            <>
              <Card className="divide-y divide-border overflow-hidden">
                {associations.map((a) => {
                  const latestYear = a.fiscalYears[0];
                  const labels = getOrgLabels(a.type);
                  const typeStyle = ORG_TYPE_STYLES[a.type] ?? ORG_TYPE_STYLES.tiekunta;
                  const isOpen = latestYear?.status === "open";

                  return (
                    <Link key={a.id} href={`/associations/${a.id}`}>
                      <div className="p-[13px_17px] flex items-center gap-3.5 cursor-pointer hover:bg-muted/50 transition-colors duration-100">
                        {/* Left: name + chip + meta */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-[14.5px] truncate">
                              {a.name}
                            </span>
                            <span
                              className="font-mono text-[9.5px] tracking-[0.7px] font-medium px-1.5 py-0.5 rounded-[4px] whitespace-nowrap"
                              style={{ background: typeStyle.bg, color: typeStyle.color }}
                            >
                              {labels.orgTypeName.toUpperCase()}
                            </span>
                          </div>
                          {a.city && (
                            <p className="text-xs text-muted-foreground font-mono mt-0.5">
                              {a.city}
                            </p>
                          )}
                        </div>

                        {/* Right: fiscal year + status + arrow */}
                        <div className="flex items-center gap-2.5 shrink-0">
                          {latestYear && (
                            <span className="font-mono text-[10.5px] tracking-[0.5px] uppercase text-muted-foreground">
                              TK {latestYear.year}
                            </span>
                          )}
                          {latestYear && (
                            <span
                              className="font-semibold text-[11.5px]"
                              style={{ color: isOpen ? "var(--positive)" : undefined }}
                            >
                              {isOpen ? "●" : "○"}
                            </span>
                          )}
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </Card>

              {isAdmin && (
                <div className="pt-5 flex justify-start">
                  <Link href="/associations/new">
                    <Button variant="outline" size="sm">
                      <Plus className="mr-2 h-3.5 w-3.5" />
                      Lisää organisaatio
                    </Button>
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
