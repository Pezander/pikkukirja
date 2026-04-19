import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 8.5, padding: 40, color: "#111" },

  pageHeader: { marginBottom: 20, borderBottomWidth: 1, borderBottomColor: "#ddd", paddingBottom: 12 },
  assocName: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  subtitle: { fontSize: 9, color: "#555" },

  // Voucher block
  voucherHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: "#ccc",
  },
  voucherNum: { width: 28, fontFamily: "Helvetica-Bold" },
  voucherDate: { width: 56, fontFamily: "Helvetica-Bold" },
  voucherDesc: { flex: 1, fontFamily: "Helvetica-Bold" },

  // Line row
  lineRow: {
    flexDirection: "row",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderBottomWidth: 0.2,
    borderBottomColor: "#e8e8e8",
  },
  lineIndent: { width: 28 },
  lineAccount: { width: 80 },
  lineAccountName: { flex: 1 },
  lineAmount: { width: 68, textAlign: "right", fontFamily: "Helvetica" },
  lineAmountBold: { width: 68, textAlign: "right", fontFamily: "Helvetica-Bold" },

  // Column headers
  tableHeader: {
    flexDirection: "row",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: "#999",
    marginTop: 4,
  },
  colHeaderText: { fontSize: 7.5, color: "#666", fontFamily: "Helvetica-Bold" },

  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 7.5, color: "#aaa", textAlign: "center" },
});

function eur(n: number) {
  if (n === 0) return "";
  const sign = n < 0 ? "-" : "";
  return sign + Math.abs(n).toFixed(2).replace(".", ",") + " €";
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("fi-FI", { day: "2-digit", month: "2-digit", year: "numeric" });
}

interface Account { id: string; number: string; name: string; type: string; }
interface VoucherLine { debit: number; credit: number; note: string; account: Account; }
interface Voucher { id: string; number: number; date: string; description: string; lines: VoucherLine[]; }

interface Props {
  vouchers: Voucher[];
  year: number;
  associationName: string;
}

export function JournalPDF({ vouchers, year, associationName }: Props) {
  const sorted = [...vouchers].sort((a, b) => a.number - b.number);
  const totalDebit = sorted.flatMap((v) => v.lines).reduce((s, l) => s + l.debit, 0);
  const totalCredit = sorted.flatMap((v) => v.lines).reduce((s, l) => s + l.credit, 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.pageHeader}>
          <Text style={styles.assocName}>{associationName}</Text>
          <Text style={styles.subtitle}>Kirjanpitopäiväkirja · Tilikausi 1.1.{year}–31.12.{year}</Text>
        </View>

        {/* Column labels */}
        <View style={styles.tableHeader}>
          <Text style={[styles.colHeaderText, { width: 28 }]}>NRO</Text>
          <Text style={[styles.colHeaderText, { width: 56 }]}>PVM</Text>
          <Text style={[styles.colHeaderText, { flex: 1 }]}>KUVAUS / TILI</Text>
          <Text style={[styles.colHeaderText, { width: 68, textAlign: "right" }]}>DEBET</Text>
          <Text style={[styles.colHeaderText, { width: 68, textAlign: "right" }]}>KREDIT</Text>
        </View>

        {sorted.map((v) => (
          <View key={v.id} wrap={false}>
            {/* Voucher header row */}
            <View style={styles.voucherHeader}>
              <Text style={styles.voucherNum}>{v.number}</Text>
              <Text style={styles.voucherDate}>{fmtDate(v.date)}</Text>
              <Text style={styles.voucherDesc}>{v.description}</Text>
            </View>

            {/* Lines */}
            {v.lines.map((l, i) => (
              <View key={i} style={styles.lineRow}>
                <Text style={styles.lineIndent} />
                <Text style={styles.lineAccount}>{l.account.number} {l.account.name}</Text>
                <Text style={styles.lineAccountName}>
                  {l.note ? `  ${l.note}` : ""}
                </Text>
                <Text style={styles.lineAmount}>{l.debit > 0 ? eur(l.debit) : ""}</Text>
                <Text style={styles.lineAmount}>{l.credit > 0 ? eur(l.credit) : ""}</Text>
              </View>
            ))}
          </View>
        ))}

        {/* Grand totals */}
        {sorted.length > 0 && (
          <View style={{ flexDirection: "row", paddingHorizontal: 6, paddingVertical: 5, marginTop: 8, borderTopWidth: 0.8, borderTopColor: "#888" }}>
            <Text style={{ flex: 1, fontFamily: "Helvetica-Bold", fontSize: 8.5 }}>Yhteensä</Text>
            <Text style={styles.lineAmountBold}>{eur(totalDebit)}</Text>
            <Text style={styles.lineAmountBold}>{eur(totalCredit)}</Text>
          </View>
        )}

        {sorted.length === 0 && (
          <Text style={{ marginTop: 24, color: "#999", textAlign: "center" }}>Ei tositteita.</Text>
        )}

        <Text style={styles.footer}>
          {associationName} · Kirjanpitopäiväkirja {year} · {sorted.length} tositetta
        </Text>
      </Page>
    </Document>
  );
}
