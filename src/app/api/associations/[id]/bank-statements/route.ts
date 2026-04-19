import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationAccess, requireAssociationEditor } from "@/lib/auth-helpers";
import { parseFinnishBankCsv } from "@/lib/parseBankCsv";
import { parseCamt053 } from "@/lib/parseBankCamt";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAssociationAccess(id);
  if (authResult instanceof Response) return authResult;

  const statements = await prisma.bankStatement.findMany({
    where: { associationId: id },
    orderBy: { importedAt: "desc" },
    include: { _count: { select: { transactions: true } } },
  });

  return NextResponse.json(statements);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAssociationEditor(id);
  if (authResult instanceof Response) return authResult;


  // Verify association belongs to user
  const assoc = await prisma.association.findUnique({ where: { id } });
  if (!assoc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const content = await file.text();
  const filename = file.name;
  const isXml = filename.toLowerCase().endsWith(".xml") || content.trimStart().startsWith("<?xml");

  const parsed = isXml ? parseCamt053(content) : parseFinnishBankCsv(content);

  if (parsed.length === 0) {
    return NextResponse.json({ error: "Tiedostosta ei löydetty tapahtumia. Tarkista muoto." }, { status: 422 });
  }

  const statement = await prisma.bankStatement.create({
    data: {
      associationId: id,
      filename,
      format: isXml ? "camt053" : "csv",
      importedAt: new Date(),
      transactions: {
        create: parsed.map((t) => ({
          date: new Date(t.date),
          amount: t.amount,
          description: t.description,
          reference: t.reference,
          archiveId: t.archiveId,
        })),
      },
    },
    include: { transactions: true, _count: { select: { transactions: true } } },
  });

  return NextResponse.json(statement, { status: 201 });
}
