"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, GripVertical, Save } from "lucide-react";

interface Section {
  id: string;
  title: string;
  body: string;
}

const DEFAULT_SECTIONS: Record<string, Omit<Section, "id">[]> = {
  tiekunta: [
    { title: "Yleistä", body: "" },
    { title: "Tienhoitotyöt", body: "" },
    { title: "Taloudellinen tilanne", body: "" },
    { title: "Kokoukset ja päätökset", body: "" },
  ],
  metsastysseura: [
    { title: "Yleistä", body: "" },
    { title: "Metsästystoiminta", body: "" },
    { title: "Riistanhoito", body: "" },
    { title: "Taloudellinen tilanne", body: "" },
    { title: "Kokoukset ja päätökset", body: "" },
  ],
  taloyhtio: [
    { title: "Yleistä", body: "" },
    { title: "Kiinteistön hallinto", body: "" },
    { title: "Rakennukset ja piha-alueet", body: "" },
    { title: "Suoritetut korjaukset", body: "Tilikauden aikana ei suoritettu merkittäviä korjauksia." },
    { title: "Tulevat korjaukset", body: "" },
    { title: "Lainakanta", body: "Yhtiöllä ei ole lainoja." },
    { title: "Vakuutukset", body: "" },
    { title: "Yhtiökokous", body: "" },
  ],
  toiminimi: [
    { title: "Yleistä", body: "" },
    { title: "Suoritetut työt", body: "" },
    { title: "Taloudellinen tilanne", body: "" },
  ],
};

function uid() { return Math.random().toString(36).slice(2); }

interface Props {
  associationId: string;
  fiscalYearId: string;
  year: number;
  orgType?: string;
  initialSections: Section[];
  canEdit: boolean;
}

export function ActivityReportTab({ associationId, fiscalYearId, year, orgType = "tiekunta", initialSections, canEdit }: Props) {
  const defaultSections = DEFAULT_SECTIONS[orgType] ?? DEFAULT_SECTIONS.tiekunta;
  const [sections, setSections] = useState<Section[]>(() =>
    initialSections.length > 0
      ? initialSections
      : defaultSections.map((s) => ({ ...s, id: uid() }))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Track unsaved changes
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setDirty(true); }, [sections]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setDirty(false); }, []); // reset on mount

  const save = useCallback(async () => {
    setSaving(true);
    await fetch(`/api/associations/${associationId}/fiscal-years/${fiscalYearId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportSections: sections }),
    });
    setSaving(false);
    setSaved(true);
    setDirty(false);
    setTimeout(() => setSaved(false), 2500);
  }, [associationId, fiscalYearId, sections]);

  function updateSection(id: string, field: keyof Section, value: string) {
    setSections((prev) => prev.map((s) => s.id === id ? { ...s, [field]: value } : s));
  }

  function addSection() {
    setSections((prev) => [...prev, { id: uid(), title: "Uusi osio", body: "" }]);
  }

  function removeSection(id: string) {
    setSections((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Toimintakertomus {year}</h2>
          <p className="text-sm text-muted-foreground">Vapaamuotoinen vuosikertomus. Tallentuu tähän tilikauden yhteyteen.</p>
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
              {canEdit && (
                <GripVertical className="h-4 w-4 mt-2 text-muted-foreground shrink-0" />
              )}
              <div className="flex-1 space-y-2">
                <input
                  className="w-full text-base font-semibold bg-transparent border-none outline-none focus:ring-0 placeholder:text-muted-foreground/50"
                  value={section.title}
                  onChange={(e) => updateSection(section.id, "title", e.target.value)}
                  placeholder="Otsikko"
                  disabled={!canEdit}
                />
                <textarea
                  className="w-full min-h-24 text-sm bg-transparent border rounded-md p-2 resize-y outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50 disabled:opacity-60"
                  value={section.body}
                  onChange={(e) => updateSection(section.id, "body", e.target.value)}
                  placeholder="Kirjoita tähän…"
                  disabled={!canEdit}
                />
              </div>
              {canEdit && (
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
          Lisää osio
        </Button>
      )}

      {!canEdit && sections.every((s) => !s.body.trim()) && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Ei toimintakertomusta.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
