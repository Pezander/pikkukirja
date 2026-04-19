import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const DB_URL = process.env.DATABASE_URL ?? "file:./dev.db";
const DB_PATH = DB_URL.replace("file:", "");
const absolutePath = path.isAbsolute(DB_PATH) ? DB_PATH : path.resolve(DB_PATH);

function createPrismaClient() {
  const adapter = new PrismaBetterSqlite3({ url: absolutePath });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
