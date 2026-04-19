/**
 * Import a Tappio/Holli .tlk bookkeeping file into pikkukirja.
 *
 * Usage:
 *   npx tsx scripts/import-tlk.ts <association-id> <path-to.tlk>
 *
 * The association must already exist. You can find its ID in the app's URL or
 * by running:  npx tsx scripts/import-tlk.ts --list-associations
 *
 * What gets imported:
 *  - One FiscalYear (year extracted from the fiscal-year name/dates)
 *  - All numbered accounts from the account-map (group accounts with id -1 are skipped)
 *  - All events as Vouchers + VoucherLines
 *
 * Money in .tlk files is stored as integer cents.
 * Positive .tlk amount → debit entry; negative → credit entry.
 *
 * Run with --dry-run to preview without writing to the database.
 */

import path from "path";
import fs from "fs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// ── DB setup ─────────────────────────────────────────────────────────────────

const DB_PATH = path.resolve(__dirname, "../dev.db");
const adapter = new PrismaBetterSqlite3({ url: DB_PATH });
const prisma = new PrismaClient({ adapter });

// ── S-expression tokeniser & parser ──────────────────────────────────────────

type SExpr = string | SExpr[];

function tokenise(src: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") { i++; continue; }
    if (ch === "(" || ch === ")") { tokens.push(ch); i++; continue; }
    if (ch === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== '"') {
        if (src[j] === "\\") j++;
        j++;
      }
      tokens.push(src.slice(i, j + 1));
      i = j + 1;
      continue;
    }
    // bare atom
    let j = i;
    while (j < src.length && !/[\s()"]/.test(src[j])) j++;
    tokens.push(src.slice(i, j));
    i = j;
  }
  return tokens;
}

function parse(tokens: string[]): SExpr {
  let pos = 0;

  function readExpr(): SExpr {
    if (tokens[pos] === "(") {
      pos++; // consume "("
      const list: SExpr[] = [];
      while (tokens[pos] !== ")") {
        list.push(readExpr());
      }
      pos++; // consume ")"
      return list;
    }
    const tok = tokens[pos++];
    if (tok.startsWith('"')) return tok.slice(1, -1); // strip quotes
    return tok;
  }

  return readExpr();
}

function parseFile(src: string): SExpr {
  return parse(tokenise(src));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function str(e: SExpr): string {
  if (typeof e === "string") return e;
  throw new Error(`Expected string, got list: ${JSON.stringify(e)}`);
}

function lst(e: SExpr): SExpr[] {
  if (Array.isArray(e)) return e;
  throw new Error(`Expected list, got string: ${e}`);
}

function num(e: SExpr): number {
  const n = parseInt(str(e), 10);
  if (isNaN(n)) throw new Error(`Expected number, got: ${e}`);
  return n;
}

/** Find the value after a keyword in a flat list: (key value ...) */
function after(list: SExpr[], key: string): SExpr | undefined {
  for (let i = 0; i < list.length - 1; i++) {
    if (list[i] === key) return list[i + 1];
  }
  return undefined;
}

// ── Account type inference ────────────────────────────────────────────────────

function accountType(accountNum: number): "asset" | "liability" | "equity" | "income" | "expense" {
  if (accountNum >= 100 && accountNum < 200) return "asset";
  if (accountNum >= 200 && accountNum < 300) return "liability";
  if (accountNum >= 220 && accountNum < 250) return "equity"; // 222, 240
  if (accountNum >= 300 && accountNum < 400) return "income";
  if (accountNum >= 400 && accountNum < 500) return "expense";
  if (accountNum === 999) return "equity";
  return "asset";
}

// ── TLK data structures ───────────────────────────────────────────────────────

interface TlkAccount {
  number: number; // -1 means a group header (no account)
  name: string;
  children: TlkAccount[];
}

interface TlkLine {
  accountNumber: number;
  cents: number; // positive = debit, negative = credit
}

interface TlkEvent {
  id: number;
  year: number;
  month: number;
  day: number;
  description: string;
  lines: TlkLine[];
}

interface TlkFile {
  fiscalYearName: string;
  startDate: { year: number; month: number; day: number };
  endDate: { year: number; month: number; day: number };
  accounts: TlkAccount[];
  events: TlkEvent[];
}

// ── Parser for TLK structure ──────────────────────────────────────────────────

function parseDate(expr: SExpr): { year: number; month: number; day: number } {
  const l = lst(expr);
  // (date year month day)
  return { year: num(l[1]), month: num(l[2]), day: num(l[3]) };
}

function parseAccount(expr: SExpr): TlkAccount {
  const l = lst(expr);
  // (account id "name" (children...))
  const number = num(l[1]);
  const name = str(l[2]);
  const childrenExpr = lst(l[3]);
  const children = childrenExpr.map(parseAccount);
  return { number, name, children };
}

function flattenAccounts(accounts: TlkAccount[]): TlkAccount[] {
  const result: TlkAccount[] = [];
  for (const a of accounts) {
    if (a.number !== -1) result.push(a);
    result.push(...flattenAccounts(a.children));
  }
  return result;
}

function parseEvent(expr: SExpr): TlkEvent {
  const l = lst(expr);
  // (event id (date ...) "desc" ((accountId (money cents)) ...))
  const id = num(l[1]);
  const date = parseDate(l[2]);
  const description = str(l[3]);
  const linesExpr = lst(l[4]);

  const lines: TlkLine[] = linesExpr.map((lineExpr) => {
    const ll = lst(lineExpr);
    const accountNumber = num(ll[0]);
    const moneyExpr = lst(ll[1]); // (money cents)
    const cents = num(moneyExpr[1]);
    return { accountNumber, cents };
  });

  return { id, year: date.year, month: date.month, day: date.day, description, lines };
}

function parseTlk(src: string): TlkFile {
  const root = lst(parseFile(src));
  // root: (identity "Tappio" version "..." finances (...))
  const financesExpr = after(root, "finances");
  if (!financesExpr) throw new Error("No 'finances' key found");

  const fiscalYearExpr = lst(financesExpr);
  // fiscalYearExpr: (fiscal-year "name" (date ...) (date ...) (account-map ...) ((events...)))
  const fiscalYearName = str(fiscalYearExpr[1]);
  const startDate = parseDate(fiscalYearExpr[2]);
  const endDate = parseDate(fiscalYearExpr[3]);

  // fiscalYearExpr[4] is the (account-map ...) list
  const accountMapList = lst(fiscalYearExpr[4]);
  // accountMapList[0] = "account-map", rest are the top-level account groups
  const topAccounts = accountMapList.slice(1).map(parseAccount);

  // fiscalYearExpr[5] is the flat list of events: ((event 0 ...) (event 1 ...) ...)
  const eventsListExpr = lst(fiscalYearExpr[5]);
  const events = eventsListExpr.map(parseEvent);

  return { fiscalYearName, startDate, endDate, accounts: topAccounts, events };
}

// ── Import logic ──────────────────────────────────────────────────────────────

async function listAssociations() {
  const assocs = await prisma.association.findMany({ select: { id: true, name: true } });
  console.log("Associations in database:");
  for (const a of assocs) {
    console.log(`  ${a.id}  ${a.name}`);
  }
}

async function importTlk(associationId: string, tlkPath: string, dryRun: boolean) {
  const src = fs.readFileSync(tlkPath, "latin1"); // Holli files use Latin-1
  const tlk = parseTlk(src);
  const year = tlk.startDate.year;

  console.log(`\nParsed: ${tlk.fiscalYearName}`);
  console.log(`  Fiscal year: ${year}`);
  console.log(`  Accounts: ${flattenAccounts(tlk.accounts).length}`);
  console.log(`  Events: ${tlk.events.length}`);

  if (dryRun) {
    console.log("\n[DRY RUN] First 5 events:");
    for (const ev of tlk.events.slice(0, 5)) {
      console.log(`  ${ev.year}-${ev.month.toString().padStart(2,"0")}-${ev.day.toString().padStart(2,"0")} ${ev.description}`);
      for (const l of ev.lines) {
        const euros = (l.cents / 100).toFixed(2);
        const side = l.cents >= 0 ? `debit  ${euros}` : `credit ${Math.abs(l.cents / 100).toFixed(2)}`;
        console.log(`    acct ${l.accountNumber}: ${side}`);
      }
    }
    console.log("\n[DRY RUN] No changes written.");
    return;
  }

  // ── 1. Ensure FiscalYear exists ────────────────────────────────────────────
  let fiscalYear = await prisma.fiscalYear.findUnique({
    where: { associationId_year: { associationId, year } },
  });

  if (fiscalYear) {
    console.log(`FiscalYear ${year} already exists (id=${fiscalYear.id}), skipping creation.`);
  } else {
    fiscalYear = await prisma.fiscalYear.create({
      data: {
        associationId,
        year,
        status: "closed",
      },
    });
    console.log(`Created FiscalYear ${year} (id=${fiscalYear.id})`);
  }

  // ── 2. Upsert accounts ────────────────────────────────────────────────────
  const flatAccounts = flattenAccounts(tlk.accounts);
  const accountIdMap: Record<number, string> = {}; // tlk number → db id

  for (const a of flatAccounts) {
    const number = String(a.number);
    const type = accountType(a.number);
    const existing = await prisma.account.findUnique({
      where: { associationId_number: { associationId, number } },
    });
    if (existing) {
      accountIdMap[a.number] = existing.id;
    } else {
      const created = await prisma.account.create({
        data: { associationId, number, name: a.name.trim(), type },
      });
      accountIdMap[a.number] = created.id;
      console.log(`  Created account ${number} "${a.name.trim()}" (${type})`);
    }
  }

  // ── 3. Import events as Vouchers ─────────────────────────────────────────
  let created = 0;
  let skipped = 0;

  for (const ev of tlk.events) {
    // Check if a voucher with this number already exists
    const existing = await prisma.voucher.findUnique({
      where: { fiscalYearId_number: { fiscalYearId: fiscalYear.id, number: ev.id + 1 } },
    });
    if (existing) { skipped++; continue; }

    const date = new Date(ev.year, ev.month - 1, ev.day);

    await prisma.voucher.create({
      data: {
        fiscalYearId: fiscalYear.id,
        number: ev.id + 1, // 1-based
        date,
        description: ev.description,
        lines: {
          create: ev.lines
            .filter((l) => l.accountNumber in accountIdMap)
            .map((l) => ({
              accountId: accountIdMap[l.accountNumber],
              debit: l.cents > 0 ? l.cents / 100 : 0,
              credit: l.cents < 0 ? Math.abs(l.cents) / 100 : 0,
            })),
        },
      },
    });
    created++;
  }

  console.log(`\nDone. Vouchers created: ${created}, skipped (already exist): ${skipped}`);
}

// ── CLI entry point ───────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--list-associations")) {
    await listAssociations();
    return;
  }

  const dryRun = args.includes("--dry-run");
  const rest = args.filter((a) => !a.startsWith("--"));

  if (rest.length < 2) {
    console.error("Usage: npx tsx scripts/import-tlk.ts <association-id> <path-to.tlk> [--dry-run]");
    console.error("       npx tsx scripts/import-tlk.ts --list-associations");
    process.exit(1);
  }

  const [associationId, tlkPath] = rest;

  if (!fs.existsSync(tlkPath)) {
    console.error(`File not found: ${tlkPath}`);
    process.exit(1);
  }

  await importTlk(associationId, tlkPath, dryRun);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
