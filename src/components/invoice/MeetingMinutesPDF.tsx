import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9.5, padding: 48, color: "#111" },
  header: { marginBottom: 24, borderBottomWidth: 1, borderBottomColor: "#ddd", paddingBottom: 14 },
  assocName: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  meetingTitle: { fontSize: 11, color: "#555", marginBottom: 2 },
  metaRow: { flexDirection: "row", gap: 24, marginTop: 8 },
  metaLabel: { fontSize: 8, color: "#888", textTransform: "uppercase", letterSpacing: 0.5 },
  metaValue: { fontSize: 9, color: "#333", marginTop: 1 },
  sectionTitle: {
    fontSize: 10, fontFamily: "Helvetica-Bold",
    marginTop: 18, marginBottom: 6,
    paddingBottom: 3, borderBottomWidth: 0.5, borderBottomColor: "#ccc",
  },
  decisionRow: { marginBottom: 10 },
  decisionHeader: { flexDirection: "row", gap: 8, marginBottom: 2 },
  decisionNum: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: "#333", minWidth: 24 },
  decisionTitle: { fontSize: 9.5, fontFamily: "Helvetica-Bold", flex: 1 },
  decisionBody: { fontSize: 9, color: "#444", lineHeight: 1.5, paddingLeft: 32 },
  outcomeTag: {
    fontSize: 7.5, paddingHorizontal: 5, paddingVertical: 1.5,
    borderRadius: 3, color: "#fff",
  },
  footer: { position: "absolute", bottom: 28, left: 48, right: 48, fontSize: 8, color: "#aaa", textAlign: "center" },
  signatureRow: { flexDirection: "row", gap: 48, marginTop: 32 },
  signatureLine: { flex: 1 },
  signatureRule: { borderTopWidth: 0.5, borderTopColor: "#999", paddingTop: 4, marginTop: 32 },
  signatureLabel: { fontSize: 8, color: "#666" },
});

const MEETING_TYPE_LABELS: Record<string, string> = {
  vuosikokous: "Vuosikokous",
  hallitus: "Hallituksen kokous",
  ylimääräinen: "Ylimääräinen kokous",
};

const OUTCOME_COLORS: Record<string, string> = {
  passed: "#16a34a",
  rejected: "#dc2626",
  deferred: "#d97706",
};

const OUTCOME_LABELS: Record<string, string> = {
  passed: "Hyväksytty",
  rejected: "Hylätty",
  deferred: "Siirretty",
};

interface Decision {
  id: string;
  number: number;
  title: string;
  body: string;
  outcome: string;
}

interface Meeting {
  meetingType: string;
  meetingDate: Date | string;
  location: string;
  attendees: string;
  decisions: Decision[];
}

interface Association {
  name: string;
  city: string;
  contactName: string;
}

interface Props {
  association: Association;
  meeting: Meeting;
}

export function MeetingMinutesPDF({ association, meeting }: Props) {
  const meetingTypeLabel = MEETING_TYPE_LABELS[meeting.meetingType] ?? meeting.meetingType;
  const dateStr = new Date(meeting.meetingDate).toLocaleDateString("fi-FI");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.assocName}>{association.name}</Text>
          <Text style={styles.meetingTitle}>{meetingTypeLabel} – {dateStr}</Text>

          <View style={styles.metaRow}>
            {meeting.location ? (
              <View>
                <Text style={styles.metaLabel}>Paikka</Text>
                <Text style={styles.metaValue}>{meeting.location}</Text>
              </View>
            ) : null}
            {meeting.attendees ? (
              <View style={{ flex: 1 }}>
                <Text style={styles.metaLabel}>Läsnä</Text>
                <Text style={styles.metaValue}>{meeting.attendees}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <Text style={styles.sectionTitle}>PÄÄTÖKSET</Text>

        {meeting.decisions.length === 0 && (
          <Text style={{ fontSize: 9, color: "#888" }}>Ei kirjattuja päätöksiä.</Text>
        )}

        {meeting.decisions.map((d) => (
          <View key={d.id} style={styles.decisionRow}>
            <View style={styles.decisionHeader}>
              <Text style={styles.decisionNum}>§{d.number}</Text>
              <Text style={styles.decisionTitle}>{d.title}</Text>
              <Text style={[styles.outcomeTag, { backgroundColor: OUTCOME_COLORS[d.outcome] ?? "#555" }]}>
                {OUTCOME_LABELS[d.outcome] ?? d.outcome}
              </Text>
            </View>
            {d.body ? <Text style={styles.decisionBody}>{d.body}</Text> : null}
          </View>
        ))}

        {/* Signature section */}
        <View style={styles.signatureRow}>
          <View style={styles.signatureLine}>
            <View style={styles.signatureRule}>
              <Text style={styles.signatureLabel}>Paikka ja päivämäärä</Text>
            </View>
          </View>
          <View style={styles.signatureLine}>
            <View style={styles.signatureRule}>
              <Text style={styles.signatureLabel}>
                Puheenjohtajan allekirjoitus{association.contactName ? ` – ${association.contactName}` : ""}
              </Text>
            </View>
          </View>
          <View style={styles.signatureLine}>
            <View style={styles.signatureRule}>
              <Text style={styles.signatureLabel}>Sihteerin allekirjoitus</Text>
            </View>
          </View>
        </View>

        <Text style={styles.footer}>{association.name} · {meetingTypeLabel} · {dateStr}</Text>
      </Page>
    </Document>
  );
}
