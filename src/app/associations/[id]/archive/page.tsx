"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Upload, Search, FileText, Image, Link2, Link2Off, Trash2, ExternalLink, X } from "lucide-react";

interface VoucherStub {
  id: string;
  number: number;
  date: string;
  description: string;
  fiscalYear: { id: string; year: number };
}

interface Attachment {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  note: string;
  createdAt: string;
  voucherId: string | null;
  voucher: VoucherStub | null;
}

interface VoucherOption {
  id: string;
  number: number;
  date: string;
  description: string;
  fiscalYear: { id: string; year: number };
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  // eslint-disable-next-line jsx-a11y/alt-text
  if (mimeType.startsWith("image/")) return <Image className="h-5 w-5 text-blue-500" />;
  return <FileText className="h-5 w-5 text-red-500" />;
}

export default function ArchivePage() {
  const { id } = useParams<{ id: string }>();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [search, setSearch] = useState("");
  const [showUnmatched, setShowUnmatched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assocName, setAssocName] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Match dialog
  const [matchTarget, setMatchTarget] = useState<Attachment | null>(null);
  const [voucherOptions, setVoucherOptions] = useState<VoucherOption[]>([]);
  const [voucherSearch, setVoucherSearch] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (showUnmatched) params.set("unmatched", "true");
    if (search) params.set("search", search);
    const [atts, assoc] = await Promise.all([
      fetch(`/api/associations/${id}/attachments?${params}`).then((r) => r.json()),
      fetch(`/api/associations/${id}`).then((r) => r.json()),
    ]);
    setAttachments(atts);
    setAssocName(assoc.name ?? "");
    setLoading(false);
  }, [id, search, showUnmatched]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  // Load vouchers for match dialog
  useEffect(() => {
    if (!matchTarget) return;
    fetch(`/api/associations/${id}/fiscal-years`).then((r) => r.json()).then(async (fys: { id: string; year: number }[]) => {
      const all: VoucherOption[] = [];
      for (const fy of fys) {
        const fyData = await fetch(`/api/associations/${id}/fiscal-years/${fy.id}`).then((r) => r.json());
        for (const v of fyData.vouchers ?? []) {
          all.push({ ...v, fiscalYear: { id: fy.id, year: fy.year } });
        }
      }
      setVoucherOptions(all);
    });
  }, [matchTarget, id]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    await fetch(`/api/associations/${id}/attachments`, { method: "POST", body: fd });
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploading(false);
    load();
  }

  async function handleUnlink(att: Attachment) {
    await fetch(`/api/associations/${id}/attachments/${att.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voucherId: null }),
    });
    load();
  }

  async function handleMatch(voucherId: string) {
    if (!matchTarget) return;
    await fetch(`/api/associations/${id}/attachments/${matchTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voucherId }),
    });
    setMatchTarget(null);
    load();
  }

  async function handleDelete(att: Attachment) {
    if (!confirm(`Poistetaanko liite "${att.originalName}"?`)) return;
    await fetch(`/api/associations/${id}/attachments/${att.id}`, { method: "DELETE" });
    load();
  }

  const filteredVouchers = voucherOptions.filter((v) => {
    if (!voucherSearch) return true;
    const q = voucherSearch.toLowerCase();
    return (
      v.description.toLowerCase().includes(q) ||
      String(v.number).includes(q) ||
      String(v.fiscalYear.year).includes(q)
    );
  });

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Ladataan...</div>;

  return (
    <>
      <div className="max-w-5xl mx-auto px-4 py-8">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Liitearkisto</h1>
            <p className="text-sm text-muted-foreground mt-1">Kaikki tositteiden liitteet. Lataa kuitti ensin ja liitä tositteeseen myöhemmin.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? "Ladataan..." : "Lataa liite"}
            </Button>
            <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp" onChange={handleUpload} />
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Hae tiedostonimellä..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant={showUnmatched ? "default" : "outline"}
            size="sm"
            onClick={() => setShowUnmatched((p) => !p)}
          >
            <Link2Off className="mr-1.5 h-3.5 w-3.5" />
            Vain liittämättömät
          </Button>
        </div>

        {attachments.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p>Ei liitteitä{showUnmatched ? " ilman tositetta" : ""}.</p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          {attachments.map((att) => (
            <Card key={att.id}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <FileIcon mimeType={att.mimeType} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{att.originalName}</span>
                      <span className="text-xs text-muted-foreground">{formatBytes(att.size)}</span>
                      <span className="text-xs text-muted-foreground">{new Date(att.createdAt).toLocaleDateString("fi-FI")}</span>
                    </div>
                    {att.voucher ? (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Link2 className="h-3 w-3 text-green-600 dark:text-green-400 shrink-0" />
                        <Link
                          href={`/associations/${id}/fiscal-years/${att.voucher.fiscalYear.id}`}
                          className="text-xs text-green-700 dark:text-green-400 hover:underline"
                        >
                          Tosite #{att.voucher.number} · {att.voucher.description} ({att.voucher.fiscalYear.year})
                        </Link>
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-xs mt-0.5">Ei liitetty tositteeseen</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={`/api/associations/${id}/attachments/${att.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center h-8 w-8 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted"
                      title="Avaa"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    {att.voucher ? (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Poista liitäntä tositteeseen" onClick={() => handleUnlink(att)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setMatchTarget(att); setVoucherSearch(""); }}>
                        <Link2 className="mr-1 h-3.5 w-3.5" />Liitä tositteeseen
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(att)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Match to voucher dialog */}
      <Dialog open={!!matchTarget} onOpenChange={(o) => !o && setMatchTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Liitä tositteeseen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground truncate">{matchTarget?.originalName}</p>
            <Input
              placeholder="Hae tositetta numerolla tai kuvauksella..."
              value={voucherSearch}
              onChange={(e) => setVoucherSearch(e.target.value)}
            />
            <div className="max-h-72 overflow-y-auto space-y-1">
              {filteredVouchers.slice(0, 50).map((v) => (
                <button
                  key={v.id}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-muted text-sm transition-colors"
                  onClick={() => handleMatch(v.id)}
                >
                  <span className="font-mono text-xs text-muted-foreground mr-2">#{v.number}</span>
                  <span className="font-medium">{v.description}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {new Date(v.date).toLocaleDateString("fi-FI")} · {v.fiscalYear.year}
                  </span>
                </button>
              ))}
              {filteredVouchers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Ei hakutuloksia.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMatchTarget(null)}>Peruuta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
