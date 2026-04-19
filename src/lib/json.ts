/**
 * NextResponse.json() uses JSON.stringify which cannot serialize BigInt.
 * The better-sqlite3 Prisma adapter enables defaultSafeIntegers(true),
 * so INTEGER columns come back as BigInt. Use this helper instead.
 */
export function jsonResponse(data: unknown, init?: ResponseInit): Response {
  const body = JSON.stringify(data, (_, v) =>
    typeof v === "bigint" ? Number(v) : v
  );
  return new Response(body, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
}
