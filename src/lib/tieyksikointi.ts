import { prisma } from "@/lib/prisma";

// ─── Painoluku lookup tables ──────────────────────────────────────────────────

// Fixed painoluvut (tonnes) for property types that don't depend on area.
const ASUNTO_PAINOLUKU = 1700;

const VAPAA_AJAN_PAINOLUKU: Record<string, number> = {
  ympärivuotinen: 1300,
  kesämökki: 750,
  lomamökki: 350,
};

// Metsä painoluku per ha by forest region (1–5).
const METSA_PAINOLUKU_PER_HA: Record<string, number> = {
  "1": 21,
  "2": 18,
  "3": 11,
  "4": 7,
  "5": 3,
};

// Pelto base painoluku per ha by crop type.
const PELTO_PAINOLUKU_PER_HA: Record<string, number> = {
  kasvinviljely: 60,
  nautakarja: 130,
};

// Crop correction multipliers (pelto only).
const CROP_CORRECTION_FACTOR: Record<string, number> = {
  none: 1.0,
  sika_siipikarja: 1.4,
  sokerijuurikas: 1.8,
  kesanto: 0.3,
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TrafficAllocationInput {
  id: string;
  trafficType: string;
  subType: string;
  areaHa: number;
  correctionFactor: number;
  cropCorrection: string;
  muuTripsPerYear: number;
  muuVehicleWeightT: number;
  muuCargoWeightT: number;
}

export interface RoadEstatePropertyInput {
  id: string;
  kiinteistoId: string;
  name: string;
  distanceKm: number;
  allocations: TrafficAllocationInput[];
}

export interface BreakdownItem {
  propertyName: string;
  kiinteistoId: string;
  distanceKm: number;
  trafficType: string;
  subType: string;
  areaHa: number;
  painoluku: number;
  correctionFactor: number;
  tkm: number;
}

export interface MemberResult {
  memberId: string;
  memberName: string;
  totalTkm: number;
  sharePercent: number;
  breakdown: BreakdownItem[];
}

export interface CalculationInput {
  associationId: string;
  name: string;
  pricePerUnit?: number;
  adminFee?: number;
  notes?: string;
}

// ─── Core formula functions ───────────────────────────────────────────────────

/**
 * Returns the base painoluku in tonnes for a single traffic allocation
 * (before applying correctionFactor).
 */
export function computeBasePainoluku(alloc: TrafficAllocationInput): number {
  switch (alloc.trafficType) {
    case "asunto":
      return ASUNTO_PAINOLUKU;

    case "vapaa_ajan_asunto": {
      const base = VAPAA_AJAN_PAINOLUKU[alloc.subType] ?? 0;
      return base;
    }

    case "metsa": {
      const perHa = METSA_PAINOLUKU_PER_HA[alloc.subType] ?? 0;
      return perHa * alloc.areaHa;
    }

    case "pelto": {
      const perHa = PELTO_PAINOLUKU_PER_HA[alloc.subType] ?? 0;
      const cropMul = CROP_CORRECTION_FACTOR[alloc.cropCorrection] ?? 1.0;
      return perHa * alloc.areaHa * cropMul;
    }

    case "muu":
      // painoluku = A × B + C  (A = trips/year, B = vehicle weight, C = cargo weight)
      return alloc.muuTripsPerYear * alloc.muuVehicleWeightT + alloc.muuCargoWeightT;

    default:
      return 0;
  }
}

/**
 * Returns the effective painoluku after applying correctionFactor.
 */
export function computeWeightFactor(alloc: TrafficAllocationInput): number {
  return computeBasePainoluku(alloc) * alloc.correctionFactor;
}

/**
 * Returns ton-kilometres for one allocation on one property.
 * tkm = painoluku (t) × distanceKm (km)
 */
export function computeTkm(alloc: TrafficAllocationInput, distanceKm: number): number {
  return computeWeightFactor(alloc) * distanceKm;
}

// ─── Calculation engine ───────────────────────────────────────────────────────

/**
 * Computes tkm results for a list of properties belonging to one member.
 */
export function computeMemberTkm(
  properties: RoadEstatePropertyInput[]
): { totalTkm: number; breakdown: BreakdownItem[] } {
  const breakdown: BreakdownItem[] = [];

  for (const prop of properties) {
    for (const alloc of prop.allocations) {
      const painoluku = computeWeightFactor(alloc);
      const tkm = painoluku * prop.distanceKm;
      breakdown.push({
        propertyName: prop.name,
        kiinteistoId: prop.kiinteistoId,
        distanceKm: prop.distanceKm,
        trafficType: alloc.trafficType,
        subType: alloc.subType,
        areaHa: alloc.areaHa,
        painoluku,
        correctionFactor: alloc.correctionFactor,
        tkm,
      });
    }
  }

  const totalTkm = breakdown.reduce((sum, b) => sum + b.tkm, 0);
  return { totalTkm, breakdown };
}

/**
 * Reads all RoadEstateProperty / TrafficAllocation data for the association,
 * runs the calculation, stores a new RoadUnitCalculation with RoadUnitResult rows,
 * and returns the stored calculation id.
 */
export async function runCalculation(input: CalculationInput): Promise<string> {
  const { associationId, name, pricePerUnit = 0, adminFee = 0, notes = "" } = input;

  // Load all members with their road properties and traffic allocations.
  const members = await prisma.member.findMany({
    where: { associationId },
    select: {
      id: true,
      name: true,
      roadProperties: {
        select: {
          id: true,
          kiinteistoId: true,
          name: true,
          distanceKm: true,
          allocations: true,
        },
      },
    },
  });

  type MemberRow = (typeof members)[number];

  // Compute per-member results.
  const memberResults: MemberResult[] = members.map((member: MemberRow) => {
    const { totalTkm, breakdown } = computeMemberTkm(member.roadProperties);
    return {
      memberId: member.id,
      memberName: member.name,
      totalTkm,
      sharePercent: 0, // filled in below after total is known
      breakdown,
    };
  });

  const grandTotalTkm = memberResults.reduce((sum, r) => sum + r.totalTkm, 0);

  for (const r of memberResults) {
    r.sharePercent = grandTotalTkm > 0 ? (r.totalTkm / grandTotalTkm) * 100 : 0;
  }

  // Persist: create RoadUnitCalculation + RoadUnitResult rows in one transaction.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calculation = await prisma.$transaction(async (tx: any) => {
    const calc = await tx.roadUnitCalculation.create({
      data: {
        name,
        pricePerUnit,
        adminFee,
        notes,
        associationId,
      },
    });

    await tx.roadUnitResult.createMany({
      data: memberResults.map((r) => ({
        calculationId: calc.id,
        memberId: r.memberId,
        memberName: r.memberName,
        totalTkm: r.totalTkm,
        sharePercent: r.sharePercent,
        breakdown: JSON.stringify(r.breakdown),
      })),
    });

    return calc;
  });

  return calculation.id;
}
