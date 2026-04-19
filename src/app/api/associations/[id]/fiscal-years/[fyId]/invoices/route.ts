import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationAccess, requireAssociationEditor } from "@/lib/auth-helpers";
import { getOrgLabels } from "@/lib/orgLabels";
import { logAction } from "@/lib/audit";

// GET — list all invoices for a fiscal year
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fyId: string }> }
) {
  const { id, fyId } = await params;
  const authResult = await requireAssociationAccess(id);
  if (authResult instanceof Response) return authResult;

  const fyOk = await prisma.fiscalYear.findFirst({
    where: { id: fyId, associationId: id },
    select: { id: true },
  });
  if (!fyOk) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const invoices = await prisma.invoice.findMany({
    where: { fiscalYearId: fyId },
    include: {
      member: true,
      lineItems: true,
      payments: { orderBy: { paidAt: "asc" } },
    },
    orderBy: { invoiceNumber: "asc" },
  });
  return NextResponse.json(invoices);
}

// POST — generate invoices for all members
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fyId: string }> }
) {
  const { id, fyId } = await params;
  const authResult = await requireAssociationEditor(id);
  if (authResult instanceof Response) return authResult;

  const fyOk = await prisma.fiscalYear.findFirst({
    where: { id: fyId, associationId: id },
    select: { id: true },
  });
  if (!fyOk) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { unitPrice, adminFee, memberTypeFees, issueDate, dueDate, memberIds } = body;

  if (!issueDate || !dueDate) {
    return NextResponse.json({ error: "issueDate and dueDate required" }, { status: 400 });
  }

  const association = await prisma.association.findUnique({ where: { id } });
  if (!association) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const orgType = association.type ?? "tiekunta";
  const labels = getOrgLabels(orgType);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vatRate: number | null = (association as any).vatRate ?? null;

  // Load members (all or selected), ordered by name
  const members = await prisma.member.findMany({
    where: {
      associationId: id,
      ...(memberIds?.length ? { id: { in: memberIds } } : {}),
    },
    include: { properties: true },
    orderBy: { name: "asc" },
  });

  if (members.length === 0) {
    return NextResponse.json({ error: "Ei jäseniä" }, { status: 400 });
  }

  // Delete any existing invoices for this fiscal year (regenerate)
  await prisma.invoice.deleteMany({ where: { fiscalYearId: fyId } });

  const fy = await prisma.fiscalYear.findUnique({ where: { id: fyId } });
  const yearPrefix = fy?.year ?? new Date().getFullYear();

  const created = [];
  let seq = 1;

  if (orgType === "metsastysseura") {
    // ── Flat-fee invoices per member type ────────────────────────
    if (!memberTypeFees || typeof memberTypeFees !== "object") {
      return NextResponse.json({ error: "memberTypeFees required for metsastysseura" }, { status: 400 });
    }

    const fee = parseFloat(adminFee) || 0;

    for (const member of members) {
      const memberFee = parseFloat(memberTypeFees[member.memberType] ?? "0") || 0;
      if (memberFee <= 0 && fee <= 0) continue; // skip members with no applicable fee

      const typeLabel = labels.memberTypeOptions.find((o) => o.value === member.memberType)?.label
        ?? (member.memberType || "Jäsen");

      const lineItems = memberFee > 0
        ? [{ name: `Jäsenmaksu – ${typeLabel}`, units: 1, unitPrice: memberFee, amount: memberFee }]
        : [];
      const netAmount = memberFee + fee;
      const vatAmount = vatRate ? Math.round(netAmount * vatRate) / 100 : null;
      const totalAmount = netAmount + (vatAmount ?? 0);

      const invoice = await prisma.invoice.create({
        data: {
          fiscalYearId: fyId,
          memberId: member.id,
          invoiceNumber: `${yearPrefix}-${String(seq).padStart(3, "0")}`,
          issueDate: new Date(issueDate),
          dueDate: new Date(dueDate),
          unitPrice: memberFee,
          adminFee: fee,
          totalAmount,
          vatRate: vatRate ?? undefined,
          vatAmount: vatAmount ?? undefined,
          lineItems: { create: lineItems },
        },
        include: { member: true, lineItems: true },
      });

      created.push(invoice);
      seq++;
    }

    if (created.length === 0) {
      return NextResponse.json({ error: "Yhdellekään jäsenelle ei löytynyt jäsenmaksua. Tarkista jäsentyypit ja hinnat." }, { status: 400 });
    }

  } else {
    // ── Unit-based invoices (tiekunta / taloyhtiö) ────────────────
    if (!unitPrice || parseFloat(unitPrice) <= 0) {
      return NextResponse.json({ error: "unitPrice required" }, { status: 400 });
    }

    const fee = parseFloat(adminFee) || 0;

    for (const member of members) {
      const totalUnits = member.properties.reduce((s: number, p) => s + p.units, 0);
      const lineItems = member.properties.map((p) => ({
        name: p.name,
        units: p.units,
        unitPrice: parseFloat(unitPrice),
        amount: p.units * parseFloat(unitPrice),
      }));
      const netAmount = totalUnits * parseFloat(unitPrice) + fee;
      const vatAmount = vatRate ? Math.round(netAmount * vatRate) / 100 : null;
      const totalAmount = netAmount + (vatAmount ?? 0);

      const invoice = await prisma.invoice.create({
        data: {
          fiscalYearId: fyId,
          memberId: member.id,
          invoiceNumber: `${yearPrefix}-${String(seq).padStart(3, "0")}`,
          issueDate: new Date(issueDate),
          dueDate: new Date(dueDate),
          unitPrice: parseFloat(unitPrice),
          adminFee: fee,
          totalAmount,
          vatRate: vatRate ?? undefined,
          vatAmount: vatAmount ?? undefined,
          lineItems: { create: lineItems },
        },
        include: { member: true, lineItems: true },
      });

      created.push(invoice);
      seq++;
    }
  }

  logAction(authResult.user.id, authResult.user.name ?? authResult.user.email ?? "Tuntematon", "CREATE", "Invoice", fyId, `Laskut luotu: ${created.length} kpl (tilikausi ${fyId})`);

  return NextResponse.json(created, { status: 201 });
}
