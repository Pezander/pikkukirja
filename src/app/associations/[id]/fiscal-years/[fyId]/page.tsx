"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Plus, FileText, Download, Lock, ArrowRight, Table2 } from "lucide-react";
import { JournalTab } from "@/components/fiscal-year/JournalTab";
import { LedgerTab } from "@/components/fiscal-year/LedgerTab";
import { IncomeStatementTab } from "@/components/fiscal-year/IncomeStatementTab";
import { BalanceSheetTab } from "@/components/fiscal-year/BalanceSheetTab";
import { ActivityReportTab } from "@/components/fiscal-year/ActivityReportTab";
import { VoucherDialog } from "@/components/fiscal-year/VoucherDialog";
import { BudgetTab } from "@/components/fiscal-year/BudgetTab";
import { TrialBalanceTab } from "@/components/fiscal-year/TrialBalanceTab";
import { MeetingsTab } from "@/components/fiscal-year/MeetingsTab";
import { VatTab } from "@/components/fiscal-year/VatTab";
import { LiitetiedotTab } from "@/components/fiscal-year/LiitetiedotTab";

export interface Account {
  id: string;
  number: string;
  name: string;
  type: string;
}

export interface VoucherLine {
  id: string;
  debit: number;
  credit: number;
  note: string;
  account: Account;
  vatRate: number;
  vatAmount: number;
}

export interface VoucherAttachment {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface Voucher {
  id: string;
  number: number;
  date: string;
  description: string;
  lines: VoucherLine[];
  attachments: VoucherAttachment[];
}

export interface FiscalYearData {
  id: string;
  year: number;
  status: string;
  reportSections: string; // JSON string
  association: { id: string; name: string; type: string };
  vouchers: Voucher[];
}

interface FiscalYearStub {
  id: string;
  year: number;
  status: string;
}

export default function FiscalYearPage() {
  const { id, fyId } = useParams<{ id: string; fyId: string }>();
  const router = useRouter();
  const [fy, setFy] = useState<FiscalYearData | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [historicVouchers, setHistoricVouchers] = useState<{ year: number; vouchers: Voucher[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [copyFromVoucher, setCopyFromVoucher] = useState<Voucher | null>(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [rollForwardDialogOpen, setRollForwardDialogOpen] = useState(false);
  const [rollingForward, setRollingForward] = useState(false);
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    const [fyRes, accRes, allFyRes] = await Promise.all([
      fetch(`/api/associations/${id}/fiscal-years/${fyId}`),
      fetch(`/api/associations/${id}/accounts`),
      fetch(`/api/associations/${id}/fiscal-years`),
    ]);
    const fyData: FiscalYearData = await fyRes.json();
    setFy(fyData);
    setAccounts(await accRes.json());

    // Fetch up to 4 prior fiscal years for multi-year comparison
    const allFys: FiscalYearStub[] = await allFyRes.json();
    const priorFys = allFys
      .filter((f) => f.year < fyData.year)
      .sort((a, b) => b.year - a.year)
      .slice(0, 4);
    const priorResults = await Promise.all(
      priorFys.map((f) =>
        fetch(`/api/associations/${id}/fiscal-years/${f.id}`).then((r) => r.json() as Promise<FiscalYearData>)
      )
    );
    setHistoricVouchers(priorResults.map((d) => ({ year: d.year, vouchers: d.vouchers })));

    setLoading(false);
  }, [id, fyId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  function openNewVoucher() {
    setEditingVoucher(null);
    setCopyFromVoucher(null);
    setVoucherOpen(true);
  }

  function openEditVoucher(v: Voucher) {
    setEditingVoucher(v);
    setCopyFromVoucher(null);
    setVoucherOpen(true);
  }

  function openCopyVoucher(v: Voucher) {
    setEditingVoucher(null);
    setCopyFromVoucher(v);
    setVoucherOpen(true);
  }

  async function handleDeleteVoucher(v: Voucher) {
    await fetch(`/api/associations/${id}/fiscal-years/${fyId}/vouchers/${v.id}`, { method: "DELETE" });
    load();
  }

  async function handleCloseYear() {
    setClosing(true);
    setActionError("");
    const res = await fetch(`/api/associations/${id}/fiscal-years/${fyId}/close`, { method: "POST" });
    if (res.ok) {
      setCloseDialogOpen(false);
      load();
    } else {
      const err = await res.json();
      setActionError(err.error ?? "Sulkeminen epäonnistui.");
    }
    setClosing(false);
  }

  async function handleRollForward() {
    setRollingForward(true);
    setActionError("");
    setRollForwardDialogOpen(false);
    const res = await fetch(`/api/associations/${id}/fiscal-years/${fyId}/roll-forward`, { method: "POST" });
    if (res.ok) {
      const newFy = await res.json();
      router.push(`/associations/${id}/fiscal-years/${newFy.id}`);
    } else {
      const err = await res.json();
      setActionError(err.error ?? "Siirtyminen epäonnistui.");
    }
    setRollingForward(false);
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Ladataan...</div>;
  }
  if (!fy) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Tilikautta ei löydy.</div>;
  }

  const isOpen = fy.status === "open";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Link
          href={`/associations/${id}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          {fy.association.name}
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Tilikausi {fy.year}</h1>
            <Badge variant={isOpen ? "default" : "secondary"}>
              {isOpen ? "Auki" : "Suljettu"}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => window.open(`/api/associations/${id}/fiscal-years/${fyId}/journal`, "_blank")}
            >
              <Download className="mr-2 h-4 w-4" />
              Päiväkirja PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open(`/api/associations/${id}/fiscal-years/${fyId}/reports`, "_blank")}
            >
              <Download className="mr-2 h-4 w-4" />
              Tilinpäätös PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open(`/api/associations/${id}/fiscal-years/${fyId}/annual-report`, "_blank")}
            >
              <Download className="mr-2 h-4 w-4" />
              Vuosikokous PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open(`/api/associations/${id}/fiscal-years/${fyId}/export/csv`, "_blank")}
            >
              <Table2 className="mr-2 h-4 w-4" />
              Vie CSV
            </Button>
            <Link href={`/associations/${id}/fiscal-years/${fyId}/invoices`}>
              <Button variant="outline">
                <FileText className="mr-2 h-4 w-4" />
                Laskut
              </Button>
            </Link>
            {isOpen && (
              <>
                <Button onClick={openNewVoucher}>
                  <Plus className="mr-2 h-4 w-4" />
                  Uusi tosite
                </Button>
                <Button variant="outline" onClick={() => { setActionError(""); setCloseDialogOpen(true); }}>
                  <Lock className="mr-2 h-4 w-4" />
                  Sulje tilikausi
                </Button>
              </>
            )}
            {!isOpen && (
              <Button onClick={() => { setActionError(""); setRollForwardDialogOpen(true); }} disabled={rollingForward}>
                <ArrowRight className="mr-2 h-4 w-4" />
                {rollingForward ? "Luodaan..." : `Avaa tilikausi ${fy.year + 1}`}
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="journal">
          <TabsList className="mb-6">
            <TabsTrigger value="journal">Päiväkirja</TabsTrigger>
            <TabsTrigger value="ledger">Pääkirja</TabsTrigger>
            <TabsTrigger value="income">Tuloslaskelma</TabsTrigger>
            <TabsTrigger value="balance">Tase</TabsTrigger>
            <TabsTrigger value="trial-balance">Koetase</TabsTrigger>
            <TabsTrigger value="budget">Budjetti</TabsTrigger>
            <TabsTrigger value="report">Toimintakertomus</TabsTrigger>
            <TabsTrigger value="liitetiedot">Liitetiedot</TabsTrigger>
            <TabsTrigger value="meetings">Kokoukset</TabsTrigger>
            {fy.association.type === "toiminimi" && (
              <TabsTrigger value="vat">ALV</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="journal">
            <JournalTab
              vouchers={fy.vouchers}
              canEdit={isOpen}
              onEdit={openEditVoucher}
              onDelete={handleDeleteVoucher}
              onCopy={openCopyVoucher}
            />
          </TabsContent>

          <TabsContent value="ledger">
            <LedgerTab vouchers={fy.vouchers} accounts={accounts} associationId={id} fiscalYearId={fyId} />
          </TabsContent>

          <TabsContent value="income">
            <IncomeStatementTab vouchers={fy.vouchers} accounts={accounts} year={fy.year} orgType={fy.association.type ?? "tiekunta"} historicVouchers={historicVouchers} />
          </TabsContent>

          <TabsContent value="balance">
            <BalanceSheetTab vouchers={fy.vouchers} accounts={accounts} year={fy.year} />
          </TabsContent>

          <TabsContent value="trial-balance">
            <TrialBalanceTab
              vouchers={fy.vouchers}
              accounts={accounts}
              year={fy.year}
              associationId={id}
              fiscalYearId={fyId}
            />
          </TabsContent>

          <TabsContent value="budget">
            <BudgetTab
              associationId={id}
              fiscalYearId={fyId}
              vouchers={fy.vouchers}
              year={fy.year}
              canEdit={isOpen}
            />
          </TabsContent>

          <TabsContent value="report">
            <ActivityReportTab
              associationId={id}
              fiscalYearId={fyId}
              year={fy.year}
              orgType={fy.association.type ?? "tiekunta"}
              initialSections={JSON.parse(fy.reportSections || "[]")}
              canEdit={isOpen}
            />
          </TabsContent>

          <TabsContent value="liitetiedot">
            <LiitetiedotTab
              associationId={id}
              fiscalYearId={fyId}
              year={fy.year}
              canEdit={isOpen}
            />
          </TabsContent>

          <TabsContent value="meetings">
            <MeetingsTab
              associationId={id}
              fiscalYearId={fyId}
              year={fy.year}
              canEdit={isOpen}
            />
          </TabsContent>

          {fy.association.type === "toiminimi" && (
            <TabsContent value="vat">
              <VatTab associationId={id} fiscalYearId={fyId} year={fy.year} />
            </TabsContent>
          )}
        </Tabs>
      </div>

      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sulje tilikausi {fy?.year}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <p>Tämä toiminto:</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Luo tilinpäätöstositteen, joka nollaa tulo- ja menotileiltä ja siirtää tuloksen tilille 240</li>
              <li>Merkitsee tilikauden suljetuksi — uusia tositteita ei voi enää lisätä</li>
            </ul>
            <p className="text-muted-foreground">
              Sulkemisen jälkeen voit avata tilikauden {(fy?.year ?? 0) + 1}, jolloin tasetilit siirtyvät avaustaseeksi.
            </p>
            {actionError && <p className="text-sm text-destructive">{actionError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>Peruuta</Button>
            <Button onClick={handleCloseYear} disabled={closing}>
              {closing ? "Suljetaan..." : "Vahvista sulkeminen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rollForwardDialogOpen} onOpenChange={setRollForwardDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Avaa tilikausi {(fy?.year ?? 0) + 1}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <p>Tämä toiminto luo uuden tilikauden {(fy?.year ?? 0) + 1} ja siirtää tasetilit avaavana tositteena.</p>
            <p className="text-muted-foreground">Tilikausi {fy?.year} pysyy suljettuna — sitä ei voi enää muokata.</p>
            {actionError && <p className="text-sm text-destructive">{actionError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRollForwardDialogOpen(false)}>Peruuta</Button>
            <Button onClick={handleRollForward} disabled={rollingForward}>
              {rollingForward ? "Luodaan..." : `Vahvista — Avaa ${(fy?.year ?? 0) + 1}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VoucherDialog
        open={voucherOpen}
        onOpenChange={setVoucherOpen}
        accounts={accounts}
        associationId={id}
        fiscalYearId={fyId}
        editingVoucher={editingVoucher}
        copyFrom={copyFromVoucher}
        orgType={fy.association.type}
        onSaved={() => { load(); setVoucherOpen(false); }}
      />
    </div>
  );
}
