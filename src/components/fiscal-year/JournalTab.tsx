"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, Copy, Paperclip, Search } from "lucide-react";
import type { Voucher } from "@/app/associations/[id]/fiscal-years/[fyId]/page";

interface Props {
  vouchers: Voucher[];
  canEdit: boolean;
  onEdit: (v: Voucher) => void;
  onDelete: (v: Voucher) => void;
  onCopy?: (v: Voucher) => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fi-FI");
}

function formatEur(n: number) {
  return n.toFixed(2).replace(".", ",") + " €";
}

export function JournalTab({ vouchers, canEdit, onEdit, onDelete, onCopy }: Props) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? vouchers.filter((v) => {
        const q = query.toLowerCase();
        return (
          v.description.toLowerCase().includes(q) ||
          String(v.number).includes(q) ||
          v.lines.some(
            (l) =>
              l.account.number.includes(q) ||
              l.account.name.toLowerCase().includes(q) ||
              l.note.toLowerCase().includes(q)
          )
        );
      })
    : vouchers;

  if (vouchers.length === 0) {
    return (
      <Card>
        <div className="py-12 text-center text-muted-foreground px-4">
          Ei tositteita. Lisää ensimmäinen tosite &ldquo;Uusi tosite&rdquo;-napilla.
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Hae kuvauksella, tilinumerolla tai tilin nimellä…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 && (
        <div className="py-8 text-center text-muted-foreground text-sm">
          Ei hakutuloksia haulle &ldquo;{query}&rdquo;
        </div>
      )}

      {filtered.map((v) => {
        const totalDebit = v.lines.reduce((s, l) => s + l.debit, 0);
        return (
          <Card key={v.id} className="overflow-hidden">
            <div className="flex items-center gap-4 px-4 py-3 bg-muted/40 border-b">
              <span className="text-sm font-mono text-muted-foreground w-8">#{v.number}</span>
              <span className="text-sm font-medium flex-1">{v.description}</span>
              {v.attachments.length > 0 && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground" title={`${v.attachments.length} liite${v.attachments.length > 1 ? "ttä" : ""}`}>
                  <Paperclip className="h-3 w-3" />
                  {v.attachments.length}
                </span>
              )}
              <span className="text-sm text-muted-foreground">{formatDate(v.date)}</span>
              <span className="text-sm font-medium tabular-nums">{formatEur(totalDebit)}</span>
              <div className="flex gap-1">
                {onCopy && (
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    title="Kopioi tosite"
                    onClick={() => onCopy(v)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                )}
                {canEdit && (
                  <>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => onEdit(v)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Poistetaanko tosite #${v.number} "${v.description}"?`)) onDelete(v);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {v.lines.map((line) => (
                  <tr key={line.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2 font-mono text-muted-foreground w-16">
                      {line.account.number}
                    </td>
                    <td className="py-2 text-foreground">
                      {line.account.name}
                      {line.note && (
                        <span className="ml-2 text-xs text-muted-foreground">{line.note}</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums w-28">
                      {line.debit > 0 ? formatEur(line.debit) : ""}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums w-28 text-muted-foreground">
                      {line.credit > 0 ? formatEur(line.credit) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        );
      })}
    </div>
  );
}
