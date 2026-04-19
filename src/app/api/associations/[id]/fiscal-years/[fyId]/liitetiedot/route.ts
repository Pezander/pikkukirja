import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationAccess, requireAssociationEditor } from "@/lib/auth-helpers";
import { getDefaultLiitetiedot } from "@/lib/defaultLiitetiedot";

// GET — return liitetiedot sections, seeding defaults on first access
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fyId: string }> }
) {
  const { id, fyId } = await params;
  const authResult = await requireAssociationAccess(id);
  if (authResult instanceof Response) return authResult;

  const fy = await prisma.fiscalYear.findUnique({
    where: { id: fyId },
    include: { association: { select: { type: true } } },
  });
  if (!fy || fy.associationId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Seed default sections on first access if still empty
  if (fy.liitetiedot === "[]") {
    const defaults = getDefaultLiitetiedot(fy.association.type);
    const seeded = await prisma.fiscalYear.update({
      where: { id: fyId },
      data: { liitetiedot: JSON.stringify(defaults) },
    });
    return NextResponse.json(JSON.parse(seeded.liitetiedot));
  }

  return NextResponse.json(JSON.parse(fy.liitetiedot));
}

// PUT — save liitetiedot sections
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fyId: string }> }
) {
  const { id, fyId } = await params;
  const authResult = await requireAssociationEditor(id);
  if (authResult instanceof Response) return authResult;

  const fy = await prisma.fiscalYear.findUnique({ where: { id: fyId } });
  if (!fy || fy.associationId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (fy.status === "closed") {
    return NextResponse.json({ error: "Suljetun tilikauden liitetietoja ei voi muokata" }, { status: 403 });
  }

  const sections = await req.json();
  const updated = await prisma.fiscalYear.update({
    where: { id: fyId },
    data: { liitetiedot: JSON.stringify(sections) },
  });

  return NextResponse.json(JSON.parse(updated.liitetiedot));
}
