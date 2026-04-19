import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationEditor } from "@/lib/auth-helpers";
import { detectMimeFromBytes } from "@/lib/utils";
import fs from "fs";
import path from "path";

const ATTACHMENTS_DIR = path.resolve(process.cwd(), "data/attachments");
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fyId: string; voucherId: string }> }
) {
  const { id, fyId, voucherId } = await params;
  const authResult = await requireAssociationEditor(id);
  if (authResult instanceof Response) return authResult;


  const voucher = await prisma.voucher.findFirst({
    where: { id: voucherId, fiscalYearId: fyId, fiscalYear: { associationId: id } },
    select: { id: true },
  });
  if (!voucher) return NextResponse.json({ error: "Tositetta ei löydy" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Tiedosto puuttuu" }, { status: 400 });

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Tiedosto on liian suuri (max 10 MB)" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Tiedostotyyppi ei ole sallittu. Sallitut: PDF, JPEG, PNG, GIF, WebP" }, { status: 400 });
  }

  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const detectedMime = detectMimeFromBytes(fileBytes);
  if (!detectedMime || !ALLOWED_TYPES.includes(detectedMime)) {
    return NextResponse.json({ error: "Tiedoston sisältö ei vastaa ilmoitettua tiedostotyyppiä" }, { status: 400 });
  }

  const attachment = await prisma.voucherAttachment.create({
    data: { voucherId, associationId: id, originalName: file.name, mimeType: detectedMime, size: file.size },
  });

  if (!fs.existsSync(ATTACHMENTS_DIR)) {
    fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
  }
  fs.writeFileSync(path.join(ATTACHMENTS_DIR, attachment.id), Buffer.from(fileBytes));

  return NextResponse.json(attachment, { status: 201 });
}
