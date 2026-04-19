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

  const accounts = await prisma.account.findMany({
    where: { associationId: id },
    orderBy: { number: "asc" },
  });
  return NextResponse.json(accounts);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requireAssociationEditor(id);
  if (result instanceof Response) return result;

  const { number, name, type } = await req.json();
  if (!number || !name || !type) {
    return NextResponse.json({ error: "number, name and type required" }, { status: 400 });
  }
  const account = await prisma.account.create({
    data: { associationId: id, number, name, type },
  });
  return NextResponse.json(account, { status: 201 });
}
