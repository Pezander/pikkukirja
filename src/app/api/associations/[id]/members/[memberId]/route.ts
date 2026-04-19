import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationAccess, requireAssociationEditor } from "@/lib/auth-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params;
  const result = await requireAssociationAccess(id);
  if (result instanceof Response) return result;

  const member = await prisma.member.findFirst({
    where: { id: memberId, associationId: id },
    include: { properties: true },
  });
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(member);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params;
  const result = await requireAssociationEditor(id);
  if (result instanceof Response) return result;

  const existing = await prisma.member.findFirst({
    where: { id: memberId, associationId: id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name, memberNumber, address, postalCode, city, email, referenceNumber, memberType, notes, properties } = await req.json();

  await prisma.property.deleteMany({ where: { memberId } });

  const member = await prisma.member.update({
    where: { id: memberId },
    data: {
      name,
      memberNumber: memberNumber ?? "",
      address: address ?? "",
      postalCode: postalCode ?? "",
      city: city ?? "",
      email: email ?? "",
      referenceNumber: referenceNumber ?? "",
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

  return NextResponse.json(member);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params;
  const result = await requireAssociationEditor(id);
  if (result instanceof Response) return result;

  const existing = await prisma.member.findFirst({
    where: { id: memberId, associationId: id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const invoiceCount = await prisma.invoice.count({ where: { memberId } });
  if (invoiceCount > 0) {
    return NextResponse.json(
      { error: `Jäsenellä on ${invoiceCount} lasku${invoiceCount > 1 ? "a" : ""}. Poista laskut ensin tai merkitse ne poistetuiksi.`, invoiceCount },
      { status: 409 }
    );
  }

  await prisma.member.delete({ where: { id: memberId } });
  return new NextResponse(null, { status: 204 });
}
