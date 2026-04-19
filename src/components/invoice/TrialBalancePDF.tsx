import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 8.5, padding: 40, color: "#111" },
  pageHeader: { marginBottom: 16, borderBottomWidth: 1, borderBottomColor: "#ddd", paddingBottom: 10 },
  assocName: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  subtitle: { fontSize: 9, color: "#555" },
  sectionHeader: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginTop: 6,
  },
  sectionLabel: { flex: 1, fontSize: 8, fontFamily: "Helvetica-Bold", color: "#444", textTransform: "uppercase" },
  tableHeader: {
    flexDirection: "row",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: "#999",
    marginTop: 2,
  },
  colHeaderText: { fontSize: 7.5, color: "#666", fontFamily: "Helvetica-Bold" },
  row: {
    flexDirection: "row",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderBottomWidth: 0.2,
    borderBottomColor: "#e8e8e8",
  },
  subtotalRow: {
    flexDirection: "row",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderTopWidth: 0.5,
    borderTopColor: "#aaa",
    backgroundColor: "#f8f8f8",
  },
  totalRow: {
    flexDirection: "row",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: "#555",
    marginTop: 4,
  },
  colNum: { width: 36 },
  colName: { flex: 1 },
  colAmt: { width: 72, textAlign: "right" },
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

interface Account { id: string; number: string; name: string; type: string; }
interface VoucherLine { debit: number; credit: number; account: Account; }
interface Voucher { lines: VoucherLine[]; }

interface Props {
  vouchers: Voucher[];
  accounts: Account[];
  year: number;
  associationName: string;
}

export function TrialBalancePDF({ vouchers, accounts, year, associationName }: Props) {
  const accountTotals = accounts.map((acc) => {
    let totalDebit = 0;
    let totalCredit = 0;
    for (const v of vouchers) {
      for (const l of v.lines) {
        if (l.account.id === acc.id) {
          totalDebit += l.debit;
          totalCredit += l.credit;
        }
      }
    }
    return { account: acc, totalDebit, totalCredit, net: totalDebit - totalCredit };
  }).filter((r) => r.totalDebit > 0 || r.totalCredit > 0);

  const grandDebit = accountTotals.reduce((s, r) => s + r.totalDebit, 0);
  const grandCredit = accountTotals.reduce((s, r) => s + r.totalCredit, 0);
  const balanced = Math.abs(grandDebit - grandCredit) < 0.01;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.pageHeader}>
          <Text style={styles.assocName}>{associationName}</Text>
          <Text style={styles.subtitle}>Koetase — tilikausi {year}</Text>
        </View>

        {/* Column headers */}
        <View style={styles.tableHeader}>
          <Text style={[styles.colHeaderText, styles.colNum]}>Tilinro</Text>
          <Text style={[styles.colHeaderText, styles.colName]}>Tilin nimi</Text>
          <Text style={[styles.colHeaderText, styles.colAmt]}>Debet</Text>
          <Text style={[styles.colHeaderText, styles.colAmt]}>Kredit</Text>
          <Text style={[styles.colHeaderText, styles.colAmt]}>Saldo</Text>
        </View>

        {TYPE_ORDER.map((type) => {
          const rows = accountTotals
            .filter((r) => r.account.type === type)
            .sort((a, b) => a.account.number.localeCompare(b.account.number));
          if (rows.length === 0) return null;

          const subtotalDebit = rows.reduce((s, r) => s + r.totalDebit, 0);
          const subtotalCredit = rows.reduce((s, r) => s + r.totalCredit, 0);

          return (
            <View key={type}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>{TYPE_LABELS[type]}</Text>
              </View>
              {rows.map((row) => (
                <View key={row.account.id} style={styles.row}>
                  <Text style={styles.colNum}>{row.account.number}</Text>
                  <Text style={styles.colName}>{row.account.name}</Text>
                  <Text style={styles.colAmt}>{eur(row.totalDebit)}</Text>
                  <Text style={styles.colAmt}>{eur(row.totalCredit)}</Text>
                  <Text style={styles.colAmt}>{eur(row.net)}</Text>
                </View>
              ))}
              <View style={styles.subtotalRow}>
                <Text style={[styles.colNum, { fontFamily: "Helvetica-Bold" }]}></Text>
                <Text style={[styles.colName, { fontFamily: "Helvetica-Bold", fontSize: 7.5 }]}>Yhteensä: {TYPE_LABELS[type]}</Text>
                <Text style={[styles.colAmt, { fontFamily: "Helvetica-Bold" }]}>{eur(subtotalDebit)}</Text>
                <Text style={[styles.colAmt, { fontFamily: "Helvetica-Bold" }]}>{eur(subtotalCredit)}</Text>
                <Text style={[styles.colAmt, { fontFamily: "Helvetica-Bold" }]}>{eur(subtotalDebit - subtotalCredit)}</Text>
              </View>
            </View>
          );
        })}

        {/* Grand total */}
        <View style={styles.totalRow}>
          <Text style={[styles.colNum, { fontFamily: "Helvetica-Bold" }]}></Text>
          <Text style={[styles.colName, { fontFamily: "Helvetica-Bold" }]}>
            {balanced ? "✓ Tasapainossa" : "HUOM: Ei tasapainossa"}
          </Text>
          <Text style={[styles.colAmt, { fontFamily: "Helvetica-Bold" }]}>{eur(grandDebit)}</Text>
          <Text style={[styles.colAmt, { fontFamily: "Helvetica-Bold" }]}>{eur(grandCredit)}</Text>
          <Text style={[styles.colAmt, { fontFamily: "Helvetica-Bold" }]}>{eur(grandDebit - grandCredit)}</Text>
        </View>

        <Text style={styles.footer} render={({ pageNumber, totalPages }) => `Sivu ${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
