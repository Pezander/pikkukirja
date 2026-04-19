export interface LiitetiedotSection {
  id: string;
  title: string;
  body: string;
  locked?: boolean; // title cannot be edited (org-required sections)
}

const BASE_SECTIONS: LiitetiedotSection[] = [
  {
    id: "laadintaperiaatteet",
    title: "Tilinpäätöksen laadintaperiaatteet",
    body: "Kirjanpito on laadittu maksuperusteisesti. Menot ja tulot on kirjattu maksupäivän mukaan.",
    locked: true,
  },
  {
    id: "vastuusitoumukset",
    title: "Vastuusitoumukset",
    body: "Yhdistyksellä ei ole vastuusitoumuksia tilikauden päättyessä.",
    locked: true,
  },
  {
    id: "henkilosto",
    title: "Henkilöstö",
    body: "Yhdistyksellä ei ole omaa henkilöstöä.",
    locked: true,
  },
];

const TALOYHTIO_SECTIONS: LiitetiedotSection[] = [
  {
    id: "laadintaperiaatteet",
    title: "Tilinpäätöksen laadintaperiaatteet",
    body: "Kirjanpito on laadittu suoriteperusteisesti. Poistot on laskettu tasapoistoina käyttöiän mukaan.",
    locked: true,
  },
  {
    id: "vastikkeet",
    title: "Vastikkeet",
    body: "Hoitovastike: — €/m²/kk\nPääomavastike: — €/osake/kk",
    locked: true,
  },
  {
    id: "lainat",
    title: "Lainat",
    body: "Yhtiöllä ei ole lainoja tilikauden päättyessä.",
    locked: true,
  },
  {
    id: "korjaukset",
    title: "Suoritetut ja tulevat korjaukset",
    body: "Tilikauden aikana suoritetut korjaukset:\n—\n\nTulevat suuremmat korjaukset:\n—",
    locked: true,
  },
  {
    id: "vastuusitoumukset",
    title: "Vastuusitoumukset",
    body: "Yhtiöllä ei ole vastuusitoumuksia tilikauden päättyessä.",
    locked: true,
  },
  {
    id: "henkilosto",
    title: "Henkilöstö",
    body: "Yhtiöllä ei ole omaa henkilöstöä.",
    locked: true,
  },
];

const TOIMINIMI_SECTIONS: LiitetiedotSection[] = [
  {
    id: "laadintaperiaatteet",
    title: "Tilinpäätöksen laadintaperiaatteet",
    body: "Kirjanpito on laadittu suoriteperusteisesti.",
    locked: true,
  },
  {
    id: "vastuusitoumukset",
    title: "Vastuusitoumukset",
    body: "Toiminimellä ei ole vastuusitoumuksia tilikauden päättyessä.",
    locked: true,
  },
];

export function getDefaultLiitetiedot(orgType: string): LiitetiedotSection[] {
  switch (orgType) {
    case "taloyhtio": return TALOYHTIO_SECTIONS;
    case "toiminimi": return TOIMINIMI_SECTIONS;
    default: return BASE_SECTIONS; // tiekunta, metsastysseura
  }
}
