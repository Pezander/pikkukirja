import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationAccess } from "@/lib/auth-helpers";

function csvEscape(v: string | null | undefined) {
  return `"${(v ?? "").replace(/"/g, '""')}"`;
}

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

  const rows: string[] = [
    "Nimi,Jäsennumero,Osoite,Postinumero,Kaupunki,Sähköposti,Viitenumero,Jäsentyyppi,Muistiinpanot",
  ];

  for (const m of members) {
    rows.push(
      [m.name, m.memberNumber, m.address, m.postalCode, m.city, m.email, m.referenceNumber, m.memberType, m.notes]
        .map(csvEscape)
        .join(",")
    );
  }

  const csv = "\uFEFF" + rows.join("\r\n"); // BOM for Excel compatibility
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="jasenet.csv"`,
    },
  });
}
