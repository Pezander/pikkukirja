// Finnish bank CSV parser — handles common formats (OP, Nordea, S-Pankki, Aktia)

export interface ParsedTransaction {
  date: string;        // ISO date "YYYY-MM-DD"
  amount: number;      // positive = credit, negative = debit
  description: string;
  reference: string;
  archiveId: string;
}

/** Try to parse a date string in Finnish formats: DD.MM.YYYY or YYYY-MM-DD */
function parseDate(s: string): string | null {
  const trimmed = s.trim();
  // DD.MM.YYYY
  const fi = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (fi) return `${fi[3]}-${fi[2].padStart(2, "0")}-${fi[1].padStart(2, "0")}`;
  // YYYY-MM-DD
  const iso = trimmed.match(/^\d{4}-\d{2}-\d{2}$/);
  if (iso) return trimmed;
  // YYYY/MM/DD (Nordea)
  const slashed = trimmed.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (slashed) return `${slashed[1]}-${slashed[2]}-${slashed[3]}`;
  return null;
}

/** Parse Finnish decimal: "1 234,56" or "1234.56" → number */
function parseAmount(s: string): number {
  const cleaned = s.trim().replace(/\s/g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

function splitCsv(line: string, sep: string): string[] {
  const cols: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (!inQuotes && line.slice(i, i + sep.length) === sep) {
      cols.push(cur.trim()); cur = ""; i += sep.length - 1;
    } else {
      cur += ch;
    }
  }
  cols.push(cur.trim());
  return cols;
}

function detectSeparator(line: string): string {
  if (line.includes(";")) return ";";
  if (line.includes("\t")) return "\t";
  return ",";
}

/** Map header names to column indices */
function mapHeaders(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    const norm = h.toLowerCase().replace(/[^a-zäöå0-9]/g, "");
    map[norm] = i;
  });
  return map;
}

/** Find first index where any key from candidates exists */
function findCol(map: Record<string, number>, ...candidates: string[]): number {
  for (const c of candidates) {
    if (map[c] !== undefined) return map[c];
  }
  return -1;
}

export function parseFinnishBankCsv(content: string): ParsedTransaction[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Find the header line — first line that contains date-like column name
  let headerIdx = 0;
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const low = lines[i].toLowerCase();
    if (
      low.includes("päivä") || low.includes("paivamaara") || low.includes("date") ||
      low.includes("kirjauspäivä") || low.includes("arvopäivä")
    ) {
      headerIdx = i;
      break;
    }
  }

  const sep = detectSeparator(lines[headerIdx]);
  const headers = splitCsv(lines[headerIdx], sep);
  const m = mapHeaders(headers);

  const dateCol = findCol(m, "kirjauspäivä", "kirjauspaiva", "päivämäärä", "paivamaara", "date", "arvopäivä", "arvopaiva", "päivä", "paiva");
  const amountCol = findCol(m, "määrä", "maara", "summa", "amount", "tapahtuma", "tapahtumasumma");
  const descCol = findCol(m, "saaja/maksaja", "saajamaksaja", "maksaja", "saaja", "viesti", "selite", "message", "description", "tapahtumaselite", "selitys", "nimi");
  const refCol = findCol(m, "viite", "viitenumero", "reference", "viiteno", "viiteviesti");
  const archiveCol = findCol(m, "arkistotunnus", "arkisto", "archive", "arkistonumero");

  const txns: ParsedTransaction[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = splitCsv(lines[i], sep);
    if (cols.length < 2) continue;

    const rawDate = dateCol >= 0 ? cols[dateCol] ?? "" : cols[0];
    const date = parseDate(rawDate);
    if (!date) continue;

    const rawAmount = amountCol >= 0 ? cols[amountCol] ?? "" : "";
    const amount = parseAmount(rawAmount);
    if (amount === 0 && rawAmount !== "0" && rawAmount !== "0,00") continue;

    const description = descCol >= 0 ? cols[descCol] ?? "" : "";
    const reference = refCol >= 0 ? cols[refCol] ?? "" : "";
    const archiveId = archiveCol >= 0 ? cols[archiveCol] ?? "" : "";

    txns.push({ date, amount, description: description.trim(), reference: reference.trim(), archiveId: archiveId.trim() });
  }

  return txns;
}
