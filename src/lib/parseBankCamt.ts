// CAMT.053 XML parser (ISO 20022 bank-to-customer statement)
// Handles the most common Finnish bank CAMT.053 structures

import { XMLParser } from "fast-xml-parser";
import type { ParsedTransaction } from "./parseBankCsv";

export function parseCamt053(content: string): ParsedTransaction[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", parseAttributeValue: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let doc: any;
  try {
    doc = parser.parse(content);
  } catch {
    return [];
  }

  // Navigate: Document > BkToCstmrStmt > Stmt > Ntry[]
  const root =
    doc?.Document?.BkToCstmrStmt?.Stmt ??
    doc?.["xmlns:Document"]?.BkToCstmrStmt?.Stmt ??
    doc?.BkToCstmrStmt?.Stmt;

  if (!root) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stmts: any[] = Array.isArray(root) ? root : [root];
  const txns: ParsedTransaction[] = [];

  for (const stmt of stmts) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entries: any[] = Array.isArray(stmt.Ntry) ? stmt.Ntry : stmt.Ntry ? [stmt.Ntry] : [];

    for (const entry of entries) {
      const rawDate: string =
        entry.BookgDt?.Dt ?? entry.ValDt?.Dt ?? entry.BookgDt?.DtTm?.split("T")[0] ?? "";
      if (!rawDate) continue;

      const amtNode = entry.Amt;
      let amount = parseFloat(String(amtNode?.["#text"] ?? amtNode ?? 0)) || 0;
      const cdtDbt: string = entry.CdtDbtInd ?? "";
      if (cdtDbt === "DBIT") amount = -Math.abs(amount);
      else amount = Math.abs(amount);

      // Description: try TxDtls first, then AddtlNtryInf
      let description = String(entry.AddtlNtryInf ?? "");
      let reference = "";
      let archiveId = String(entry.AcctSvcrRef ?? "");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const details: any[] = Array.isArray(entry.NtryDtls?.TxDtls)
        ? entry.NtryDtls.TxDtls
        : entry.NtryDtls?.TxDtls
          ? [entry.NtryDtls.TxDtls]
          : [];

      for (const txd of details) {
        const remInfo = txd.RmtInf;
        if (remInfo?.Ustrd) {
          const ustrd = Array.isArray(remInfo.Ustrd) ? remInfo.Ustrd.join(" ") : String(remInfo.Ustrd);
          if (ustrd) description = description || ustrd;
        }
        if (remInfo?.Strd?.CdtrRefInf?.Ref) {
          reference = String(remInfo.Strd.CdtrRefInf.Ref);
        }
        // Counterparty name
        const rltdPty = txd.RltdPties;
        if (!description) {
          const cdtrName = rltdPty?.Cdtr?.Nm ?? rltdPty?.Dbtr?.Nm;
          if (cdtrName) description = String(cdtrName);
        }
        if (!archiveId && txd.Refs?.AcctSvcrRef) archiveId = String(txd.Refs.AcctSvcrRef);
      }

      txns.push({
        date: rawDate.slice(0, 10),
        amount,
        description: description.trim(),
        reference: reference.trim(),
        archiveId: archiveId.trim(),
      });
    }
  }

  return txns;
}
