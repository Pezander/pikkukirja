import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationAccess } from "@/lib/auth-helpers";

function csvEscape(v: string | number | null | undefined) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: "Vastaava",
  liability: "Velka",
  equity: "Oma pääoma",
  income: "Tulo",
  expense: "Meno",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fyId: string }> }
) {
  const { id, fyId } = await params;
  const authResult = await requireAssociationAccess(id);
  if (authResult instanceof Response) return authResult;


  const [association, fy] = await Promise.all([
    prisma.association.findUnique({ where: { id } }),
    prisma.fiscalYear.findUnique({
      where: { id: fyId },
      include: {
        vouchers: {
          include: { lines: { include: { account: true } } },
          orderBy: { number: "asc" },
        },
      },
    }),
  ]);

  if (!association || !fy || fy.associationId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rows: string[] = [
    "Tositenumero,Päivämäärä,Kuvaus,Tilinumero,Tilin nimi,Tilin tyyppi,Debet,Kredit,Selite",
  ];

  for (const voucher of fy.vouchers) {
    const date = new Date(voucher.date).toLocaleDateString("fi-FI");
    for (const line of voucher.lines) {
      rows.push(
        [
          voucher.number,
          date,
          voucher.description,
          line.account.number,
          line.account.name,
          ACCOUNT_TYPE_LABELS[line.account.type] ?? line.account.type,
          line.debit.toFixed(2).replace(".", ","),
          line.credit.toFixed(2).replace(".", ","),
          line.note,
        ]
          .map(csvEscape)
          .join(",")
      );
    }
  }

  const csv = "\uFEFF" + rows.join("\r\n");
  const filename = `kirjanpito_${association.name.replace(/\s+/g, "_")}_${fy.year}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
