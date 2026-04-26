<p align="center">
  <img src="public/logo.png" alt="Pikkukirja" width="160" />
</p>

<p align="center"><a href="README.en.md">🇬🇧 In English</a></p>

<h1 align="center">Pikkukirja</h1>

<p align="center">
  <strong>Kirjanpito-ohjelma pienille yhdistyksille ja yhteisöille</strong><br/>
  Web-pohjainen &middot; Omalla palvelimella &middot; SQLite-tietokanta yhdessä tiedostossa
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/SQLite-Prisma-blue?logo=sqlite" alt="SQLite + Prisma" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" />
  <img src="https://img.shields.io/badge/node-%3E%3D22-brightgreen?logo=node.js" alt="Node >= 22" />
</p>

---

![Yleiskatsaus](screenshots/yleiskatsaus.png)

---

## Miksi Pikkukirja?

Pieni yhdistys ei tarvitse raskasta kirjanpito-ohjelmaa. Pikkukirja on kevyt, selaimella käytettävä ohjelma joka pyörii edullisella VPS-palvelimella. Kaikki data on yhdessä SQLite-tiedostossa — helppo varmuuskopioida, siirtää ja arkistoida.

---

## Tuetut organisaatiotyypit

| Tyyppi | Kuvaus | Laskutusperuste |
|--------|--------|-----------------|
| **Tiekunta** | Yksityisteiden tiekunnat | Tieyksiköt |
| **Metsästysseura** | Metsästysseurat | Kiinteä jäsenmaksu jäsentyypin mukaan |
| **Taloyhtiö** | Pienet taloyhtiöt | Osakemäärä (yhtiövastike) |
| **Toiminimi** | Yksityiset elinkeinonharjoittajat | Vapaa laskutus + ALV-seuranta |

Jokaisella organisaatiotyypillä on oma tilikartta, omat tilit laskuille ja raporteille sekä sopivat oletusotsikot toimintakertomukseen.

---

## Ominaisuudet

```
┌─────────────────────────────────────────────────────────────────┐
│                        PIKKUKIRJA                               │
├──────────┬──────────┬──────────┬──────────┬─────────────────────┤
│  Kirjan- │ Jäsen-   │ Lasku-   │ Raportit │    Hallinta         │
│  pito    │ rekisteri│ tus      │ & PDF    │                     │
├──────────┼──────────┼──────────┼──────────┼─────────────────────┤
│ Tositteet│ Yhteys-  │ PDF-     │ Tulos-   │ Käyttäjäroolit      │
│ Tilikartta│ tiedot  │ laskut   │ laskelma │ (admin/user/viewer) │
│ Liitteet │ Viite-   │ Sähkö-   │ Tase     │ SMTP-asetukset      │
│ Mallit   │ numerot  │ posti-   │ Päiväkirja│ Tapahtumaloki      │
│ CSV-vienti│ CSV-    │ lähetys  │ Pääkirja │ Varmuuskopiointi    │
│ Täsmäytys│ tuonti   │ Muistu-  │ Koetase  │ Cron-ajastus        │
│          │          │ tukset   │ Vuosi-   │ Tumma/vaalea teema  │
│          │          │ Pankki-  │ kokous   │                     │
│          │          │ tuonti   │ Pöytä-   │                     │
│          │          │          │ kirjat   │                     │
├──────────┴──────────┴──────────┴──────────┴─────────────────────┤
│  Tiliotteet  │  Budjetointi  │  ALV-seuranta  │  Kokoukset      │
└──────────────┴───────────────┴────────────────┴─────────────────┘
```

### Kirjanpito

![Tositekirjaus](screenshots/tositekirjaus.png)

- Kahdenkertainen kirjanpito tositteilla
- **Tositteen kopiointi** — kopioi olemassa olevan tositteen pohjana uudelle
- **Liitteet** — kuitti tai asiakirja (PDF, JPEG, PNG, GIF, WebP, max 10 MB) tositteeseen; paperilippu-kuvake päiväkirjassa
- **Liitearkisto** — yleisnäkymä kaikista liitteistä organisaatiotasolla; haku nimellä tai suodatus liittämättömiin
- **Tositemallipohjat** — tallenna toistuvat kirjaukset mallipohjiksi (kuukausittainen, neljännesvuosittainen, vuosittainen); käytä pikavalikosta
- **Kaksoiskappaleiden tunnistus** — varoitus jos samankaltainen tosite (±3 pv, sama summa, samankaltainen kuvaus) on jo olemassa
- **Päiväkirjan haku** — suodata kuvauksella, tositenumerolla, tilinumerolla tai tilin nimellä
- **CSV-vienti** — tositteet riveineen CSV-tiedostona (Excel-yhteensopiva, UTF-8 BOM)
- Tilikartan hallinta (tulo-, meno- ja tasetilit)
- Reaaliaikainen debet/kredit-täsmäytys
- Varoitus epätavallisista kirjauksista (esim. debet tulo-tilille)

### Tilikauden hallinta

- Useampi tilikausi per organisaatio
- Tilikauden päättäminen: tulostilien nollaus voitto/tappio-tilille
- Uuden tilikauden avaus: taseen siirtyminen avaavana tositteena — vahvistusvalintaikkuna estää vahingolliset avaukset
- Suljetun tilikauden tositteet näkyvät lukitussa tilassa

### Jäsen- ja asiakasrekisteri

- Yhteystiedot (nimi, osoite, sähköposti)
- Organisaatiotyyppikohtaiset kentät:
  - **Tiekunta** — kiinteistöt ja tieyksiköt
  - **Metsästysseura** — jäsentyyppi (varsinainen, koejäsen, nuori, kunniajäsen)
  - **Taloyhtiö** — huoneistot ja osakemäärä
  - **Toiminimi** — asiakasluettelo
- Viitenumerot pankkimaksuja varten (generoidaan automaattisesti)
- **CSV-tuonti / -vienti** — tuo jäseniä tiedostosta tai lataa luettelo
- Jäsentä, jolla on laskuja, ei voi vahingossa poistaa

### Laskutus

![Jäsenlaskutus](screenshots/jäsenlaskutus.png)

- PDF-laskujen generointi kaikille jäsenille kerralla
- **Tiekunta / taloyhtiö** — hinta × yksiköt + hallinnointimaksu
- **Metsästysseura** — kiinteä jäsenmaksu jäsentyypin mukaan
- **Toiminimi + ALV** — veroton hinta, ALV-osuus ja bruttosumma eriteltyinä
- Yksittäin tai kaikki kerralla ZIP-pakettina
- **Osamaksut** — useampi suoritus per lasku; saldo päivittyy automaattisesti
- Haku nimellä, laskunumerolla tai viitenumerolla; suodatus tilalla
- Erääntyneiden laskujen korostus
- **Sähköpostilähetys** — laskut suoraan sähköpostiin PDF-liitteenä
- **Maksumuistutukset** — muistutussähköposti avoimille/erääntyneille laskuille
- **Ajoitetut muistutukset** — cron-endpoint automaattisille muistutuksille
- **Pankin CSV-tuonti** — automaattinen täsmäytys viitenumeron perusteella, maksetuksi merkintä ja tositteiden luonti

### Raportit ja PDF-tulosteet

| Raportti | Kuvaus |
|----------|--------|
| **Tuloslaskelma** | Monivuotinen vertailu — nykyinen tilikausi rinnakkain 1–4 aiemman vuoden kanssa |
| **Tase** | Vastaavaa / vastattavaa |
| **Koetase** | Kaikkien tilien debet-, kredit- ja saldosummat; tasapainocheck |
| **Päiväkirja PDF** | Kaikki tositteet tileineen |
| **Pääkirja PDF** | Tilikohtainen erittely juoksevalla saldolla |
| **Toimintakertomus** | Muokattavat osiot, oletusrakenne organisaatiotyypin mukaan |
| **Vuosikokous PDF** | Kansilehti, toimintakertomus, tuloslaskelma + tase, allekirjoitusrivit |
| **Kokouspöytäkirja PDF** | Yksittäisen kokouksen pöytäkirja allekirjoitusriveineen |

### Kokoukset

- Kokouspöytäkirjat tilikauteen sidottuna (vuosikokous, hallituksen kokous, ylimääräinen kokous)
- Päätökset §-numeroituna — tila: hyväksytty, hylätty tai siirretty

### Koontinäkymä (Dashboard)

- Jäsenmäärä, avoimet laskut, kassatilanne
- Kuukausittainen tulo/meno-pylväskaavio
- Budjettikäyttöaste tilikohtaisesti
- Laskujen ikäanalyysi (ei erääntynyt / 1–30 pv / 31–60 pv / yli 60 pv myöhässä)

### ALV-seuranta (toiminimi)

- Myynti-ALV ja osto-ALV kirjataan tositteiden riveille
- Kertymä neljännesvuosittain tai kuukausittain
- Merkitse jakso ilmoitetuksi päivämäärällä

### Tiliotteet

- Tuo pankin tiliotetiedosto (CSV tai CAMT.053 XML)
- Tuetut pankit: OP, Nordea, S-Pankki, Aktia (CSV); kaikki CAMT.053-yhteensopivat pankit (XML)
- Täsmäytä tapahtumat kirjanpitotositteisiin

### Budjetointi

- Tilikohtainen budjetti per tilikausi
- Budjetti vs. toteutuma -näkymä (euroa ja prosentti)
- Muokattavissa niin kauan kuin tilikausi on auki

### Käyttäjähallinta

| Rooli | Oikeudet |
|-------|----------|
| **Admin** | Pääsy kaikkiin organisaatioihin ja hallintapaneeliin |
| **Käyttäjä** | Luku- ja kirjoitusoikeus omiin organisaatioihinsa |
| **Vain luku** | Katseluoikeus omiin organisaatioihinsa |

- Käyttäjäkohtainen pääsy organisaatioihin
- **Google-kirjautuminen** — kirjaudu Google-tilillä salasanan sijaan; pääsy vaatii adminilta kutsun (7 vrk voimassa)
- Salasanakäytäntö: vähintään 8 merkkiä + numero tai erikoismerkki
- Salasanan vaihto profiilista; palautuslinkki sähköpostilla
- **Kaksivaiheinen tunnistautuminen (2FA)** — TOTP-pohjainen (Google Authenticator, Aegis ym.) pakollinen admin-käyttäjille; 10 kertakäyttöistä varakoodia
- **Kirjautumisrajoitus** — 5 epäonnistunutta yritystä lukitsee tilin 15 minuutiksi
- Tapahtumaloki: tositteiden, laskujen, jäsenten ja käyttäjien luonti/muokkaus/poisto
- SMTP-asetukset admin-paneelista (ei vaadi uudelleenkäynnistystä)
- Tumma/vaalea teema, muistaa valinnan selaimen tallennukseen

### Varmuuskopiointi

- **Manuaalinen lataus** — lataa tietokanta admin-paneelista; varoitus jos yli 7 päivää edellisestä
- **Automaattinen** — cron-pohjainen kopio palvelimelle; konfiguroitavissa admin-paneelista (hakemisto, säilytettävien kopioiden määrä)

---

## Tekniikka

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Selain    │────▶│  Next.js 16  │────▶│   SQLite     │
│  (React 19) │◀────│  App Router  │◀────│  (Prisma)    │
└─────────────┘     └──────┬───────┘     └──────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │  PDF     │ │  SMTP    │ │  PM2     │
        │ @react-  │ │ Node-    │ │ prosessi-│
        │ pdf      │ │ mailer   │ │ hallinta │
        └──────────┘ └──────────┘ └──────────┘
```

| Osa | Teknologia |
|-----|-----------|
| Frontend & backend | Next.js 16 (App Router), React 19 |
| Tietokanta | SQLite (better-sqlite3) |
| ORM | Prisma 7 |
| Käyttöliittymä | shadcn/ui + Tailwind CSS 4 |
| Autentikaatio | NextAuth v5 (credentials + Google OAuth) |
| PDF-generointi | @react-pdf/renderer |
| XML-parserointi | fast-xml-parser (CAMT.053) |
| Viivakoodit | bwip-js |
| Sähköposti | Nodemailer (SMTP) |
| Prosessinhallinta | PM2 |

Tietokanta on yksittäinen tiedosto (`data/prod.db`), joka on helppo varmuuskopioida.

---

## Kehitysympäristö

```bash
npm install
npx prisma generate
npx prisma db push   # tai: npx prisma migrate dev
npm run dev
```

Sovellus käynnistyy osoitteeseen `http://localhost:3000`.

---

## Tuotantoon vienti

Katso [RUNBOOK.md](RUNBOOK.md) — ohjeet VPS-palvelimelle asentamisesta, Nginx-konfiguraatiosta, varmuuskopioinnista ja päivityksistä.

---

## Ajoitetut toiminnot (cron)

Sovelluksessa on kolme cron-endpointia, joille kaikille löytyy URL ja testinappi admin-paneelista:

| Endpoint | Admin-paneelissa | Kuvaus |
|----------|------------------|--------|
| `/api/cron/reminders` | Muistutukset | Maksumuistutusten automaattinen lähetys |
| `/api/cron/backup` | Varmuuskopiointi | Automaattinen tietokantakopio palvelimelle |
| `/api/cron/report-delivery` | Raportit | Ajoitettu raportti sähköpostiin |

```bash
# Esimerkit crontab-merkinnöistä (avain Authorization-otsakkeessa, ei URL:ssa)
0 9 * * *   curl -s -H "Authorization: Bearer <avain>" "https://palvelin.example.com/api/cron/reminders"       > /dev/null
0 3 * * *   curl -s -H "Authorization: Bearer <avain>" "https://palvelin.example.com/api/cron/backup"          > /dev/null
0 8 * * 1   curl -s -H "Authorization: Bearer <avain>" "https://palvelin.example.com/api/cron/report-delivery" > /dev/null
```

---

## Kansiorakenne

```
pikkukirja/
├── prisma/                 # Tietokantakaavio ja migraatiot
├── scripts/                # Apuskriptit (TLK-tuonti ym.)
├── src/
│   ├── app/                # Sivut ja API-reitit (App Router)
│   │   ├── admin/          #   Hallintapaneeli
│   │   ├── api/            #   REST-endpointit
│   │   ├── associations/   #   Organisaationäkymät
│   │   └── login/          #   Kirjautuminen
│   ├── components/
│   │   ├── fiscal-year/    #   Tilikauden välilehdet ja dialogit
│   │   ├── invoice/        #   PDF-komponentit (laskut, raportit, pöytäkirjat)
│   │   └── ui/             #   shadcn/ui-peruskomponentit
│   ├── hooks/              # React-hookit
│   ├── lib/                # Apufunktiot (prisma, auth, orgLabels ym.)
│   └── generated/          # Prisma-generoitu client
├── data/                   # SQLite-tietokanta ja asetustiedostot (tuotanto)
├── public/                 # Staattiset tiedostot (logo ym.)
├── RUNBOOK.md              # Asennus- ja ylläpito-ohjeet
└── README.md
```

---

## Lisenssi

[MIT](LICENSE) &copy; 2026 Pekka Lyyra
