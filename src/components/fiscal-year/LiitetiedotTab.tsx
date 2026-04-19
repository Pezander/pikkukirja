"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Save, Lock } from "lucide-react";

interface Section {
  id: string;
  title: string;
  body: string;
  locked?: boolean;
}

function uid() { return Math.random().toString(36).slice(2); }

interface Props {
  associationId: string;
  fiscalYearId: string;
  year: number;
  canEdit: boolean;
}

export function LiitetiedotTab({ associationId, fiscalYearId, year, canEdit }: Props) {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/associations/${associationId}/fiscal-years/${fiscalYearId}/liitetiedot`);
    if (res.ok) setSections(await res.json());
    setLoading(false);
  }, [associationId, fiscalYearId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setDirty(true); }, [sections]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setDirty(false); }, []); // reset on mount

  const save = useCallback(async () => {
    setSaving(true);
    await fetch(`/api/associations/${associationId}/fiscal-years/${fiscalYearId}/liitetiedot`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sections),
    });
    setSaving(false);
    setSaved(true);
    setDirty(false);
    setTimeout(() => setSaved(false), 2500);
  }, [associationId, fiscalYearId, sections]);

  function updateSection(id: string, field: "title" | "body", value: string) {
    setSections((prev) => prev.map((s) => s.id === id ? { ...s, [field]: value } : s));
  }

  function addSection() {
    setSections((prev) => [...prev, { id: uid(), title: "Uusi liitetieto", body: "" }]);
  }

  function removeSection(id: string) {
    setSections((prev) => prev.filter((s) => s.id !== id));
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Ladataan…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Liitetiedot {year}</h2>
          <p className="text-sm text-muted-foreground">
            Kirjanpitolain edellyttämät liitetiedot tilinpäätökseen. Lukitut osiot ovat pakollisia.
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            {saved && <span className="text-sm text-green-600 dark:text-green-400">✓ Tallennettu</span>}
            <Button size="sm" onClick={save} disabled={saving || !dirty}>
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {saving ? "Tallennetaan..." : "Tallenna"}
            </Button>
          </div>
        )}
      </div>

      {sections.map((section) => (
        <Card key={section.id}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-1.5">
                  {section.locked && (
                    <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                  )}
                  <input
                    className="flex-1 text-base font-semibold bg-transparent border-none outline-none focus:ring-0 placeholder:text-muted-foreground/50 disabled:opacity-70"
                    value={section.title}
                    onChange={(e) => updateSection(section.id, "title", e.target.value)}
                    placeholder="Otsikko"
                    disabled={!canEdit || !!section.locked}
                  />
                </div>
                <textarea
                  className="w-full min-h-24 text-sm bg-transparent border rounded-md p-2 resize-y outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50 disabled:opacity-60"
                  value={section.body}
                  onChange={(e) => updateSection(section.id, "body", e.target.value)}
                  placeholder="Kirjoita tähän…"
                  disabled={!canEdit}
                />
              </div>
              {canEdit && !section.locked && (
                <Button
                  variant="ghost" size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive mt-1 shrink-0"
                  onClick={() => removeSection(section.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {canEdit && (
        <Button variant="outline" size="sm" onClick={addSection}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Lisää liitetieto
        </Button>
      )}

      {!canEdit && sections.every((s) => !s.body.trim()) && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Ei liitetietoja.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
