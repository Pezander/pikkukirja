// Labels and terminology that vary by organization type

export type OrgType = "tiekunta" | "metsastysseura" | "taloyhtio" | "toiminimi";

export interface OrgLabels {
  // Organization
  orgTypeName: string;         // "Tiekunta" | "Metsästysseura" | "Taloyhtiö"
  orgNameLabel: string;        // "Tiekunnan nimi" | "Seuran nimi" | "Yhtiön nimi"

  // Members
  membersTitle: string;        // "Jäsenrekisteri"
  memberSingular: string;      // "jäsen"
  memberPlural: string;        // "jäsentä"
  memberDescription: string;   // "Hallinnoi jäseniä ja heidän yksiköitään" etc.

  // Properties / units (tiekunta & taloyhtiö only)
  showProperties: boolean;
  propertyLabel: string;       // "Tila" | "Osake" | —
  propertiesLabel: string;     // "Tilat ja yksiköt" | "Osakkeet"
  unitsLabel: string;          // "Yksiköt" | "Osakkeet" | —
  unitAbbr: string;            // "yks." | "os."

  // Member type (metsastysseura only)
  showMemberType: boolean;
  memberTypeLabel: string;     // "Jäsentyyppi"
  memberTypeOptions: { value: string; label: string }[];

  // Invoices
  invoiceTitle: string;        // "Tiemaksulaskut" | "Jäsenmaksulaskut" | "Yhtiövastike"
  unitPriceLabel: string;      // "Hinta / yksikkö" | "€/osake" | —
}

const MEMBER_TYPE_OPTIONS_SEURA = [
  { value: "varsinainen", label: "Varsinainen jäsen" },
  { value: "koejäsen", label: "Koejäsen" },
  { value: "nuori", label: "Nuorisojäsen" },
  { value: "kunniajäsen", label: "Kunniajäsen" },
];

const LABELS: Record<OrgType, OrgLabels> = {
  toiminimi: {
    orgTypeName: "Toiminimi",
    orgNameLabel: "Toiminimi / yrityksen nimi",
    membersTitle: "Asiakkaat",
    memberSingular: "asiakas",
    memberPlural: "asiakasta",
    memberDescription: "Hallinnoi asiakkaita ja yhteystietoja",
    showProperties: false,
    propertyLabel: "",
    propertiesLabel: "",
    unitsLabel: "",
    unitAbbr: "",
    showMemberType: false,
    memberTypeLabel: "",
    memberTypeOptions: [],
    invoiceTitle: "Laskut",
    unitPriceLabel: "Hinta (€)",
  },
  tiekunta: {
    orgTypeName: "Tiekunta",
    orgNameLabel: "Tiekunnan nimi",
    membersTitle: "Jäsenrekisteri",
    memberSingular: "jäsen",
    memberPlural: "jäsentä",
    memberDescription: "Hallinnoi jäseniä ja heidän yksiköitään",
    showProperties: true,
    propertyLabel: "Tila",
    propertiesLabel: "Tilat ja yksiköt",
    unitsLabel: "Yksiköt",
    unitAbbr: "yks.",
    showMemberType: false,
    memberTypeLabel: "",
    memberTypeOptions: [],
    invoiceTitle: "Tiemaksulaskut",
    unitPriceLabel: "Hinta / yksikkö (€)",
  },
  metsastysseura: {
    orgTypeName: "Metsästysseura",
    orgNameLabel: "Seuran nimi",
    membersTitle: "Jäsenrekisteri",
    memberSingular: "jäsen",
    memberPlural: "jäsentä",
    memberDescription: "Hallinnoi jäseniä ja jäsentyyppejä",
    showProperties: false,
    propertyLabel: "",
    propertiesLabel: "",
    unitsLabel: "",
    unitAbbr: "",
    showMemberType: true,
    memberTypeLabel: "Jäsentyyppi",
    memberTypeOptions: MEMBER_TYPE_OPTIONS_SEURA,
    invoiceTitle: "Jäsenmaksulaskut",
    unitPriceLabel: "Jäsenmaksu (€)",
  },
  taloyhtio: {
    orgTypeName: "Taloyhtiö",
    orgNameLabel: "Yhtiön nimi",
    membersTitle: "Osakasrekisteri",
    memberSingular: "osakas",
    memberPlural: "osakasta",
    memberDescription: "Hallinnoi osakkaita ja osakkeita",
    showProperties: true,
    propertyLabel: "Huoneisto",
    propertiesLabel: "Huoneistot ja osakkeet",
    unitsLabel: "Osakkeet",
    unitAbbr: "os.",
    showMemberType: false,
    memberTypeLabel: "",
    memberTypeOptions: [],
    invoiceTitle: "Yhtiövastike",
    unitPriceLabel: "Vastike / osake (€)",
  },
};

export function getOrgLabels(type: string): OrgLabels {
  return LABELS[(type as OrgType) in LABELS ? (type as OrgType) : "tiekunta"];
}

export const ORG_TYPE_OPTIONS: { value: OrgType; label: string }[] = [
  { value: "tiekunta", label: "Tiekunta" },
  { value: "metsastysseura", label: "Metsästysseura" },
  { value: "taloyhtio", label: "Taloyhtiö" },
  { value: "toiminimi", label: "Toiminimi" },
];
