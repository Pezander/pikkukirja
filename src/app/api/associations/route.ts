import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDefaultAccounts } from "@/lib/defaultAccounts";
import { requireAuth, requireAdmin } from "@/lib/auth-helpers";

export async function GET() {
  const result = await requireAuth();
  if (result instanceof Response) return result;
  const { user } = result;

  // Admins see all; regular users see only their assigned associations
  const associations = user.role === "admin"
    ? await prisma.association.findMany({
        orderBy: { createdAt: "asc" },
        include: { fiscalYears: { orderBy: { year: "desc" }, take: 1 } },
      })
    : await prisma.association.findMany({
        where: { accesses: { some: { userId: user.id } } },
        orderBy: { createdAt: "asc" },
        include: { fiscalYears: { orderBy: { year: "desc" }, take: 1 } },
      });

  return NextResponse.json(associations);
}

export async function POST(req: NextRequest) {
  const result = await requireAdmin();
  if (result instanceof Response) return result;

  const body = await req.json();
  const { name, type, address, postalCode, city, iban, bic, bankName, contactName, phone, email } = body;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const orgType = type ?? "tiekunta";
  const defaultAccounts = getDefaultAccounts(orgType);

  const association = await prisma.association.create({
    data: {
      name,
      type: orgType,
      address: address ?? "",
      postalCode: postalCode ?? "",
      city: city ?? "",
      iban: iban ?? "",
      bic: bic ?? "",
      bankName: bankName ?? "",
      contactName: contactName ?? "",
      phone: phone ?? "",
      email: email ?? "",
      accounts: {
        create: defaultAccounts.map((a) => ({
          number: a.number,
          name: a.name,
          type: a.type,
          isSystem: true,
        })),
      },
    },
  });

  return NextResponse.json(association, { status: 201 });
}
