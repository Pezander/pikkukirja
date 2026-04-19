import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9.5, padding: 48, color: "#111" },

  // Cover page
  coverPage: { fontFamily: "Helvetica", fontSize: 9.5, padding: 72, color: "#111", justifyContent: "center" },
  coverOrg: { fontSize: 26, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  coverTitle: { fontSize: 14, color: "#444", marginBottom: 4 },
  coverYear: { fontSize: 12, color: "#666", marginBottom: 40 },
  coverDivider: { borderBottomWidth: 1, borderBottomColor: "#ccc", marginBottom: 24 },
  coverMeta: { fontSize: 9, color: "#666", lineHeight: 1.6 },

  // Section headers
  sectionTitle: {
    fontSize: 11, fontFamily: "Helvetica-Bold",
    marginBottom: 8, marginTop: 24,
    paddingBottom: 4, borderBottomWidth: 0.5, borderBottomColor: "#bbb",
  },
  pageHeader: { marginBottom: 24, borderBottomWidth: 1, borderBottomColor: "#ddd", paddingBottom: 12 },
  pageHeaderText: { fontSize: 9, color: "#888" },

  // Activity report sections
  activitySectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 4, marginTop: 14 },
  activitySectionBody: { fontSize: 9.5, color: "#333", lineHeight: 1.55 },

  // Table rows
  row: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 0.3, borderBottomColor: "#e5e5e5" },
  rowBold: { flexDirection: "row", paddingVertical: 4, borderTopWidth: 0.5, borderTopColor: "#999", marginTop: 2 },
  rowSection: { flexDirection: "row", paddingVertical: 5 },
  colLabel: { flex: 1 },
  colLabelIndent: { flex: 1, paddingLeft: 12 },
  colAmt: { width: 90, textAlign: "right" },
  colAmtBold: { width: 90, textAlign: "right", fontFamily: "Helvetica-Bold" },
  sectionLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#555", textTransform: "uppercase", letterSpacing: 0.5, paddingVertical: 4 },
  twoCol: { flexDirection: "row", gap: 24 },
  halfCol: { flex: 1 },

  // Notes
  noteText: { fontSize: 9, color: "#555", lineHeight: 1.6, marginBottom: 6 },
  noteTitle: { fontSize: 9.5, fontFamily: "Helvetica-Bold", marginBottom: 4, marginTop: 12 },

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
interface Section { id: string; title: string; body: string; }
interface Association {
  name: string;
  type: string;
  address: string;
  postalCode: string;
  city: string;
  iban: string;
  bankName: string;
  contactName: string;
  phone: string;
  email: string;
}

const ORG_TYPE_LABELS: Record<string, string> = {
  tiekunta: "Tiekunta",
  metsastysseura: "Metsästysseura",
  taloyhtio: "Taloyhtiö",
  toiminimi: "Toiminimi",
};

const PRIMARY_INCOME: Record<string, string> = {
  tiekunta: "Yksikkömaksut",
  metsastysseura: "Jäsenmaksutulot",
  taloyhtio: "Hoitovastike",
  toiminimi: "Myyntitulot",
};

const MAINTENANCE: Record<string, string> = {
  tiekunta: "Tien kunnossapito",
  metsastysseura: "Toimintakulut",
  taloyhtio: "Kiinteistön hoitokulut",
  toiminimi: "Toimintakulut",
};

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

interface IncomeRow { label: string; amount: number; indent?: boolean; bold?: boolean; }

function buildIncomeRows(vouchers: Voucher[], accounts: Account[], orgType: string): IncomeRow[] {
  const primaryLabel = PRIMARY_INCOME[orgType] ?? PRIMARY_INCOME.tiekunta;
  const maintenanceLabel = MAINTENANCE[orgType] ?? MAINTENANCE.tiekunta;
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
  return [
    { label: "TULOT", amount: 0, bold: true },
    { label: primaryLabel, amount: memberFees, indent: true },
    { label: "Avustukset", amount: grants, indent: true },
    { label: "Tilinhoitotulot", amount: adminInc, indent: true },
    ...(otherInc !== 0 ? [{ label: "Muut tulot", amount: otherInc, indent: true }] : []),
    { label: "Tulot yhteensä", amount: totalIncome, bold: true },
    { label: "MENOT", amount: 0, bold: true },
    { label: maintenanceLabel, amount: maintenance, indent: true },
    { label: "Pankkipalvelumaksut", amount: bankFees, indent: true },
    ...(otherExp !== 0 ? [{ label: "Muut menot", amount: otherExp, indent: true }] : []),
    { label: "Menot yhteensä", amount: totalExpenses, bold: true },
    { label: result >= 0 ? "TILIKAUDEN YLIJÄÄMÄ" : "TILIKAUDEN ALIJÄÄMÄ", amount: result, bold: true },
  ];
}

function renderIncomeRow(r: IncomeRow, i: number) {
  if (r.bold && r.amount === 0) {
    return (
      <View key={i} style={styles.rowSection}>
        <Text style={[styles.colLabel, { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#555", textTransform: "uppercase" }]}>{r.label}</Text>
      </View>
    );
  }
  return (
    <View key={i} style={r.bold ? styles.rowBold : styles.row}>
      <Text style={r.indent ? styles.colLabelIndent : styles.colLabel}>{r.label}</Text>
      <Text style={r.bold ? styles.colAmtBold : styles.colAmt}>{eur(r.amount ?? 0)}</Text>
    </View>
  );
}

interface Props {
  vouchers: Voucher[];
  accounts: Account[];
  year: number;
  association: Association;
  reportSections: Section[];
  liitetiedot?: Section[];
}

export function AnnualMeetingPDF({ vouchers, accounts, year, association, reportSections, liitetiedot = [] }: Props) {
  const orgLabel = ORG_TYPE_LABELS[association.type] ?? association.type;
  const generatedDate = new Date().toLocaleDateString("fi-FI");

  // Financials
  const inc = byType(accounts, "income");
  const exp = byType(accounts, "expense");
  const totalIncome = netOf(vouchers, inc).credit - netOf(vouchers, inc).debit;
  const totalExpenses = netOf(vouchers, exp).debit - netOf(vouchers, exp).credit;
  const currentResult = totalIncome - totalExpenses;
  const bank = netOf(vouchers, byPrefix(accounts, "100")).net;
  const receivables = netOf(vouchers, byPrefix(accounts, "111")).net;
  const totalAssets = bank + receivables;
  const totalLiabilities = -netOf(vouchers, byType(accounts, "liability")).net;
  const retainedEarnings = -netOf(vouchers, byPrefix(accounts, "222")).net;
  const totalEquity = retainedEarnings + currentResult;
  const totalLiabAndEq = totalLiabilities + totalEquity;
  const incomeRows = buildIncomeRows(vouchers, accounts, association.type);

  const address = [association.address, association.postalCode && association.city ? `${association.postalCode} ${association.city}` : (association.postalCode || association.city)].filter(Boolean).join(", ");

  return (
    <Document>
      {/* ── Page 1: Cover ─────────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.coverPage}>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Text style={styles.coverOrg}>{association.name}</Text>
          <Text style={styles.coverTitle}>Vuosikokouksen asiakirjat</Text>
          <Text style={styles.coverYear}>Tilikausi 1.1.{year}–31.12.{year}</Text>
          <View style={styles.coverDivider} />
          <Text style={styles.coverMeta}>
            {orgLabel}
            {address ? `\n${address}` : ""}
            {association.contactName ? `\n${association.contactName}` : ""}
            {association.phone ? `  ·  ${association.phone}` : ""}
            {association.email ? `\n${association.email}` : ""}
            {"\n\nLaadittu " + generatedDate}
          </Text>
        </View>
        <Text style={styles.footer}>{association.name} · Tilikausi {year}</Text>
      </Page>

      {/* ── Page 2: Toimintakertomus ────────────────────────────────────────────── */}
      {reportSections.length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.pageHeader}>
            <Text style={styles.pageHeaderText}>{association.name} · Tilikausi {year}</Text>
          </View>
          <Text style={styles.sectionTitle}>TOIMINTAKERTOMUS {year}</Text>
          {reportSections.map((section, i) => (
            <View key={i}>
              <Text style={styles.activitySectionTitle}>{section.title}</Text>
              <Text style={styles.activitySectionBody}>
                {section.body || "—"}
              </Text>
            </View>
          ))}
          <Text style={styles.footer}>{association.name} · Tilikausi {year}</Text>
        </Page>
      )}

      {/* ── Page 3: Tuloslaskelma + Tase ────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <View style={styles.pageHeader}>
          <Text style={styles.pageHeaderText}>{association.name} · Tilikausi {year}</Text>
        </View>

        <Text style={styles.sectionTitle}>TULOSLASKELMA 1.1.{year}–31.12.{year}</Text>
        {incomeRows.map(renderIncomeRow)}

        <Text style={styles.sectionTitle}>TASE 31.12.{year}</Text>
        <View style={styles.twoCol}>
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

        <Text style={styles.footer}>{association.name} · Tilikausi {year}</Text>
      </Page>

      {/* ── Page 4: Liitetiedot + Allekirjoitukset ─────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <View style={styles.pageHeader}>
          <Text style={styles.pageHeaderText}>{association.name} · Tilikausi {year}</Text>
        </View>

        <Text style={styles.sectionTitle}>LIITETIEDOT</Text>

        {liitetiedot.length > 0 ? (
          liitetiedot.map((section) => (
            <View key={section.id}>
              <Text style={styles.noteTitle}>{section.title}</Text>
              <Text style={styles.noteText}>{section.body || "–"}</Text>
            </View>
          ))
        ) : (
          <>
            <Text style={styles.noteTitle}>Tilinpäätöksen laadintaperiaatteet</Text>
            <Text style={styles.noteText}>
              Tilinpäätös on laadittu yhdistyslain ja kirjanpitolain säännösten mukaisesti.
              Tilikausi on 1.1.{year}–31.12.{year}. Kirjanpito on pidetty kahdenkertaisena.
            </Text>
            <Text style={styles.noteTitle}>Pankkitili ja pankkipalvelut</Text>
            <Text style={styles.noteText}>
              {association.bankName ? `Pankki: ${association.bankName}.` : ""}
              {association.iban ? `  IBAN: ${association.iban}.` : ""}
            </Text>
          </>
        )}

        <View style={{ marginTop: 40 }}>
          <Text style={styles.sectionTitle}>ALLEKIRJOITUKSET</Text>
          <Text style={{ fontSize: 9, color: "#555", marginBottom: 24 }}>
            Vakuutamme, että tilinpäätös on laadittu hyvää kirjanpitotapaa noudattaen.
          </Text>
          <View style={{ flexDirection: "row", gap: 48 }}>
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
          <View style={{ flexDirection: "row", gap: 48, marginTop: 32 }}>
            <View style={{ flex: 1 }}>
              <View style={{ borderTopWidth: 0.5, borderTopColor: "#999", paddingTop: 4, marginTop: 32 }}>
                <Text style={{ fontSize: 8, color: "#666" }}>Tilintarkastajan allekirjoitus</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ borderTopWidth: 0.5, borderTopColor: "#999", paddingTop: 4, marginTop: 32 }}>
                <Text style={{ fontSize: 8, color: "#666" }}>Tilintarkastajan nimenselvennys</Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.footer}>{association.name} · IBAN {association.iban} · {association.bankName}</Text>
      </Page>
    </Document>
  );
}
