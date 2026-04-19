"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, Download, ChevronDown, ChevronRight, Users } from "lucide-react";

interface Decision {
  id: string;
  number: number;
  title: string;
  body: string;
  outcome: string;
}

interface Meeting {
  id: string;
  meetingType: string;
  meetingDate: string;
  location: string;
  attendees: string;
  decisions: Decision[];
}

interface Props {
  associationId: string;
  fiscalYearId: string;
  year: number;
  canEdit: boolean;
}

const MEETING_TYPE_LABELS: Record<string, string> = {
  vuosikokous: "Vuosikokous",
  hallitus: "Hallituksen kokous",
  ylimääräinen: "Ylimääräinen kokous",
};

const OUTCOME_LABELS: Record<string, string> = {
  passed: "Hyväksytty",
  rejected: "Hylätty",
  deferred: "Siirretty",
};

const OUTCOME_COLORS: Record<string, string> = {
  passed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  deferred: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
};

function today() { return new Date().toISOString().split("T")[0]; }

export function MeetingsTab({ associationId, fiscalYearId, year, canEdit }: Props) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Meeting dialog state
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [mType, setMType] = useState("hallitus");
  const [mDate, setMDate] = useState(today());
  const [mLocation, setMLocation] = useState("");
  const [mAttendees, setMAttendees] = useState("");
  const [mSaving, setMSaving] = useState(false);

  // Decision dialog state
  const [decisionDialogOpen, setDecisionDialogOpen] = useState(false);
  const [editingDecision, setEditingDecision] = useState<Decision | null>(null);
  const [dMeetingId, setDMeetingId] = useState("");
  const [dTitle, setDTitle] = useState("");
  const [dBody, setDBody] = useState("");
  const [dOutcome, setDOutcome] = useState("passed");
  const [dSaving, setDSaving] = useState(false);

  const load = useCallback(async () => {
    const data = await fetch(`/api/associations/${associationId}/fiscal-years/${fiscalYearId}/meetings`).then((r) => r.json());
    setMeetings(data);
    setLoading(false);
    // Auto-expand first meeting if only one
    if (data.length === 1) setExpanded(new Set([data[0].id]));
  }, [associationId, fiscalYearId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  function toggleExpand(id: string) {
    setExpanded((prev) => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; });
  }

  function openNewMeeting() {
    setEditingMeeting(null); setMType("hallitus"); setMDate(today()); setMLocation(""); setMAttendees("");
    setMeetingDialogOpen(true);
  }
  function openEditMeeting(m: Meeting) {
    setEditingMeeting(m); setMType(m.meetingType); setMDate(m.meetingDate.split("T")[0]);
    setMLocation(m.location); setMAttendees(m.attendees);
    setMeetingDialogOpen(true);
  }

  async function saveMeeting() {
    setMSaving(true);
    const url = editingMeeting
      ? `/api/associations/${associationId}/fiscal-years/${fiscalYearId}/meetings/${editingMeeting.id}`
      : `/api/associations/${associationId}/fiscal-years/${fiscalYearId}/meetings`;
    const res = await fetch(url, {
      method: editingMeeting ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingType: mType, meetingDate: mDate, location: mLocation, attendees: mAttendees }),
    });
    if (res.ok) {
      const saved: Meeting = await res.json();
      setMeetingDialogOpen(false);
      setExpanded((p) => new Set([...p, saved.id]));
      load();
    }
    setMSaving(false);
  }

  async function deleteMeeting(m: Meeting) {
    if (!confirm(`Poistetaanko kokous ${new Date(m.meetingDate).toLocaleDateString("fi-FI")}?`)) return;
    await fetch(`/api/associations/${associationId}/fiscal-years/${fiscalYearId}/meetings/${m.id}`, { method: "DELETE" });
    load();
  }

  function openNewDecision(meetingId: string) {
    setEditingDecision(null); setDMeetingId(meetingId); setDTitle(""); setDBody(""); setDOutcome("passed");
    setDecisionDialogOpen(true);
  }
  function openEditDecision(meetingId: string, d: Decision) {
    setEditingDecision(d); setDMeetingId(meetingId); setDTitle(d.title); setDBody(d.body); setDOutcome(d.outcome);
    setDecisionDialogOpen(true);
  }

  async function saveDecision() {
    setDSaving(true);
    const base = `/api/associations/${associationId}/fiscal-years/${fiscalYearId}/meetings/${dMeetingId}/decisions`;
    const url = editingDecision ? `${base}/${editingDecision.id}` : base;
    const res = await fetch(url, {
      method: editingDecision ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: dTitle, body: dBody, outcome: dOutcome }),
    });
    if (res.ok) { setDecisionDialogOpen(false); load(); }
    setDSaving(false);
  }

  async function deleteDecision(meetingId: string, d: Decision) {
    const base = `/api/associations/${associationId}/fiscal-years/${fiscalYearId}/meetings/${meetingId}/decisions`;
    await fetch(`${base}/${d.id}`, { method: "DELETE" });
    load();
  }

  if (loading) return <div className="py-12 text-center text-muted-foreground text-sm">Ladataan...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Kokoukset {year}</h2>
          <p className="text-sm text-muted-foreground">Hallituksen ja vuosikokouksen pöytäkirjat.</p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={openNewMeeting}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />Lisää kokous
          </Button>
        )}
      </div>

      {meetings.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p>Ei kokouksia vielä.</p>
          </CardContent>
        </Card>
      )}

      {meetings.map((m) => {
        const isOpen = expanded.has(m.id);
        const dateStr = new Date(m.meetingDate).toLocaleDateString("fi-FI");
        return (
          <Card key={m.id}>
            <CardContent className="py-0">
              {/* Meeting header row */}
              <div
                className="flex items-center gap-3 py-4 cursor-pointer select-none"
                onClick={() => toggleExpand(m.id)}
              >
                {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{dateStr}</span>
                    <Badge variant="secondary" className="text-xs">{MEETING_TYPE_LABELS[m.meetingType] ?? m.meetingType}</Badge>
                    {m.location && <span className="text-xs text-muted-foreground">{m.location}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.decisions.length} päätöstä</p>
                </div>
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-7 w-7"
                    title="Lataa pöytäkirja PDF"
                    onClick={() => window.open(`/api/associations/${associationId}/fiscal-years/${fiscalYearId}/meetings/${m.id}/pdf`, "_blank")}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  {canEdit && (
                    <>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditMeeting(m)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteMeeting(m)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Expanded decisions */}
              {isOpen && (
                <div className="border-t pb-4 pt-3 px-1">
                  {m.attendees && (
                    <p className="text-xs text-muted-foreground mb-3 px-2">
                      <span className="font-medium">Läsnä: </span>{m.attendees}
                    </p>
                  )}
                  {m.decisions.length === 0 && (
                    <p className="text-sm text-muted-foreground px-2 py-2">Ei päätöksiä vielä.</p>
                  )}
                  <div className="space-y-2">
                    {m.decisions.map((d) => (
                      <div key={d.id} className="flex items-start gap-2 px-2 py-2 rounded-md hover:bg-muted/40 group">
                        <span className="text-xs font-semibold text-muted-foreground w-8 shrink-0 pt-0.5">§{d.number}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{d.title}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${OUTCOME_COLORS[d.outcome] ?? ""}`}>
                              {OUTCOME_LABELS[d.outcome] ?? d.outcome}
                            </span>
                          </div>
                          {d.body && <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">{d.body}</p>}
                        </div>
                        {canEdit && (
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditDecision(m.id, d)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => deleteDecision(m.id, d)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {canEdit && (
                    <Button variant="ghost" size="sm" className="mt-2 ml-2 text-muted-foreground text-xs" onClick={() => openNewDecision(m.id)}>
                      <Plus className="mr-1 h-3 w-3" />Lisää päätös
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Meeting dialog */}
      <Dialog open={meetingDialogOpen} onOpenChange={setMeetingDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMeeting ? "Muokkaa kokousta" : "Uusi kokous"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Kokouksen tyyppi</Label>
                <Select value={mType} onValueChange={(v) => v && setMType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(MEETING_TYPE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Päivämäärä</Label>
                <Input type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Paikka</Label>
              <Input placeholder="Esim. Seurantalo" value={mLocation} onChange={(e) => setMLocation(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Läsnäolijat</Label>
              <Input placeholder="Esim. Puheenjohtaja, sihteeri, jäsenet..." value={mAttendees} onChange={(e) => setMAttendees(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMeetingDialogOpen(false)}>Peruuta</Button>
            <Button onClick={saveMeeting} disabled={mSaving}>{mSaving ? "Tallennetaan..." : "Tallenna"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decision dialog */}
      <Dialog open={decisionDialogOpen} onOpenChange={setDecisionDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingDecision ? `Muokkaa päätöstä §${editingDecision.number}` : "Uusi päätös"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Otsikko</Label>
              <Input placeholder="Esim. Vuoden 2025 tiemaksun hyväksyminen" value={dTitle} onChange={(e) => setDTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Päätöksen teksti</Label>
              <textarea
                className="w-full min-h-24 text-sm bg-transparent border rounded-md p-2 resize-y outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                placeholder="Vapaamuotoinen päätösteksti..."
                value={dBody}
                onChange={(e) => setDBody(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tulos</Label>
              <Select value={dOutcome} onValueChange={(v) => v && setDOutcome(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(OUTCOME_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecisionDialogOpen(false)}>Peruuta</Button>
            <Button onClick={saveDecision} disabled={dSaving || !dTitle.trim()}>{dSaving ? "Tallennetaan..." : "Tallenna"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
