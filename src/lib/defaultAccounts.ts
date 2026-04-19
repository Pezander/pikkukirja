// Default chart of accounts per organization type

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";

// ── Tiekunta ─────────────────────────────────────────────────────
export const DEFAULT_ACCOUNTS_TIEKUNTA = [
  // Vastaavaa (Assets)
  { number: "100", name: "Pankkitili", type: "asset" as AccountType },
  { number: "111", name: "Siirtosaamiset", type: "asset" as AccountType },
  // Vastattavaa (Liabilities)
  { number: "200", name: "Siirtovelat", type: "liability" as AccountType },
  { number: "203", name: "Muut lyhytaikaiset velat", type: "liability" as AccountType },
  // Oma pääoma (Equity)
  { number: "222", name: "Edellisen tilikauden tulos", type: "equity" as AccountType },
  { number: "240", name: "Tilikauden voitto/tappio", type: "equity" as AccountType },
  // Tulotilit (Income)
  { number: "310", name: "Yksikkömaksut", type: "income" as AccountType },
  { number: "311", name: "Avustukset ja lahjoitukset", type: "income" as AccountType },
  { number: "314", name: "Tietoliikenne ja puhelinkorvaus", type: "income" as AccountType },
  { number: "315", name: "Tilinhoitotulot", type: "income" as AccountType },
  { number: "319", name: "Muut varainhankinnan tulot", type: "income" as AccountType },
  { number: "320", name: "Korkotulot", type: "income" as AccountType },
  // Menotilit (Expenses)
  { number: "406", name: "Rahalaitosten palvelumaksut", type: "expense" as AccountType },
  { number: "409", name: "Muut varsinaisen toiminnan menot", type: "expense" as AccountType },
  { number: "411", name: "Hiekotus", type: "expense" as AccountType },
  { number: "412", name: "Linkous", type: "expense" as AccountType },
  { number: "413", name: "Lanaus", type: "expense" as AccountType },
  { number: "414", name: "Niitto", type: "expense" as AccountType },
  { number: "415", name: "Muut tien kunnossapidon ostetut palvelut", type: "expense" as AccountType },
  { number: "430", name: "Korkomenot", type: "expense" as AccountType },
  { number: "439", name: "Muut rahoitusmenot", type: "expense" as AccountType },
];

// ── Metsästysseura ───────────────────────────────────────────────
export const DEFAULT_ACCOUNTS_METSASTYSSEURA = [
  // Vastaavaa (Assets)
  { number: "100", name: "Pankkitili", type: "asset" as AccountType },
  { number: "111", name: "Siirtosaamiset", type: "asset" as AccountType },
  // Vastattavaa (Liabilities)
  { number: "200", name: "Siirtovelat", type: "liability" as AccountType },
  { number: "203", name: "Muut lyhytaikaiset velat", type: "liability" as AccountType },
  // Oma pääoma (Equity)
  { number: "222", name: "Edellisen tilikauden tulos", type: "equity" as AccountType },
  { number: "240", name: "Tilikauden voitto/tappio", type: "equity" as AccountType },
  // Tulotilit (Income)
  { number: "310", name: "Jäsenmaksutulot", type: "income" as AccountType },
  { number: "311", name: "Avustukset ja lahjoitukset", type: "income" as AccountType },
  { number: "312", name: "Ampumaratojen käyttömaksut", type: "income" as AccountType },
  { number: "313", name: "Vuokratulot", type: "income" as AccountType },
  { number: "319", name: "Muut tulot", type: "income" as AccountType },
  { number: "320", name: "Korkotulot", type: "income" as AccountType },
  // Menotilit (Expenses)
  { number: "400", name: "Metsästystoiminnan menot", type: "expense" as AccountType },
  { number: "401", name: "Ampumaratojen ylläpito", type: "expense" as AccountType },
  { number: "402", name: "Majavavahinkojen torjunta", type: "expense" as AccountType },
  { number: "403", name: "Riistanhoito", type: "expense" as AccountType },
  { number: "406", name: "Rahalaitosten palvelumaksut", type: "expense" as AccountType },
  { number: "409", name: "Muut hallinnolliset menot", type: "expense" as AccountType },
  { number: "430", name: "Korkomenot", type: "expense" as AccountType },
];

// ── Taloyhtiö ────────────────────────────────────────────────────
export const DEFAULT_ACCOUNTS_TALOYHTIO = [
  // Vastaavaa (Assets)
  { number: "100", name: "Pankkitili", type: "asset" as AccountType },
  { number: "101", name: "Korjausrahasto", type: "asset" as AccountType },
  { number: "111", name: "Siirtosaamiset", type: "asset" as AccountType },
  // Vastattavaa (Liabilities)
  { number: "200", name: "Siirtovelat", type: "liability" as AccountType },
  { number: "201", name: "Lainaosuussuoritukset", type: "liability" as AccountType },
  { number: "203", name: "Muut lyhytaikaiset velat", type: "liability" as AccountType },
  // Oma pääoma (Equity)
  { number: "222", name: "Edellisen tilikauden tulos", type: "equity" as AccountType },
  { number: "240", name: "Tilikauden voitto/tappio", type: "equity" as AccountType },
  // Tulotilit (Income)
  { number: "310", name: "Hoitovastike", type: "income" as AccountType },
  { number: "311", name: "Pääomavastike", type: "income" as AccountType },
  { number: "312", name: "Erityisvastike", type: "income" as AccountType },
  { number: "313", name: "Vuokratulot", type: "income" as AccountType },
  { number: "319", name: "Muut tulot", type: "income" as AccountType },
  { number: "320", name: "Korkotulot", type: "income" as AccountType },
  // Menotilit (Expenses)
  { number: "400", name: "Kiinteistön hoitokulut", type: "expense" as AccountType },
  { number: "401", name: "Siivous ja puhtaanapito", type: "expense" as AccountType },
  { number: "402", name: "Lämmityskulut", type: "expense" as AccountType },
  { number: "403", name: "Vesi ja jätevesi", type: "expense" as AccountType },
  { number: "404", name: "Korjaukset ja kunnossapito", type: "expense" as AccountType },
  { number: "405", name: "Vakuutukset", type: "expense" as AccountType },
  { number: "406", name: "Rahalaitosten palvelumaksut", type: "expense" as AccountType },
  { number: "407", name: "Isännöintipalkkio", type: "expense" as AccountType },
  { number: "409", name: "Muut hallinnolliset menot", type: "expense" as AccountType },
  { number: "430", name: "Korkomenot", type: "expense" as AccountType },
];

// ── Toiminimi ─────────────────────────────────────────────────────
export const DEFAULT_ACCOUNTS_TOIMINIMI = [
  // Vastaavaa (Assets)
  { number: "100", name: "Pankkitili", type: "asset" as AccountType },
  { number: "111", name: "Siirtosaamiset", type: "asset" as AccountType },
  // Vastattavaa (Liabilities)
  { number: "200", name: "Siirtovelat", type: "liability" as AccountType },
  { number: "203", name: "Muut lyhytaikaiset velat", type: "liability" as AccountType },
  // Oma pääoma (Equity)
  { number: "222", name: "Edellisen tilikauden tulos", type: "equity" as AccountType },
  { number: "240", name: "Tilikauden voitto/tappio", type: "equity" as AccountType },
  // Tulotilit (Income)
  { number: "310", name: "Myyntitulot", type: "income" as AccountType },
  { number: "311", name: "Muut tulot", type: "income" as AccountType },
  { number: "320", name: "Korkotulot", type: "income" as AccountType },
  // Menotilit (Expenses)
  { number: "406", name: "Rahalaitosten palvelumaksut", type: "expense" as AccountType },
  { number: "410", name: "Materiaali- ja tarvikemenot", type: "expense" as AccountType },
  { number: "411", name: "Ajoneuvokustannukset", type: "expense" as AccountType },
  { number: "412", name: "Puhelin ja tietoliikenne", type: "expense" as AccountType },
  { number: "413", name: "Toimisto- ja hallintokulut", type: "expense" as AccountType },
  { number: "414", name: "Vakuutukset", type: "expense" as AccountType },
  { number: "409", name: "Muut kulut", type: "expense" as AccountType },
  { number: "430", name: "Korkomenot", type: "expense" as AccountType },
];

// Legacy export for backwards compatibility
export const DEFAULT_ACCOUNTS = DEFAULT_ACCOUNTS_TIEKUNTA;

export function getDefaultAccounts(orgType: string) {
  switch (orgType) {
    case "metsastysseura": return DEFAULT_ACCOUNTS_METSASTYSSEURA;
    case "taloyhtio": return DEFAULT_ACCOUNTS_TALOYHTIO;
    case "toiminimi": return DEFAULT_ACCOUNTS_TOIMINIMI;
    default: return DEFAULT_ACCOUNTS_TIEKUNTA;
  }
}
