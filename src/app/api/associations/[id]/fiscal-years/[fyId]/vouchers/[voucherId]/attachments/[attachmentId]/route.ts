import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssociationAccess, requireAssociationEditor } from "@/lib/auth-helpers";
import fs from "fs";
import path from "path";

const ATTACHMENTS_DIR = path.resolve(process.cwd(), "data/attachments");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; voucherId: string; attachmentId: string }> }
) {
  const { id, voucherId, attachmentId } = await params;
  const authResult = await requireAssociationAccess(id);
  if (authResult instanceof Response) return authResult;


  const attachment = await prisma.voucherAttachment.findFirst({ where: { id: attachmentId, voucherId, associationId: id } });
  if (!attachment) return NextResponse.json({ error: "Liite ei löydy" }, { status: 404 });

  const filePath = path.join(ATTACHMENTS_DIR, attachmentId);
  if (!fs.existsSync(filePath)) return NextResponse.json({ error: "Tiedosto ei löydy" }, { status: 404 });

  const data = fs.readFileSync(filePath);
  const isInline = attachment.mimeType.startsWith("image/") || attachment.mimeType === "application/pdf";
  return new NextResponse(data, {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `${isInline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`,
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; voucherId: string; attachmentId: string }> }
) {
  const { id, voucherId, attachmentId } = await params;
  const authResult = await requireAssociationEditor(id);
  if (authResult instanceof Response) return authResult;


  const attachment = await prisma.voucherAttachment.findFirst({ where: { id: attachmentId, voucherId, associationId: id } });
  if (!attachment) return NextResponse.json({ error: "Liite ei löydy" }, { status: 404 });

  await prisma.voucherAttachment.delete({ where: { id: attachmentId } });

  const filePath = path.join(ATTACHMENTS_DIR, attachmentId);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  return new NextResponse(null, { status: 204 });
}
