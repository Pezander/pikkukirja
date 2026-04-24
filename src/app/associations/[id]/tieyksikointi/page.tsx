"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Plus, Pencil, Trash2, Route, ChevronDown, ChevronRight,
  Play, CheckCircle2,
} from "lucide-react";

// ─── Domain types ─────────────────────────────────────────────────────────────

interface Allocation {
  id: string;
  trafficType: string;
  subType: string;
  areaHa: number;
  correctionFactor: number;
  cropCorrection: string;
  muuTripsPerYear: number;
  muuVehicleWeightT: number;
  muuCargoWeightT: number;
  notes: string;
}

interface RoadProperty {
  id: string;
  kiinteistoId: string;
  name: string;
  distanceKm: number;
  notes: string;
  allocations: Allocation[];
}

interface RoadMember {
  id: string;
  name: string;
  roadProperties: RoadProperty[];
}

interface CalcSummary {
  id: string;
  name: string;
  isActive: boolean;
  pricePerUnit: number;
  adminFee: number;
  notes: string;
  createdAt: string;
  _count: { results: number };
}

interface CalcResult {
  id: string;
  memberName: string;
  totalTkm: number;
  sharePercent: number;
  breakdown: string;
}

interface CalcDetail extends CalcSummary {
  results: CalcResult[];
}

// ─── Label helpers ────────────────────────────────────────────────────────────

const TRAFFIC_LABELS: Record<string, string> = {
  asunto: "Asunto",
  vapaa_ajan_asunto: "Vapaa-ajan asunto",
  metsa: "Metsä",
  pelto: "Pelto",
  muu: "Muu liikenne",
};

const SUBTYPE_LABELS: Record<string, Record<string, string>> = {
  vapaa_ajan_asunto: { ympärivuotinen: "Ympärivuotinen", kesämökki: "Kesämökki", lomamökki: "Lomamökki" },
  metsa: { "1": "Alue 1", "2": "Alue 2", "3": "Alue 3", "4": "Alue 4", "5": "Alue 5" },
  pelto: { kasvinviljely: "Kasvinviljely", nautakarja: "Nautakarja" },
};

const CROP_LABELS: Record<string, string> = {
  none: "Ei korjausta",
  sika_siipikarja: "Sika/siipikarja (+40 %)",
  sokerijuurikas: "Sokerijuurikas/peruna (+80 %)",
  kesanto: "Kesanto (−70 %)",
};

function allocLabel(a: Allocation): string {
  const base = TRAFFIC_LABELS[a.trafficType] ?? a.trafficType;
  const sub = SUBTYPE_LABELS[a.trafficType]?.[a.subType];
  return sub ? `${base} · ${sub}` : base;
}

function fmt2(n: number) {
  return n.toFixed(2).replace(".", ",");
}

// ─── Empty form defaults ──────────────────────────────────────────────────────

const EMPTY_PROP = { kiinteistoId: "", name: "", distanceKm: "", notes: "" };

const EMPTY_ALLOC = {
  trafficType: "asunto",
  subType: "",
  areaHa: "",
  correctionFactor: "1",
  cropCorrection: "none",
  muuTripsPerYear: "",
  muuVehicleWeightT: "",
  muuCargoWeightT: "",
  notes: "",
};

const EMPTY_CALC = { name: "", pricePerUnit: "", adminFee: "", notes: "" };

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TieyksiköintiPage() {
  const { id } = useParams<{ id: string }>();
  const [assocName, setAssocName] = useState("");
  const [loading, setLoading] = useState(true);

  // Members + properties
  const [members, setMembers] = useState<RoadMember[]>([]);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  // Property dialog
  const [propOpen, setPropOpen] = useState(false);
  const [propMemberId, setPropMemberId] = useState("");
  const [editingProp, setEditingProp] = useState<RoadProperty | null>(null);
  const [propForm, setPropForm] = useState(EMPTY_PROP);
  const [propSaving, setPropSaving] = useState(false);
  const [propError, setPropError] = useState("");

  // Allocation dialog
  const [allocOpen, setAllocOpen] = useState(false);
  const [allocPropertyId, setAllocPropertyId] = useState("");
  const [editingAlloc, setEditingAlloc] = useState<Allocation | null>(null);
  const [allocForm, setAllocForm] = useState(EMPTY_ALLOC);
  const [allocSaving, setAllocSaving] = useState(false);
  const [allocError, setAllocError] = useState("");

  // Calculations
  const [calcs, setCalcs] = useState<CalcSummary[]>([]);
  const [expandedCalc, setExpandedCalc] = useState<string | null>(null);
  const [calcDetail, setCalcDetail] = useState<Record<string, CalcDetail>>({});

  // New calculation dialog
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcForm, setCalcForm] = useState(EMPTY_CALC);
  const [calcRunning, setCalcRunning] = useState(false);
  const [calcError, setCalcError] = useState("");

  // ─── Data loading ───────────────────────────────────────────────────────────

  const loadMembers = useCallback(async () => {
    const res = await fetch(`/api/associations/${id}/road-units/members`);
    setMembers(await res.json());
  }, [id]);

  const loadCalcs = useCallback(async () => {
    const res = await fetch(`/api/associations/${id}/road-units/calculations`);
    setCalcs(await res.json());
  }, [id]);

  const loadAssoc = useCallback(async () => {
    const res = await fetch(`/api/associations/${id}`);
    const a = await res.json();
    setAssocName(a.name);
  }, [id]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadAssoc(), loadMembers(), loadCalcs()]);
    setLoading(false);
  }, [loadAssoc, loadMembers, loadCalcs]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function loadCalcDetail(calcId: string) {
    if (calcDetail[calcId]) return;
    const res = await fetch(`/api/associations/${id}/road-units/calculations/${calcId}`);
    const data = await res.json();
    setCalcDetail((prev) => ({ ...prev, [calcId]: data }));
  }

  // ─── Property CRUD ──────────────────────────────────────────────────────────

  function openNewProp(memberId: string) {
    setPropMemberId(memberId);
    setEditingProp(null);
    setPropForm(EMPTY_PROP);
    setPropError("");
    setPropOpen(true);
  }

  function openEditProp(memberId: string, prop: RoadProperty) {
    setPropMemberId(memberId);
    setEditingProp(prop);
    setPropForm({
      kiinteistoId: prop.kiinteistoId,
      name: prop.name,
      distanceKm: String(prop.distanceKm),
      notes: prop.notes,
    });
    setPropError("");
    setPropOpen(true);
  }

  async function saveProp() {
    if (!propForm.name.trim()) { setPropError("Nimi on pakollinen."); return; }
    const km = parseFloat(propForm.distanceKm);
    if (isNaN(km) || km < 0) { setPropError("Etäisyys on pakollinen."); return; }

    setPropSaving(true);
    setPropError("");

    const url = editingProp
      ? `/api/associations/${id}/road-units/members/${propMemberId}/properties/${editingProp.id}`
      : `/api/associations/${id}/road-units/members/${propMemberId}/properties`;
    const method = editingProp ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...propForm, distanceKm: km }),
    });

    if (res.ok) {
      await loadMembers();
      setPropOpen(false);
    } else {
      const err = await res.json();
      setPropError(err.error ?? "Tallennus epäonnistui.");
    }
    setPropSaving(false);
  }

  async function deleteProp(memberId: string, prop: RoadProperty) {
    if (!confirm(`Poista kiinteistö "${prop.name}"? Kaikki liikennelajit poistetaan myös.`)) return;
    await fetch(`/api/associations/${id}/road-units/members/${memberId}/properties/${prop.id}`, {
      method: "DELETE",
    });
    await loadMembers();
  }

  // ─── Allocation CRUD ────────────────────────────────────────────────────────

  function openNewAlloc(propertyId: string) {
    setAllocPropertyId(propertyId);
    setEditingAlloc(null);
    setAllocForm(EMPTY_ALLOC);
    setAllocError("");
    setAllocOpen(true);
  }

  function openEditAlloc(propertyId: string, alloc: Allocation) {
    setAllocPropertyId(propertyId);
    setEditingAlloc(alloc);
    setAllocForm({
      trafficType: alloc.trafficType,
      subType: alloc.subType,
      areaHa: alloc.areaHa ? String(alloc.areaHa) : "",
      correctionFactor: String(alloc.correctionFactor),
      cropCorrection: alloc.cropCorrection,
      muuTripsPerYear: alloc.muuTripsPerYear ? String(alloc.muuTripsPerYear) : "",
      muuVehicleWeightT: alloc.muuVehicleWeightT ? String(alloc.muuVehicleWeightT) : "",
      muuCargoWeightT: alloc.muuCargoWeightT ? String(alloc.muuCargoWeightT) : "",
      notes: alloc.notes,
    });
    setAllocError("");
    setAllocOpen(true);
  }

  // Find which member owns a given property (for the allocation API path)
  function findMemberForProperty(propertyId: string) {
    return members.find((m) => m.roadProperties.some((p) => p.id === propertyId));
  }

  async function saveAlloc() {
    const member = findMemberForProperty(allocPropertyId);
    if (!member) return;

    setAllocSaving(true);
    setAllocError("");

    const payload = {
      trafficType: allocForm.trafficType,
      subType: allocForm.subType,
      areaHa: parseFloat(allocForm.areaHa) || 0,
      correctionFactor: parseFloat(allocForm.correctionFactor) || 1,
      cropCorrection: allocForm.cropCorrection,
      muuTripsPerYear: parseInt(allocForm.muuTripsPerYear) || 0,
      muuVehicleWeightT: parseFloat(allocForm.muuVehicleWeightT) || 0,
      muuCargoWeightT: parseFloat(allocForm.muuCargoWeightT) || 0,
      notes: allocForm.notes,
    };

    const base = `/api/associations/${id}/road-units/members/${member.id}/properties/${allocPropertyId}/allocations`;
    const url = editingAlloc ? `${base}/${editingAlloc.id}` : base;
    const method = editingAlloc ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      await loadMembers();
      setAllocOpen(false);
    } else {
      const err = await res.json();
      setAllocError(err.error ?? "Tallennus epäonnistui.");
    }
    setAllocSaving(false);
  }

  async function deleteAlloc(propertyId: string, alloc: Allocation) {
    const member = findMemberForProperty(propertyId);
    if (!member) return;
    if (!confirm(`Poista liikennelaji "${allocLabel(alloc)}"?`)) return;
    await fetch(
      `/api/associations/${id}/road-units/members/${member.id}/properties/${propertyId}/allocations/${alloc.id}`,
      { method: "DELETE" }
    );
    await loadMembers();
  }

  // ─── Calculation CRUD ───────────────────────────────────────────────────────

  async function runCalc() {
    if (!calcForm.name.trim()) { setCalcError("Nimi on pakollinen."); return; }
    setCalcRunning(true);
    setCalcError("");

    const res = await fetch(`/api/associations/${id}/road-units/calculations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: calcForm.name,
        pricePerUnit: parseFloat(calcForm.pricePerUnit) || 0,
        adminFee: parseFloat(calcForm.adminFee) || 0,
        notes: calcForm.notes,
      }),
    });

    if (res.ok) {
      const calc = await res.json();
      await loadCalcs();
      setCalcOpen(false);
      // Auto-expand the new result
      setExpandedCalc(calc.id);
      setCalcDetail((prev) => ({ ...prev, [calc.id]: calc }));
    } else {
      const err = await res.json();
      setCalcError(err.error ?? "Laskelma epäonnistui.");
    }
    setCalcRunning(false);
  }

  async function activateCalc(calcId: string) {
    await fetch(`/api/associations/${id}/road-units/calculations/${calcId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    await loadCalcs();
    // Refresh detail if already loaded
    if (calcDetail[calcId]) {
      const res = await fetch(`/api/associations/${id}/road-units/calculations/${calcId}`);
      const updated = await res.json();
      setCalcDetail((prev) => ({ ...prev, [calcId]: updated }));
    }
  }

  async function deleteCalc(calcId: string, name: string) {
    if (!confirm(`Poista laskelma "${name}"?`)) return;
    await fetch(`/api/associations/${id}/road-units/calculations/${calcId}`, { method: "DELETE" });
    setExpandedCalc((prev) => (prev === calcId ? null : prev));
    setCalcDetail((prev) => { const n = { ...prev }; delete n[calcId]; return n; });
    await loadCalcs();
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Ladataan...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Breadcrumb */}
        <Link href={`/associations/${id}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="mr-1 h-4 w-4" />
          {assocName}
        </Link>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Route className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Tieyksiköinti</h1>
            <p className="text-sm text-muted-foreground">Hallinnoi kiinteistöjä ja aja tieyksikkölaskelma</p>
          </div>
        </div>

        <Tabs defaultValue="kiinteistot">
          <TabsList className="mb-6">
            <TabsTrigger value="kiinteistot">Kiinteistöt</TabsTrigger>
            <TabsTrigger value="laskelmat">Laskelmat</TabsTrigger>
          </TabsList>

          {/* ── Kiinteistöt tab ─────────────────────────────────────────────── */}
          <TabsContent value="kiinteistot">
            {members.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Ei jäseniä. Lisää jäseniä ensin Jäsenet-sivulla.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {members.map((member) => {
                  const open = expandedMember === member.id;
                  return (
                    <div key={member.id} className="rounded-md border overflow-hidden">
                      {/* Member row */}
                      <div
                        className="flex items-center justify-between px-4 py-3 bg-muted/30 cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => setExpandedMember(open ? null : member.id)}
                      >
                        <div className="flex items-center gap-2">
                          {open
                            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          }
                          <span className="font-medium">{member.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {member.roadProperties.length} kiinteistö{member.roadProperties.length !== 1 ? "ä" : ""}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={(e) => { e.stopPropagation(); openNewProp(member.id); }}
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          Lisää kiinteistö
                        </Button>
                      </div>

                      {/* Properties */}
                      {open && (
                        <div className="divide-y">
                          {member.roadProperties.length === 0 ? (
                            <p className="px-6 py-4 text-sm text-muted-foreground">
                              Ei kiinteistöjä. Lisää yllä olevalla napilla.
                            </p>
                          ) : (
                            member.roadProperties.map((prop) => (
                              <div key={prop.id} className="px-6 py-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-medium text-sm">{prop.name}</span>
                                      {prop.kiinteistoId && (
                                        <span className="text-xs font-mono text-muted-foreground">{prop.kiinteistoId}</span>
                                      )}
                                      <span className="text-xs text-muted-foreground">
                                        {fmt2(prop.distanceKm)} km
                                      </span>
                                    </div>
                                    {/* Allocations */}
                                    <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                                      {prop.allocations.map((a) => (
                                        <div key={a.id} className="group flex items-center gap-1">
                                          <Badge variant="secondary" className="text-xs gap-1">
                                            {allocLabel(a)}
                                            {a.correctionFactor !== 1 && (
                                              <span className="text-muted-foreground">×{a.correctionFactor}</span>
                                            )}
                                          </Badge>
                                          <button
                                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-opacity"
                                            onClick={() => openEditAlloc(prop.id, a)}
                                            title="Muokkaa"
                                          >
                                            <Pencil className="h-3 w-3" />
                                          </button>
                                          <button
                                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                                            onClick={() => deleteAlloc(prop.id, a)}
                                            title="Poista"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        </div>
                                      ))}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-xs px-2"
                                        onClick={() => openNewAlloc(prop.id)}
                                      >
                                        <Plus className="mr-0.5 h-3 w-3" />
                                        Liikennelaji
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="flex gap-1 shrink-0">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditProp(member.id, prop)}>
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteProp(member.id, prop)}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── Laskelmat tab ───────────────────────────────────────────────── */}
          <TabsContent value="laskelmat">
            <div className="flex justify-end mb-4">
              <Button onClick={() => { setCalcForm(EMPTY_CALC); setCalcError(""); setCalcOpen(true); }}>
                <Play className="mr-2 h-4 w-4" />
                Aja uusi laskelma
              </Button>
            </div>

            {calcs.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Ei laskelmia. Aja ensimmäinen laskelma yllä olevalla napilla.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {calcs.map((calc) => {
                  const open = expandedCalc === calc.id;
                  const detail = calcDetail[calc.id];
                  return (
                    <div key={calc.id} className="rounded-md border overflow-hidden">
                      {/* Calc header row */}
                      <div
                        className="flex items-center justify-between px-4 py-3 bg-muted/30 cursor-pointer hover:bg-muted/50 select-none"
                        onClick={async () => {
                          if (open) { setExpandedCalc(null); return; }
                          setExpandedCalc(calc.id);
                          await loadCalcDetail(calc.id);
                        }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {open
                            ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          }
                          <span className="font-medium truncate">{calc.name}</span>
                          {calc.isActive && (
                            <Badge variant="default" className="text-xs shrink-0">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Aktiivinen
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground shrink-0">
                            {calc._count.results} jäsentä
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {new Date(calc.createdAt).toLocaleDateString("fi-FI")}
                          </span>
                        </div>
                        <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {!calc.isActive && (
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => activateCalc(calc.id)}>
                              Aseta aktiiviseksi
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteCalc(calc.id, calc.name)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Results */}
                      {open && (
                        <div>
                          {!detail ? (
                            <p className="px-4 py-4 text-sm text-muted-foreground">Ladataan...</p>
                          ) : (
                            <>
                              {/* Pricing info */}
                              {(detail.pricePerUnit > 0 || detail.adminFee > 0) && (
                                <div className="px-4 py-2 border-b bg-muted/10 flex gap-6 text-xs text-muted-foreground">
                                  {detail.pricePerUnit > 0 && (
                                    <span>Yksikköhinta: <strong className="text-foreground">{fmt2(detail.pricePerUnit)} €/tkm</strong></span>
                                  )}
                                  {detail.adminFee > 0 && (
                                    <span>Perusmaksu: <strong className="text-foreground">{fmt2(detail.adminFee)} €/jäsen</strong></span>
                                  )}
                                </div>
                              )}

                              {/* Results table */}
                              <table className="w-full text-sm">
                                <thead className="bg-muted/30">
                                  <tr>
                                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Jäsen</th>
                                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Tkm</th>
                                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Osuus</th>
                                    {detail.pricePerUnit > 0 && (
                                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Laskutus</th>
                                    )}
                                  </tr>
                                </thead>
                                <tbody>
                                  {detail.results.map((r) => {
                                    const invoice = detail.pricePerUnit > 0
                                      ? r.totalTkm * detail.pricePerUnit + detail.adminFee
                                      : null;
                                    return (
                                      <tr key={r.id} className="border-t hover:bg-muted/10">
                                        <td className="px-4 py-2 font-medium">{r.memberName}</td>
                                        <td className="px-4 py-2 text-right tabular-nums font-mono">{r.totalTkm.toFixed(0)}</td>
                                        <td className="px-4 py-2 text-right tabular-nums font-mono">{fmt2(r.sharePercent)} %</td>
                                        {invoice !== null && (
                                          <td className="px-4 py-2 text-right tabular-nums font-mono">{fmt2(invoice)} €</td>
                                        )}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                <tfoot>
                                  <tr className="border-t font-semibold bg-muted/20">
                                    <td className="px-4 py-2 text-muted-foreground">Yhteensä</td>
                                    <td className="px-4 py-2 text-right tabular-nums font-mono">
                                      {detail.results.reduce((s, r) => s + r.totalTkm, 0).toFixed(0)}
                                    </td>
                                    <td className="px-4 py-2 text-right tabular-nums font-mono">100,00 %</td>
                                    {detail.pricePerUnit > 0 && (
                                      <td className="px-4 py-2 text-right tabular-nums font-mono">
                                        {fmt2(
                                          detail.results.reduce(
                                            (s, r) => s + r.totalTkm * detail.pricePerUnit + detail.adminFee,
                                            0
                                          )
                                        )} €
                                      </td>
                                    )}
                                  </tr>
                                </tfoot>
                              </table>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Property dialog ────────────────────────────────────────────────── */}
      <Dialog open={propOpen} onOpenChange={setPropOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProp ? "Muokkaa kiinteistöä" : "Lisää kiinteistö"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Tilan nimi *</Label>
              <Input
                value={propForm.name}
                onChange={(e) => setPropForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Esim. Oravala RN:o 5:6"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kiinteistötunnus</Label>
              <Input
                value={propForm.kiinteistoId}
                onChange={(e) => setPropForm((f) => ({ ...f, kiinteistoId: e.target.value }))}
                placeholder="123-456-7-89"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Etäisyys tiellä (km) *</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={propForm.distanceKm}
                onChange={(e) => setPropForm((f) => ({ ...f, distanceKm: e.target.value }))}
                placeholder="Esim. 2.5"
              />
              <p className="text-xs text-muted-foreground">Yhdensuuntainen matka yksityistiellä kilometreissä.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Muistiinpanot</Label>
              <Input
                value={propForm.notes}
                onChange={(e) => setPropForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            {propError && <p className="text-sm text-destructive">{propError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPropOpen(false)}>Peruuta</Button>
            <Button onClick={saveProp} disabled={propSaving}>
              {propSaving ? "Tallennetaan..." : editingProp ? "Tallenna" : "Lisää kiinteistö"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Allocation dialog ──────────────────────────────────────────────── */}
      <Dialog open={allocOpen} onOpenChange={setAllocOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAlloc ? "Muokkaa liikennelajia" : "Lisää liikennelaji"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">

            {/* Traffic type */}
            <div className="space-y-1.5">
              <Label>Liikennelaji *</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={allocForm.trafficType}
                onChange={(e) => setAllocForm((f) => ({ ...f, trafficType: e.target.value, subType: "" }))}
              >
                {Object.entries(TRAFFIC_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            {/* Sub-type (vapaa_ajan_asunto, metsa, pelto) */}
            {SUBTYPE_LABELS[allocForm.trafficType] && (
              <div className="space-y-1.5">
                <Label>
                  {allocForm.trafficType === "metsa" ? "Metsäalue" : "Tyyppi"}
                </Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={allocForm.subType}
                  onChange={(e) => setAllocForm((f) => ({ ...f, subType: e.target.value }))}
                >
                  <option value="">— Valitse —</option>
                  {Object.entries(SUBTYPE_LABELS[allocForm.trafficType]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Area (metsa and pelto only) */}
            {(allocForm.trafficType === "metsa" || allocForm.trafficType === "pelto") && (
              <div className="space-y-1.5">
                <Label>Pinta-ala (ha)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={allocForm.areaHa}
                  onChange={(e) => setAllocForm((f) => ({ ...f, areaHa: e.target.value }))}
                  placeholder="Esim. 12.5"
                />
              </div>
            )}

            {/* Crop correction (pelto only) */}
            {allocForm.trafficType === "pelto" && (
              <div className="space-y-1.5">
                <Label>Satokorjaus</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={allocForm.cropCorrection}
                  onChange={(e) => setAllocForm((f) => ({ ...f, cropCorrection: e.target.value }))}
                >
                  {Object.entries(CROP_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Muu liikenne fields */}
            {allocForm.trafficType === "muu" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Ajokertoja vuodessa (A)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={allocForm.muuTripsPerYear}
                    onChange={(e) => setAllocForm((f) => ({ ...f, muuTripsPerYear: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Ajoneuvon paino (t) (B)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={allocForm.muuVehicleWeightT}
                    onChange={(e) => setAllocForm((f) => ({ ...f, muuVehicleWeightT: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Kuorma vuodessa (t) (C)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={allocForm.muuCargoWeightT}
                    onChange={(e) => setAllocForm((f) => ({ ...f, muuCargoWeightT: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Painoluku = A × B + C</p>
              </div>
            )}

            {/* Correction factor (always) */}
            <div className="space-y-1.5">
              <Label>Korjauskerroin</Label>
              <Input
                type="number"
                min="0"
                step="0.05"
                value={allocForm.correctionFactor}
                onChange={(e) => setAllocForm((f) => ({ ...f, correctionFactor: e.target.value }))}
                placeholder="1"
              />
              <p className="text-xs text-muted-foreground">
                1.0 = ei korjausta. Esim. 0.8 = −20 % (yksinasuva), 0.7 = −30 % (saaristomökki).
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Muistiinpanot</Label>
              <Input
                value={allocForm.notes}
                onChange={(e) => setAllocForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            {allocError && <p className="text-sm text-destructive">{allocError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllocOpen(false)}>Peruuta</Button>
            <Button onClick={saveAlloc} disabled={allocSaving}>
              {allocSaving ? "Tallennetaan..." : editingAlloc ? "Tallenna" : "Lisää liikennelaji"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New calculation dialog ─────────────────────────────────────────── */}
      <Dialog open={calcOpen} onOpenChange={setCalcOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Aja tieyksikkölaskelma</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Laskelman nimi *</Label>
              <Input
                value={calcForm.name}
                onChange={(e) => setCalcForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={`Tieyksikkölaskelma ${new Date().getFullYear()}`}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Yksikköhinta (€/tkm)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={calcForm.pricePerUnit}
                  onChange={(e) => setCalcForm((f) => ({ ...f, pricePerUnit: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Perusmaksu (€/jäsen)</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={calcForm.adminFee}
                  onChange={(e) => setCalcForm((f) => ({ ...f, adminFee: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Muistiinpanot</Label>
              <Input
                value={calcForm.notes}
                onChange={(e) => setCalcForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Laskelma lukee kaikkien jäsenten nykyiset kiinteistö- ja liikennelajitiedot ja tallentaa tulokset.
            </p>
            {calcError && <p className="text-sm text-destructive">{calcError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCalcOpen(false)}>Peruuta</Button>
            <Button onClick={runCalc} disabled={calcRunning}>
              {calcRunning ? "Lasketaan..." : "Aja laskelma"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
