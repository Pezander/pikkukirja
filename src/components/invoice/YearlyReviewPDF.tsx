import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9.5, padding: 48, color: "#111" },

  // Cover / header
  pageHeader: { marginBottom: 28, borderBottomWidth: 1, borderBottomColor: "#ddd", paddingBottom: 16 },
  assocName: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  subtitle: { fontSize: 10, color: "#555" },

  sectionTitle: {
    fontSize: 11, fontFamily: "Helvetica-Bold",
    marginBottom: 8, marginTop: 20,
    paddingBottom: 4, borderBottomWidth: 0.5, borderBottomColor: "#bbb",
  },

  // Tables
  row: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 0.3, borderBottomColor: "#e5e5e5" },
  rowBold: { flexDirection: "row", paddingVertical: 4, borderTopWidth: 0.5, borderTopColor: "#999", marginTop: 2 },
  rowSection: { flexDirection: "row", paddingVertical: 5 },
  colLabel: { flex: 1, paddingLeft: 0 },
  colLabelIndent: { flex: 1, paddingLeft: 12 },
  colAmt: { width: 90, textAlign: "right", fontFamily: "Helvetica" },
  colAmtBold: { width: 90, textAlign: "right", fontFamily: "Helvetica-Bold" },
  sectionLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#555", textTransform: "uppercase", letterSpacing: 0.5, paddingVertical: 4 },

  twoCol: { flexDirection: "row", gap: 24 },
  halfCol: { flex: 1 },

  // Footer
  footer: { position: "absolute", bottom: 28, left: 48, right: 48, fontSize: 8, color: "#aaa", textAlign: "center" },
});

function eur(n: number) {
  const sign = n < 0 ? "-" : " ";
  return sign + Math.abs(n).toFixed(2).replace(".", ",") + " €";
}

interface Account { id: string; number: string; name: string; type: string; }
interface VoucherLine { debit: number; credit: number; account: Account; }
interface Voucher { lines: VoucherLine[]; }
interface Association { name: string; type?: string; iban: string; bankName: string; contactName: string; }

function netOf(vouchers: Voucher[], ids: Set<string>) {
  let d = 0, c = 0;
  for (const v of vouchers) for (const l of v.lines) if (ids.has(l.account.id)) { d += l.debit; c += l.credit; }
  return { debit: d, credit: c, net: d - c };
}

function byType(accounts: Account[], type: string) {
  return new Set(accounts.filter((a) => a.type === type).map((a) => a.id));
}

function byPrefix(accounts: Account[], ...prefixes: string[]) {
  return new Set(accounts.filter((a) => prefixes.some((p) => a.number.startsWith(p))).map((a) => a.id));
}

interface IncomeRow { label: string; amount: number; indent?: boolean; bold?: boolean; sep?: boolean; }

const PDF_PRIMARY_INCOME: Record<string, string> = {
  tiekunta: "Yksikkömaksut",
  metsastysseura: "Jäsenmaksutulot",
  taloyhtio: "Hoitovastike",
  toiminimi: "Myyntitulot",
};

const PDF_MAINTENANCE: Record<string, string> = {
  tiekunta: "Tien kunnossapito",
  metsastysseura: "Toimintakulut",
  taloyhtio: "Kiinteistön hoitokulut",
  toiminimi: "Toimintakulut",
};

function incomeRows(vouchers: Voucher[], accounts: Account[], orgType: string): IncomeRow[] {
  const primaryIncomeLabel = PDF_PRIMARY_INCOME[orgType] ?? PDF_PRIMARY_INCOME.tiekunta;
  const maintenanceLabel = PDF_MAINTENANCE[orgType] ?? PDF_MAINTENANCE.tiekunta;
  const inc = byType(accounts, "income");
  const exp = byType(accounts, "expense");
  const totalIncome = netOf(vouchers, inc).credit - netOf(vouchers, inc).debit;
  const totalExpenses = netOf(vouchers, exp).debit - netOf(vouchers, exp).credit;
  const result = totalIncome - totalExpenses;

  const memberFees = netOf(vouchers, byPrefix(accounts, "310")).credit - netOf(vouchers, byPrefix(accounts, "310")).debit;
  const grants = netOf(vouchers, byPrefix(accounts, "311")).credit - netOf(vouchers, byPrefix(accounts, "311")).debit;
  const adminInc = netOf(vouchers, byPrefix(accounts, "315")).credit - netOf(vouchers, byPrefix(accounts, "315")).debit;
  const otherInc = totalIncome - memberFees - grants - adminInc;
  const maintenance = netOf(vouchers, byPrefix(accounts, "41")).debit - netOf(vouchers, byPrefix(accounts, "41")).credit;
  const bankFees = netOf(vouchers, byPrefix(accounts, "406")).debit - netOf(vouchers, byPrefix(accounts, "406")).credit;
  const otherExp = totalExpenses - maintenance - bankFees;

  const rows: IncomeRow[] = [
    { label: "TULOT", amount: 0, bold: true },
    { label: primaryIncomeLabel, amount: memberFees, indent: true },
    { label: "Avustukset", amount: grants, indent: true },
    { label: "Tilinhoitotulot", amount: adminInc, indent: true },
    ...(otherInc !== 0 ? [{ label: "Muut tulot", amount: otherInc, indent: true }] : []),
    { label: "Tulot yhteensä", amount: totalIncome, bold: true, sep: true },
    { label: "MENOT", amount: 0, bold: true },
    { label: maintenanceLabel, amount: maintenance, indent: true },
    { label: "Pankkipalvelumaksut", amount: bankFees, indent: true },
    ...(otherExp !== 0 ? [{ label: "Muut menot", amount: otherExp, indent: true }] : []),
    { label: "Menot yhteensä", amount: totalExpenses, bold: true, sep: true },
    { label: result >= 0 ? "TILIKAUDEN YLIJÄÄMÄ" : "TILIKAUDEN ALIJÄÄMÄ", amount: result, bold: true },
  ];
  return rows;
}

interface Props {
  vouchers: Voucher[];
  accounts: Account[];
  year: number;
  association: Association;
}

export function YearlyReviewPDF({ vouchers, accounts, year, association }: Props) {
  const inc = byType(accounts, "income");
  const exp = byType(accounts, "expense");
  const totalIncome = netOf(vouchers, inc).credit - netOf(vouchers, inc).debit;
  const totalExpenses = netOf(vouchers, exp).debit - netOf(vouchers, exp).credit;
  const currentResult = totalIncome - totalExpenses;

  // Balance sheet values
  const bank = netOf(vouchers, byPrefix(accounts, "100")).net;
  const receivables = netOf(vouchers, byPrefix(accounts, "111")).net;
  const totalAssets = bank + receivables;
  const liabilityNet = netOf(vouchers, byType(accounts, "liability")).net;
  const totalLiabilities = -liabilityNet;
  const retainedEarnings = -netOf(vouchers, byPrefix(accounts, "222")).net;
  const totalEquity = retainedEarnings + currentResult;
  const totalLiabAndEq = totalLiabilities + totalEquity;

  const rows = incomeRows(vouchers, accounts, association.type ?? "tiekunta");

  function renderIncomeRow(r: IncomeRow, i: number) {
    if (r.bold && r.amount === 0) {
      return (
        <View key={i} style={styles.rowSection}>
          <Text style={[styles.colLabel, { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#555", textTransform: "uppercase" }]}>{r.label}</Text>
        </View>
      );
    }
    const RowStyle = r.bold ? styles.rowBold : styles.row;
    return (
      <View key={i} style={RowStyle}>
        <Text style={r.indent ? styles.colLabelIndent : styles.colLabel}>{r.label}</Text>
        <Text style={r.bold ? styles.colAmtBold : styles.colAmt}>{eur(r.amount ?? 0)}</Text>
      </View>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Page header */}
        <View style={styles.pageHeader}>
          <Text style={styles.assocName}>{association.name}</Text>
          <Text style={styles.subtitle}>Tilinpäätös · Tilikausi 1.1.{year}–31.12.{year}</Text>
        </View>

        {/* Tuloslaskelma */}
        <Text style={styles.sectionTitle}>TULOSLASKELMA</Text>
        {rows.map(renderIncomeRow)}

        {/* Tase – side by side */}
        <Text style={styles.sectionTitle}>TASE 31.12.{year}</Text>
        <View style={styles.twoCol}>
          {/* Vastaavaa */}
          <View style={styles.halfCol}>
            <Text style={styles.sectionLabel}>Vastaavaa</Text>
            <View style={styles.rowSection}>
              <Text style={[styles.colLabel, { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#555", textTransform: "uppercase" }]}>Vaihtuvat vastaavat</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.colLabelIndent}>Pankkitili</Text>
              <Text style={styles.colAmt}>{eur(bank)}</Text>
            </View>
            {receivables !== 0 && (
              <View style={styles.row}>
                <Text style={styles.colLabelIndent}>Siirtosaamiset</Text>
                <Text style={styles.colAmt}>{eur(receivables)}</Text>
              </View>
            )}
            <View style={styles.rowBold}>
              <Text style={styles.colLabel}>Vastaavaa yhteensä</Text>
              <Text style={styles.colAmtBold}>{eur(totalAssets)}</Text>
            </View>
          </View>

          {/* Vastattavaa */}
          <View style={styles.halfCol}>
            <Text style={styles.sectionLabel}>Vastattavaa</Text>
            <View style={styles.rowSection}>
              <Text style={[styles.colLabel, { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#555", textTransform: "uppercase" }]}>Oma pääoma</Text>
            </View>
            {retainedEarnings !== 0 && (
              <View style={styles.row}>
                <Text style={styles.colLabelIndent}>Ed. tilikausien tulos</Text>
                <Text style={styles.colAmt}>{eur(retainedEarnings)}</Text>
              </View>
            )}
            <View style={styles.row}>
              <Text style={styles.colLabelIndent}>Tilikauden tulos {year}</Text>
              <Text style={styles.colAmt}>{eur(currentResult)}</Text>
            </View>
            <View style={styles.rowBold}>
              <Text style={styles.colLabel}>Oma pääoma yhteensä</Text>
              <Text style={styles.colAmtBold}>{eur(totalEquity)}</Text>
            </View>
            {totalLiabilities !== 0 && (
              <View style={styles.row}>
                <Text style={styles.colLabelIndent}>Velat</Text>
                <Text style={styles.colAmt}>{eur(totalLiabilities)}</Text>
              </View>
            )}
            <View style={styles.rowBold}>
              <Text style={styles.colLabel}>Vastattavaa yhteensä</Text>
              <Text style={styles.colAmtBold}>{eur(totalLiabAndEq)}</Text>
            </View>
          </View>
        </View>

        {/* Signature lines */}
        <View style={{ marginTop: 40, flexDirection: "row", gap: 48 }}>
          <View style={{ flex: 1 }}>
            <View style={{ borderTopWidth: 0.5, borderTopColor: "#999", paddingTop: 4, marginTop: 32 }}>
              <Text style={{ fontSize: 8, color: "#666" }}>Paikka ja päivämäärä</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ borderTopWidth: 0.5, borderTopColor: "#999", paddingTop: 4, marginTop: 32 }}>
              <Text style={{ fontSize: 8, color: "#666" }}>
                Allekirjoitus{association.contactName ? ` – ${association.contactName}` : ""}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.footer}>
          {association.name} · IBAN {association.iban} · {association.bankName}
        </Text>
      </Page>
    </Document>
  );
}
