import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 48,
    color: "#111",
  },
  // Header
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 32 },
  senderBlock: { flex: 1 },
  senderName: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  senderDetail: { color: "#555", lineHeight: 1.5 },
  invoiceLabel: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#1a1a1a" },
  invoiceNumber: { fontSize: 11, color: "#555", marginTop: 4 },
  logoImage: { width: 60, marginBottom: 8 },

  // Recipient
  recipientSection: { marginBottom: 24 },
  sectionLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  recipientName: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  recipientDetail: { color: "#444", lineHeight: 1.5 },

  // Meta row (dates, amounts)
  metaRow: {
    flexDirection: "row",
    gap: 24,
    backgroundColor: "#f5f5f5",
    borderRadius: 4,
    padding: "10 12",
    marginBottom: 24,
  },
  metaItem: { flex: 1 },
  metaKey: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  metaValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },

  // Line items table
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableHeaderCell: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#888", textTransform: "uppercase", letterSpacing: 0.5 },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: "#eee",
  },
  colDescription: { flex: 3 },
  colUnits: { flex: 1, textAlign: "right" },
  colUnitPrice: { flex: 1, textAlign: "right" },
  colAmount: { flex: 1, textAlign: "right" },

  // Totals
  totalsSection: { marginTop: 12, alignItems: "flex-end" },
  totalRow: { flexDirection: "row", gap: 16, paddingVertical: 2 },
  totalLabel: { width: 120, textAlign: "right", color: "#555" },
  totalValue: { width: 80, textAlign: "right", fontFamily: "Helvetica-Bold" },
  grandTotalRow: {
    flexDirection: "row",
    gap: 16,
    paddingVertical: 6,
    borderTopWidth: 1.5,
    borderTopColor: "#111",
    marginTop: 4,
  },
  grandTotalLabel: { width: 120, textAlign: "right", fontFamily: "Helvetica-Bold", fontSize: 11 },
  grandTotalValue: { width: 80, textAlign: "right", fontFamily: "Helvetica-Bold", fontSize: 11 },

  // Payment details
  paymentSection: {
    marginTop: 32,
    borderTopWidth: 0.5,
    borderTopColor: "#ddd",
    paddingTop: 16,
  },
  paymentTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 8 },
  paymentGrid: { flexDirection: "row", gap: 32 },
  paymentItem: {},
  paymentKey: { fontSize: 8, color: "#888", marginBottom: 2 },
  paymentValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },

  // Barcode section
  barcodeSection: {
    marginTop: 24,
    borderTopWidth: 0.5,
    borderTopColor: "#ddd",
    paddingTop: 12,
  },
  barcodeImage: {
    width: 220,
    height: 36,
    marginBottom: 4,
  },
  virtuaaliviivakoodi: {
    fontSize: 7,
    fontFamily: "Courier",
    color: "#555",
    letterSpacing: 0.5,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 32,
    left: 48,
    right: 48,
    fontSize: 8,
    color: "#aaa",
    textAlign: "center",
  },
});

function formatEur(n: number) {
  return n.toFixed(2).replace(".", ",") + " €";
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

interface LineItem {
  name: string;
  units: number;
  unitPrice: number;
  amount: number;
}

interface Member {
  name: string;
  address: string;
  postalCode: string;
  city: string;
  email: string;
  referenceNumber: string;
}

interface Invoice {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  unitPrice: number;
  adminFee: number;
  totalAmount: number;
  vatRate?: number | null;
  vatAmount?: number | null;
  lineItems: LineItem[];
  member: Member;
}

interface Association {
  name: string;
  type?: string;
  address: string;
  postalCode: string;
  city: string;
  iban: string;
  bic: string;
  bankName: string;
  contactName: string;
  phone: string;
  email: string;
}

interface Props {
  invoice: Invoice;
  association: Association;
  logoSrc?: string;
  barcodeSrc?: string;
  virtuaaliviivakoodi?: string;
}

export function InvoicePDF({ invoice, association, logoSrc, barcodeSrc, virtuaaliviivakoodi }: Props) {
  const subtotal = invoice.lineItems.reduce((s, l) => s + l.amount, 0) + (invoice.adminFee ?? 0);
  const orgType = association.type ?? "tiekunta";
  const isFlatFee = orgType === "metsastysseura";
  const unitsHeader = orgType === "taloyhtio" ? "Osakkeet" : "Yksiköt";
  const unitPriceHeader = orgType === "taloyhtio" ? "Vastike/os." : "Yks.hinta";

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.senderBlock}>
            <Text style={styles.senderName}>{association.name}</Text>
            {association.address && <Text style={styles.senderDetail}>{association.address}</Text>}
            {(association.postalCode || association.city) && (
              <Text style={styles.senderDetail}>{[association.postalCode, association.city].filter(Boolean).join(" ")}</Text>
            )}
            {association.phone && <Text style={styles.senderDetail}>{association.phone}</Text>}
            {association.email && <Text style={styles.senderDetail}>{association.email}</Text>}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {logoSrc && <Image src={logoSrc} style={styles.logoImage} />}
            <Text style={styles.invoiceLabel}>LASKU</Text>
            <Text style={styles.invoiceNumber}>Nro {invoice.invoiceNumber}</Text>
          </View>
        </View>

        {/* Recipient */}
        <View style={styles.recipientSection}>
          <Text style={styles.sectionLabel}>Laskutetaan</Text>
          <Text style={styles.recipientName}>{invoice.member.name}</Text>
          {invoice.member.address && <Text style={styles.recipientDetail}>{invoice.member.address}</Text>}
          {(invoice.member.postalCode || invoice.member.city) && (
            <Text style={styles.recipientDetail}>
              {[invoice.member.postalCode, invoice.member.city].filter(Boolean).join(" ")}
            </Text>
          )}
          {invoice.member.email && <Text style={styles.recipientDetail}>{invoice.member.email}</Text>}
        </View>

        {/* Meta row */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaKey}>Laskupäivä</Text>
            <Text style={styles.metaValue}>{formatDate(invoice.issueDate)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaKey}>Eräpäivä</Text>
            <Text style={styles.metaValue}>{formatDate(invoice.dueDate)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaKey}>Summa</Text>
            <Text style={styles.metaValue}>{formatEur(invoice.totalAmount)}</Text>
          </View>
          {invoice.member.referenceNumber && (
            <View style={styles.metaItem}>
              <Text style={styles.metaKey}>Viitenumero</Text>
              <Text style={styles.metaValue}>{invoice.member.referenceNumber}</Text>
            </View>
          )}
        </View>

        {/* Line items */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.colDescription]}>Kuvaus</Text>
          {!isFlatFee && <Text style={[styles.tableHeaderCell, styles.colUnits]}>{unitsHeader}</Text>}
          {!isFlatFee && <Text style={[styles.tableHeaderCell, styles.colUnitPrice]}>{unitPriceHeader}</Text>}
          <Text style={[styles.tableHeaderCell, styles.colAmount]}>Summa</Text>
        </View>

        {invoice.lineItems.map((item, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={styles.colDescription}>{item.name}</Text>
            {!isFlatFee && <Text style={styles.colUnits}>{item.units.toFixed(2)}</Text>}
            {!isFlatFee && <Text style={styles.colUnitPrice}>{formatEur(item.unitPrice)}</Text>}
            <Text style={styles.colAmount}>{formatEur(item.amount)}</Text>
          </View>
        ))}

        {invoice.adminFee > 0 && (
          <View style={styles.tableRow}>
            <Text style={styles.colDescription}>Hallinnointimaksu</Text>
            <Text style={styles.colUnits}> </Text>
            <Text style={styles.colUnitPrice}> </Text>
            <Text style={styles.colAmount}>{formatEur(invoice.adminFee)}</Text>
          </View>
        )}

        {/* Totals */}
        <View style={styles.totalsSection}>
          {invoice.adminFee > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Välisumma</Text>
              <Text style={styles.totalValue}>{formatEur(subtotal)}</Text>
            </View>
          )}
          {invoice.vatAmount != null && invoice.vatRate != null && (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Veroton hinta</Text>
                <Text style={styles.totalValue}>{formatEur(invoice.totalAmount - invoice.vatAmount)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>ALV {invoice.vatRate} %</Text>
                <Text style={styles.totalValue}>{formatEur(invoice.vatAmount)}</Text>
              </View>
            </>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Maksettava yhteensä</Text>
            <Text style={styles.grandTotalValue}>{formatEur(invoice.totalAmount)}</Text>
          </View>
        </View>

        {/* Payment details */}
        <View style={styles.paymentSection}>
          <Text style={styles.paymentTitle}>MAKSUTIEDOT</Text>
          <View style={styles.paymentGrid}>
            <View style={styles.paymentItem}>
              <Text style={styles.paymentKey}>Saaja</Text>
              <Text style={styles.paymentValue}>{association.name}</Text>
            </View>
            <View style={styles.paymentItem}>
              <Text style={styles.paymentKey}>IBAN</Text>
              <Text style={styles.paymentValue}>{association.iban || "—"}</Text>
            </View>
            <View style={styles.paymentItem}>
              <Text style={styles.paymentKey}>BIC</Text>
              <Text style={styles.paymentValue}>{association.bic || "—"}</Text>
            </View>
            {invoice.member.referenceNumber && (
              <View style={styles.paymentItem}>
                <Text style={styles.paymentKey}>Viitenumero</Text>
                <Text style={styles.paymentValue}>{invoice.member.referenceNumber}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Barcode */}
        {barcodeSrc && (
          <View style={styles.barcodeSection}>
            <Text style={styles.paymentTitle}>PANKKIVIIVAKOODI</Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={barcodeSrc} style={styles.barcodeImage} />
            {virtuaaliviivakoodi && (
              <Text style={styles.virtuaaliviivakoodi}>{virtuaaliviivakoodi}</Text>
            )}
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          {association.name} · {association.iban} · {association.bankName}
        </Text>

      </Page>
    </Document>
  );
}
