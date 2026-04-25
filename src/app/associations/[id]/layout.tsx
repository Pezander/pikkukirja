"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { TopBar } from "@/components/TopBar";

interface Summary {
  openFiscalYear: { id: string; year: number } | null;
}

export default function AssociationLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const { data: session } = useSession();
  const [openFyId, setOpenFyId] = useState<string | null>(null);
  const isAdmin = (session?.user as { role?: string })?.role === "admin";

  useEffect(() => {
    if (!id) return;
    fetch(`/api/associations/${id}/summary`)
      .then((r) => r.json())
      .then((data: Summary) => setOpenFyId(data.openFiscalYear?.id ?? null))
      .catch(() => null);
  }, [id]);

  // Derive fiscal year ID from URL when navigating within a fiscal year,
  // so nav items resolve even before the summary fetch completes.
  const fyIdFromPath = (() => {
    const m = pathname.match(/\/fiscal-years\/([^/]+)/);
    return m ? m[1] : null;
  })();

  const effectiveFyId = fyIdFromPath ?? openFyId;

  const navItems = [
    { label: "Yleiskatsaus", href: `/associations/${id}` },
    ...(effectiveFyId
      ? [
          { label: "Kirjanpito", href: `/associations/${id}/fiscal-years/${effectiveFyId}` },
          { label: "Laskut", href: `/associations/${id}/fiscal-years/${effectiveFyId}/invoices` },
        ]
      : []),
    { label: "Jäsenet", href: `/associations/${id}/members` },
    { label: "Tiliotteet", href: `/associations/${id}/bank-statements` },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopBar
        email={session?.user?.email}
        name={session?.user?.name}
        isAdmin={isAdmin}
        navItems={navItems}
      />
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
