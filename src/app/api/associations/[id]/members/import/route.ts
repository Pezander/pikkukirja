import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationEditor } from "@/lib/auth-helpers";
import { generateViitenumero } from "@/lib/viitenumero";

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requireAssociationEditor(id);
  if (result instanceof Response) return result;

  const text = await req.text();

  // Strip BOM if present
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/).filter((l) => l.trim());

  if (lines.length < 2) {
    return NextResponse.json({ created: 0, errors: ["Tiedosto on tyhjä tai sisältää vain otsikkorivin."] });
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[äåa]/g, "a").replace(/[öo]/g, "o"));

  const COL: Record<string, number> = {};
  const ALIASES: Record<string, string> = {
    nimi: "nimi", name: "nimi",
    jasennumero: "jasennumero", membernumber: "jasennumero",
    osoite: "osoite", address: "osoite",
    postinumero: "postinumero", postalcode: "postinumero",
    kaupunki: "kaupunki", city: "kaupunki",
    sahkoposti: "sahkoposti", email: "sahkoposti",
    viitenumero: "viitenumero", referencenumber: "viitenumero",
    jasenstyyppi: "jasentyyppi", membertype: "jasentyyppi", jasentyyppi: "jasentyyppi",
    muistiinpanot: "muistiinpanot", notes: "muistiinpanot",
  };
  headers.forEach((h, i) => { if (ALIASES[h]) COL[ALIASES[h]] = i; });

  const errors: string[] = [];
  let created = 0;
  let memberCount = await prisma.member.count({ where: { associationId: id } });

  for (let r = 1; r < lines.length; r++) {
    const cols = parseCsvLine(lines[r]);
    const name = cols[COL["nimi"] ?? -1]?.trim() ?? "";
    if (!name) { errors.push(`Rivi ${r + 1}: nimi puuttuu.`); continue; }

    const referenceNumber = cols[COL["viitenumero"] ?? -1]?.trim() || generateViitenumero(++memberCount);

    try {
      await prisma.member.create({
        data: {
          associationId: id,
          name,
          memberNumber: cols[COL["jasennumero"] ?? -1]?.trim() ?? "",
          address: cols[COL["osoite"] ?? -1]?.trim() ?? "",
          postalCode: cols[COL["postinumero"] ?? -1]?.trim() ?? "",
          city: cols[COL["kaupunki"] ?? -1]?.trim() ?? "",
          email: cols[COL["sahkoposti"] ?? -1]?.trim() ?? "",
          referenceNumber,
          memberType: cols[COL["jasentyyppi"] ?? -1]?.trim() ?? "",
          notes: cols[COL["muistiinpanot"] ?? -1]?.trim() ?? "",
        },
      });
      created++;
    } catch (e) {
      errors.push(`Rivi ${r + 1} (${name}): ${e instanceof Error ? e.message : "Virhe"}`);
    }
  }

  return NextResponse.json({ created, errors });
}
