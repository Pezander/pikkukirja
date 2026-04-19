import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 8.5, padding: 40, color: "#111" },
  pageHeader: { marginBottom: 16, borderBottomWidth: 1, borderBottomColor: "#ddd", paddingBottom: 10 },
  assocName: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  subtitle: { fontSize: 9, color: "#555" },

  accountHeader: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: "#bbb",
  },
  accountNum: { width: 36, fontFamily: "Helvetica-Bold" },
  accountName: { flex: 1, fontFamily: "Helvetica-Bold" },
  accountBalance: { width: 80, textAlign: "right", fontFamily: "Helvetica-Bold", fontSize: 8 },

  colHeader: {
    flexDirection: "row",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: "#ccc",
  },
  colHeaderText: { fontSize: 7.5, color: "#666", fontFamily: "Helvetica-Bold" },

  row: {
    flexDirection: "row",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderBottomWidth: 0.2,
    borderBottomColor: "#eee",
  },

  colDate: { width: 48 },
  colVoucher: { width: 30 },
  colDesc: { flex: 1 },
  colAmt: { width: 60, textAlign: "right" },

  subtotalRow: {
    flexDirection: "row",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderTopWidth: 0.5,
    borderTopColor: "#aaa",
    backgroundColor: "#f8f8f8",
  },

  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 7.5, color: "#aaa", textAlign: "center" },
});

const TYPE_ORDER = ["asset", "liability", "equity", "income", "expense"];
const TYPE_LABELS: Record<string, string> = {
  asset: "Vastaavaa",
  liability: "Vastattavaa",
  equity: "Oma pääoma",
  income: "Tulot",
  expense: "Menot",
};

function eur(n: number) {
  if (n === 0) return "–";
  return n.toFixed(2).replace(".", ",") + " €";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fi-FI");
}

interface Account { id: string; number: string; name: string; type: string; }
interface VoucherLine { debit: number; credit: number; account: Account; }
interface Voucher { number: number; date: string; description: string; lines: VoucherLine[]; }

interface LedgerEntry { date: string; voucherNumber: number; description: string; debit: number; credit: number; balance: number; }
interface AccountSummary { account: Account; totalDebit: number; totalCredit: number; balance: number; entries: LedgerEntry[]; }

interface Props {
  summary: AccountSummary[];
  associationName: string;
  year: number;
}

export function LedgerPDF({ summary, associationName, year }: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.pageHeader}>
          <Text style={styles.assocName}>{associationName}</Text>
          <Text style={styles.subtitle}>Pääkirja — tilikausi {year}</Text>
        </View>

        {TYPE_ORDER.map((type) => {
          const items = summary.filter((s) => s.account.type === type);
          if (items.length === 0) return null;

          return (
            <View key={type}>
              <View style={{ backgroundColor: "#e8e8e8", paddingHorizontal: 6, paddingVertical: 2, marginTop: 8 }}>
                <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: "#333", textTransform: "uppercase" }}>
                  {TYPE_LABELS[type]}
                </Text>
              </View>

              {items.sort((a, b) => a.account.number.localeCompare(b.account.number)).map((item) => (
                <View key={item.account.id}>
                  <View style={styles.accountHeader}>
                    <Text style={styles.accountNum}>{item.account.number}</Text>
                    <Text style={styles.accountName}>{item.account.name}</Text>
                    <Text style={styles.accountBalance}>
                      {eur(Math.abs(item.balance))} {item.balance >= 0 ? "D" : "K"}
                    </Text>
                  </View>

                  <View style={styles.colHeader}>
                    <Text style={[styles.colHeaderText, styles.colDate]}>Päivä</Text>
                    <Text style={[styles.colHeaderText, styles.colVoucher]}>Tosite</Text>
                    <Text style={[styles.colHeaderText, styles.colDesc]}>Kuvaus</Text>
                    <Text style={[styles.colHeaderText, styles.colAmt]}>Debet</Text>
                    <Text style={[styles.colHeaderText, styles.colAmt]}>Kredit</Text>
                    <Text style={[styles.colHeaderText, styles.colAmt]}>Saldo</Text>
                  </View>

                  {item.entries.map((e, i) => (
                    <View key={i} style={styles.row}>
                      <Text style={styles.colDate}>{fmtDate(e.date)}</Text>
                      <Text style={styles.colVoucher}>#{e.voucherNumber}</Text>
                      <Text style={styles.colDesc}>{e.description}</Text>
                      <Text style={styles.colAmt}>{e.debit > 0 ? eur(e.debit) : ""}</Text>
                      <Text style={styles.colAmt}>{e.credit > 0 ? eur(e.credit) : ""}</Text>
                      <Text style={[styles.colAmt, { fontFamily: "Helvetica-Bold" }]}>{eur(Math.abs(e.balance))}</Text>
                    </View>
                  ))}

                  <View style={styles.subtotalRow}>
                    <Text style={[{ flex: 1, fontSize: 7.5, color: "#555" }]}>
                      Yhteensä: D {eur(item.totalDebit)}  K {eur(item.totalCredit)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          );
        })}

        <Text style={styles.footer} render={({ pageNumber, totalPages }) => `Sivu ${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}

export type { AccountSummary };
export function buildLedgerSummary(vouchers: Voucher[], accounts: Account[]): AccountSummary[] {
  return accounts.map((acc) => {
    let totalDebit = 0;
    let totalCredit = 0;
    const entries: LedgerEntry[] = [];
    let running = 0;

    for (const v of [...vouchers].sort((a, b) => a.number - b.number)) {
      for (const line of v.lines) {
        if (line.account.id === acc.id) {
          totalDebit += line.debit;
          totalCredit += line.credit;
          running += line.debit - line.credit;
          entries.push({
            date: v.date,
            voucherNumber: v.number,
            description: v.description,
            debit: line.debit,
            credit: line.credit,
            balance: running,
          });
        }
      }
    }

    return { account: acc, totalDebit, totalCredit, balance: totalDebit - totalCredit, entries };
  }).filter((s) => s.totalDebit > 0 || s.totalCredit > 0);
}
