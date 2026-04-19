import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationAccess, requireAssociationEditor } from "@/lib/auth-helpers";
import { generateViitenumero } from "@/lib/viitenumero";
import { logAction } from "@/lib/audit";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requireAssociationAccess(id);
  if (result instanceof Response) return result;

  const members = await prisma.member.findMany({
    where: { associationId: id },
    include: { properties: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(members);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requireAssociationEditor(id);
  if (result instanceof Response) return result;

  const body = await req.json();
  const { name, memberNumber, address, postalCode, city, email, referenceNumber, memberType, notes, properties } = body;

  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  // Auto-generate a sequential reference number if not provided
  let finalRefNum = referenceNumber ?? "";
  if (!finalRefNum) {
    const count = await prisma.member.count({ where: { associationId: id } });
    finalRefNum = generateViitenumero(count + 1);
  }

  const member = await prisma.member.create({
    data: {
      associationId: id,
      name,
      memberNumber: memberNumber ?? "",
      address: address ?? "",
      postalCode: postalCode ?? "",
      city: city ?? "",
      email: email ?? "",
      referenceNumber: finalRefNum,
      memberType: memberType ?? "",
      notes: notes ?? "",
      properties: {
        create: (properties ?? []).map((p: { name: string; units: number }) => ({
          name: p.name,
          units: p.units,
        })),
      },
    },
    include: { properties: true },
  });

  logAction(result.user.id, result.user.name ?? result.user.email ?? "Tuntematon", "CREATE", "Member", member.id, `Jäsen lisätty: ${member.name}`);

  return NextResponse.json(member, { status: 201 });
}
