import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationAccess, requireAssociationEditor } from "@/lib/auth-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requireAssociationAccess(id);
  if (result instanceof Response) return result;

  const association = await prisma.association.findUnique({
    where: { id },
    include: { fiscalYears: { orderBy: { year: "desc" } } },
  });
  if (!association) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(association);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requireAssociationEditor(id);
  if (result instanceof Response) return result;

  const body = await req.json();
  const {
    name, address, postalCode, city, iban, bic, bankName,
    contactName, phone, email, vatRate,
  } = body;
  const association = await prisma.association.update({
    where: { id },
    data: { name, address, postalCode, city, iban, bic, bankName, contactName, phone, email, vatRate },
  });
  return NextResponse.json(association);
}
