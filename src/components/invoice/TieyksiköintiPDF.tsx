import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 8.5, padding: 40, color: "#111" },
  assocName: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  subtitle: { fontSize: 9, color: "#555" },
  docTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 16, marginBottom: 2 },
  calcMeta: { fontSize: 8.5, color: "#555", marginBottom: 16 },

  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#bbb",
    paddingBottom: 3,
    marginBottom: 2,
  },
  headerCell: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#666", textTransform: "uppercase" },

  row: {
    flexDirection: "row",
    paddingHorizontal: 0,
    paddingVertical: 3,
    borderBottomWidth: 0.2,
    borderBottomColor: "#eee",
  },
  totalsRow: {
    flexDirection: "row",
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: "#bbb",
    marginTop: 2,
  },

  colName: { flex: 3 },
  colTkm: { flex: 1, textAlign: "right" },
  colShare: { flex: 1, textAlign: "right" },
  colInvoice: { flex: 1.2, textAlign: "right" },

  bold: { fontFamily: "Helvetica-Bold" },

  // Per-member breakdown pages
  memberHeading: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  breakdownTableHeader: {
    flexDirection: "row",
    borderBottomWidth: 0.8,
    borderBottomColor: "#bbb",
    paddingBottom: 2,
    marginBottom: 2,
  },
  bColProp: { flex: 2.5 },
  bColDist: { flex: 1, textAlign: "right", marginRight: 8 },
  bColType: { flex: 2 },
  bColPainoluku: { flex: 1, textAlign: "right" },
  bColCorr: { flex: 1, textAlign: "right" },
  bColTkm: { flex: 1, textAlign: "right" },

  breakdownRow: {
    flexDirection: "row",
    paddingVertical: 2.5,
    borderBottomWidth: 0.2,
    borderBottomColor: "#eee",
  },

  memberSummary: {
    flexDirection: "row",
    gap: 24,
    marginTop: 8,
    padding: "4 6",
    backgroundColor: "#f5f5f5",
  },
  memberSummaryItem: { flex: 1 },
  memberSummaryLabel: { fontSize: 7.5, color: "#888" },
  memberSummaryValue: { fontFamily: "Helvetica-Bold" },

  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 7.5,
    color: "#aaa",
    textAlign: "center",
  },
});

const TRAFFIC_LABELS: Record<string, string> = {
  asunto: "Asunto",
  vapaa_ajan_asunto: "Vapaa-ajan asunto",
  metsa: "Metsä",
  pelto: "Pelto",
  muu: "Muu liikenne",
};

const SUBTYPE_LABELS: Record<string, Record<string, string>> = {
  vapaa_ajan_asunto: { ympärivuotinen: "Ympärivuotinen", kesämökki: "Kesämökki", lomamökki: "Lomamökki" },
  metsa: { "1": "Alue 1", "2": "Alue 2", "3": "Alue 3", "4": "Alue 4", "5": "Alue 5" },
  pelto: { kasvinviljely: "Kasvinviljely", nautakarja: "Nautakarja" },
};

function trafficLabel(trafficType: string, subType: string) {
  const base = TRAFFIC_LABELS[trafficType] ?? trafficType;
  const sub = SUBTYPE_LABELS[trafficType]?.[subType];
  return sub ? `${base} · ${sub}` : base;
}

function fi2(n: number) {
  return n.toFixed(2).replace(".", ",");
}

function fiEur(n: number) {
  return n.toFixed(2).replace(".", ",") + " €";
}

function fiDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

export interface BreakdownItem {
  propertyName: string;
  kiinteistoId: string;
  distanceKm: number;
  trafficType: string;
  subType: string;
  areaHa: number;
  painoluku: number;
  correctionFactor: number;
  tkm: number;
}

export interface ResultRow {
  memberName: string;
  totalTkm: number;
  sharePercent: number;
  breakdown: BreakdownItem[];
}

export interface TieyksiköintiPDFProps {
  associationName: string;
  associationAddress: string;
  calcName: string;
  printedAt: string;
  pricePerUnit: number;
  adminFee: number;
  results: ResultRow[];
}

export function TieyksiköintiPDF({
  associationName,
  associationAddress,
  calcName,
  printedAt,
  pricePerUnit,
  adminFee,
  results,
}: TieyksiköintiPDFProps) {
  const totalTkm = results.reduce((s, r) => s + r.totalTkm, 0);
  const totalInvoiced = results.reduce(
    (s, r) => s + r.totalTkm * pricePerUnit + adminFee,
    0
  );
  const showInvoice = pricePerUnit > 0;
  const footerText = `Laadittu pikkukirja-ohjelmalla · ${fiDate(printedAt)}`;

  return (
    <Document>
      {/* Page 1 — summary */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.assocName}>{associationName}</Text>
        {associationAddress && <Text style={styles.subtitle}>{associationAddress}</Text>}
        <Text style={styles.docTitle}>Maksuunpanoluettelo</Text>
        <Text style={styles.calcMeta}>
          {calcName} · Tulostettu {fiDate(printedAt)}
        </Text>

        {/* Table header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.headerCell, styles.colName]}>Jäsen</Text>
          <Text style={[styles.headerCell, styles.colTkm]}>Tkm</Text>
          <Text style={[styles.headerCell, styles.colShare]}>Osuus</Text>
          {showInvoice && (
            <Text style={[styles.headerCell, styles.colInvoice]}>Laskutus</Text>
          )}
        </View>

        {results.map((r, i) => {
          const invoice = showInvoice ? r.totalTkm * pricePerUnit + adminFee : null;
          return (
            <View key={i} style={styles.row}>
              <Text style={styles.colName}>{r.memberName}</Text>
              <Text style={styles.colTkm}>{r.totalTkm.toFixed(0)}</Text>
              <Text style={styles.colShare}>{fi2(r.sharePercent)} %</Text>
              {invoice !== null && (
                <Text style={styles.colInvoice}>{fiEur(invoice)}</Text>
              )}
            </View>
          );
        })}

        {/* Totals */}
        <View style={styles.totalsRow}>
          <Text style={[styles.colName, styles.bold]}>Yhteensä</Text>
          <Text style={[styles.colTkm, styles.bold]}>{totalTkm.toFixed(0)}</Text>
          <Text style={[styles.colShare, styles.bold]}>100,00 %</Text>
          {showInvoice && (
            <Text style={[styles.colInvoice, styles.bold]}>{fiEur(totalInvoiced)}</Text>
          )}
        </View>

        {/* Pricing note */}
        {showInvoice && (
          <Text style={{ fontSize: 7.5, color: "#666", marginTop: 10 }}>
            Yksikköhinta {pricePerUnit.toFixed(4).replace(".", ",")} €/tkm
            {adminFee > 0 ? ` · Perusmaksu ${fi2(adminFee)} €/jäsen` : ""}
          </Text>
        )}

        <Text style={styles.footer}>{footerText}</Text>
      </Page>

      {/* Pages 2+ — per-member breakdown */}
      {results.map((r, ri) => (
        <Page key={ri} size="A4" style={styles.page}>
          <Text style={styles.assocName}>{associationName}</Text>
          <Text style={styles.subtitle}>{calcName}</Text>

          <Text style={[styles.memberHeading, { marginTop: 14 }]}>{r.memberName}</Text>

          {/* Breakdown table header */}
          <View style={styles.breakdownTableHeader}>
            <Text style={[styles.headerCell, styles.bColProp]}>Kiinteistö</Text>
            <Text style={[styles.headerCell, styles.bColDist]}>Km</Text>
            <Text style={[styles.headerCell, styles.bColType]}>Liikennelaji</Text>
            <Text style={[styles.headerCell, styles.bColPainoluku]}>Painoluku</Text>
            <Text style={[styles.headerCell, styles.bColCorr]}>Kerroin</Text>
            <Text style={[styles.headerCell, styles.bColTkm]}>Tkm</Text>
          </View>

          {r.breakdown.map((b, bi) => (
            <View key={bi} style={styles.breakdownRow}>
              <Text style={styles.bColProp}>
                {b.propertyName}
                {b.kiinteistoId ? `\n${b.kiinteistoId}` : ""}
              </Text>
              <Text style={styles.bColDist}>{fi2(b.distanceKm)} km</Text>
              <Text style={styles.bColType}>{trafficLabel(b.trafficType, b.subType)}</Text>
              <Text style={styles.bColPainoluku}>{fi2(b.painoluku)}</Text>
              <Text style={styles.bColCorr}>{fi2(b.correctionFactor)}</Text>
              <Text style={styles.bColTkm}>{b.tkm.toFixed(0)}</Text>
            </View>
          ))}

          {/* Member summary */}
          <View style={styles.memberSummary}>
            <View style={styles.memberSummaryItem}>
              <Text style={styles.memberSummaryLabel}>Tieyksikkökilometrit yhteensä</Text>
              <Text style={styles.memberSummaryValue}>{r.totalTkm.toFixed(0)} tkm</Text>
            </View>
            <View style={styles.memberSummaryItem}>
              <Text style={styles.memberSummaryLabel}>Osuus</Text>
              <Text style={styles.memberSummaryValue}>{fi2(r.sharePercent)} %</Text>
            </View>
            {showInvoice && (
              <View style={styles.memberSummaryItem}>
                <Text style={styles.memberSummaryLabel}>Laskutus</Text>
                <Text style={styles.memberSummaryValue}>
                  {fiEur(r.totalTkm * pricePerUnit + adminFee)}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.footer}>{footerText}</Text>
        </Page>
      ))}
    </Document>
  );
}
