# GRC-verktyget

Method IT:s verktyg för gap-analys och riskarbete enligt ISO/IEC 27001:2022. Konsulten använder det tillsammans med kunden och går igenom tre delar:

- **Riskbedömning:** först bestäms riskmetoden, sedan byggs riskregistret upp.
- **Krav och kontroller:** alla krav och kontroller bedöms, och en SoA tas fram.
- **Resultat:** en åtgärdsplan och en rapport.

Verktyget är en fristående webbapp utan server. Varje kunduppdrag sparas som en projektfil i kundens egen mapp, och ingenting lagras hos Method IT.

Det är ett nytt verktyg, byggt från grunden. Det gamla enfilsverktyget (`legacy/method-grc-verktyg.html`) är förebild för innehåll och arbetssätt, men dess sparfiler går inte att öppna i det nya (ARCHITECTURE B-16).

> **Designbeslut** och skälen bakom dem finns i [ARCHITECTURE.md](ARCHITECTURE.md). Läs den först när du tar upp arbetet på en ny dator. Planen med faser och milstolpar (Plan 2.0) hålls utanför repot.

**Innehåll**

1. [Kom igång](#1-kom-igång)
2. [Projektstruktur](#2-projektstruktur)
3. [Hur verktyget är uppbyggt](#3-hur-verktyget-är-uppbyggt)
4. [Funktioner](#4-funktioner)
5. [Projektfilens format](#5-projektfilens-format)
6. [Lägga till ett nytt ramverk](#6-lägga-till-ett-nytt-ramverk)
7. [Arbetssätt](#7-arbetssätt)
8. [Faser](#8-faser)

---

## 1. Kom igång

Du behöver Node 24 (se `.nvmrc`). Med nvm räcker det att köra `nvm use` i projektmappen.

```bash
npm install          # installerar exakt de versioner som står i package-lock.json
npm run dev          # startar utvecklingsservern på http://localhost:5173
npm test             # kör alla tester en gång
npm run test:watch   # kör om testerna vid varje ändring
npm run check        # typkontroll (Svelte + TypeScript)
npm run build        # bygger verktyget till en enda fil: dist/index.html
npm run preview      # visar det byggda verktyget i webbläsaren
```

`npm run build` gör två saker: Vite bygger och bäddar in allt i `dist/index.html`, och sedan kontrollerar `scripts/finalize-build.mjs` att filen är fristående och lägger in en säkerhetspolicy (ARCHITECTURE B-03 och B-20). Det är `dist/index.html` som delas ut till konsulterna. Den går att öppna direkt från disk, utan server och utan nät.

## 2. Projektstruktur

Filer markerade med ✅ finns redan. Resten är målbilden som byggs upp fas för fas.

```
grc-tool/
├── ARCHITECTURE.md                   ✅ designbeslut
├── README.md                         ✅ den här filen
├── index.html                        ✅ HTML-mallen som Vite bygger från
├── package.json / package-lock.json  ✅
├── vite.config.ts                    ✅ Svelte, YAML-import, bygge till en fil
├── legacy/method-grc-verktyg.html    ✅ det gamla verktyget, bara som referens
├── scripts/
│   ├── extract-framework.mjs         ✅ engångsskript: gamla HTML-verktyget → YAML
│   └── finalize-build.mjs            ✅ kontroll av bygget + CSP (körs av npm run build)
├── tests/fixtures/                   ✅ påhittade projektfiler för tester
└── src/
    ├── main.ts / App.svelte          ✅ startpunkt (i fas 0 ett enkelt skal)
    ├── app.css                       ✅ grundstil, färger från det gamla verktyget
    ├── yaml.d.ts / globals.d.ts      ✅ typning av *.yaml-importer och byggkonstanter
    ├── lib/
    │   ├── frameworks/               ✅ ramverk som data
    │   │   ├── schema.ts             ✅ zod-schema för alla ramverk
    │   │   ├── iso27001-2022.yaml    ✅ 26 grundkrav + 93 Annex A-kontroller
    │   │   ├── iso27001.test.ts      ✅
    │   │   ├── index.ts              ✅ register över tillgängliga och kommande ramverk
    │   │   └── index.test.ts         ✅
    │   ├── project/                  ✅ projektfilen (.grc.json)
    │   │   ├── schema.ts             ✅ zod-schema för projektfilen
    │   │   ├── project.ts            ✅ skapa, läsa in, skriva ut, kontrollera mot ramverk
    │   │   ├── project.test.ts       ✅
    │   │   └── store.svelte.ts       app-state med Svelte-runes
    │   ├── zod-setup.ts              ✅ zod utan kodgenerering (krävs av CSP)
    │   ├── risk/                     riskmetod, riskvärden, nivåer, restrisk
    │   ├── storage/                  öppna, spara och autospara fil
    │   └── report/                   rapport och SoA för utskrift
    ├── views/                        en komponent per flik (se avsnitt 4)
    └── components/                   återanvändbara delar: statusväljare, filter, matris …
```

**Tumregel för var koden hör hemma:**

- **`lib/`:** ren TypeScript utan Svelte, så att logiken kan testas utan UI.
- **`views/` och `components/`:** bara presentation. De läser från och skriver till `store`.

## 3. Hur verktyget är uppbyggt

Verktyget bygger på tre lager:

```
 Ramverk (YAML, skrivskyddat)   +   Projektfil (.grc.json, kundens data)
            │                                  │
            └──────────────┬───────────────────┘
                           ▼
                 store.svelte.ts  (state i minnet)
                           │
          ┌────────────────┼──────────────────┐
          ▼                ▼                  ▼
     Vyer (flikar)   Beräkningar (lib/)   Lagring (autospara)
```

1. **Ramverket** beskriver *vad som ska bedömas*. Det byggs in i verktyget och ändras aldrig av användaren.
2. **Projektfilen** beskriver *kundens svar*: status, motiveringar, risker och åtgärder. Den pekar på kontroller via deras ID, till exempel `"A.8.20"`.
3. **Store** laddar projektfilen, validerar den och exponerar den som reaktiv state.
   - Alla ändringar går via store, som markerar filen som osparad och startar autosparningen.
   - Allt som kan räknas fram räknas fram med `$derived` och sparas aldrig i filen. Det gäller uppfyllnadsgrad, riskvärden, faktisk restrisk och listor som "behöver uppmärksamhet".

### Principer

- **Validera vid gränserna.** Allt som läses in, alltså ramverk, projektfiler och gamla exporter, går genom zod innan det används. En ogiltig fil ger ett begripligt felmeddelande, aldrig ett halvt laddat projekt.
- **Fungera helt utan nät.** Verktyget ska byggas till en enda HTML-fil där allt är inbäddat.
- **Aldrig tyst dataförlust.** Om verktyget inte kan spara ska det synas tydligt, och stängning av fliken ska varnas för när det finns osparade ändringar.
- **Svenska i gränssnittet, engelska i koden.** Fältnamn och variabler skrivs på engelska, alla texter i UI på svenska.

## 4. Funktioner

Funktionerna nedan är det verktyget ska kunna. Skisserna finns hos Mateusz (skärm 1–5 och 7).

### 4.1 Startsida

- **Nytt arbete**
  - **Kund:** fritext.
  - **Ramverk:** ett per arbete. Kort visas för ISO 27001:2022, NIS2, CIS Controls v8 och DORA. Bara ramverk som finns i `lib/frameworks/` går att välja, övriga visas som "kommer".
  - **Startpunkt för riskregistret:**
    - *Med typrisker:* ungefär 28 vanliga risker förifyllda.
    - *Tomt register.*
    - *Kopiera från kund:* återanvänder riskmetod och struktur från ett tidigare uppdrag, men inte bedömningarna.
  - **Sparplats:** efter valen väljer användaren var projektfilen ska sparas.
- **Öppna befintligt arbete:** dra in en `.grc.json`, eller välj fil. Exportfiler från det gamla verktyget känns igen och avvisas med ett tydligt meddelande (ARCHITECTURE B-16).
- **Senaste arbeten:** kund, ramverk, senast ändrad och uppfyllnadsgrad, med knappen "Fortsätt".
- **Informationsrad:** "Bedömningen sparas som en fil i kundens mapp. Inget lagras hos Method IT."

### 4.2 Sidhuvud (alla vyer)

- Kundnamn och ramverk.
- **Sparstatus:** "Autosparat till nordvik.grc.json · 14:42" eller "Osparade ändringar sedan 14:32" (i varningsfärg).
- Knapparna **Rapport** och **Spara**.
- **Flikar:** Översikt · Riskmetod · Riskregister · Grundkrav · Annex A · SoA · Åtgärdsplan. Flikarna har räknare, till exempel antal risker, krav, kontroller och åtgärder.

### 4.3 Översikt

- **Uppfyllnadsgrad:** `uppfyllda / tillämpliga`, där bortvalda kontroller i SoA inte räknas.
  - Visas totalt, per avsnitt (grundkrav, Annex A) och per tema (A.5–A.8).
- **Fördelning per status:** Uppfylld, Delvis uppfylld, Ej uppfylld, Ej bedömd och Ej tillämplig.
- **Nyckeltal för risker:** antal, över acceptansnivå, restrisk ej uppnådd och väntar på godkännande.
- **Genvägar** till det som behöver uppmärksamhet.

### 4.4 Riskmetod (steg 1 i riskarbetet)

Riskmetoden är underlag för krav 6.1.2 och 8.2 och skrivs ut som bilaga i rapporten.

- **Konsekvensskala 1–5**
  - Nivåerna heter Försumbar, Begränsad, Måttlig, Allvarlig och Kritisk.
  - Det finns en kolumn per konsekvenstyp. Standard är "Verksamhet och ekonomi" samt "Information och anseende".
  - Användaren kan lägga till konsekvenstyper, till exempel hälsa och säkerhet.
  - Alla texter går att redigera genom att klicka i en ruta. Knappen "Återställ standard" finns.
- **Sannolikhetsskala 1–5**
  - Nivåerna heter Mycket osannolik, Osannolik, Möjlig, Sannolik och Mycket sannolik.
  - Varje nivå har en frekvens och en tolkning, och alla texter går att redigera.
- **Riskmatris 5×5:** riskvärde = konsekvens × sannolikhet. Nivåerna är:

  | Nivå | Riskvärde |
  |---|---|
  | Låg | 1–3 |
  | Medel | 4–6 |
  | Hög | 8–12 |
  | Mycket hög | 15–25 |

- **Acceptanskriterium:** risker med värde upp till gränsen (standard 6) är acceptabla. Risker över gränsen kräver behandlingsbeslut och ägare.
- **Intervall för ny bedömning:** standard är var 12:e månad och vid väsentlig förändring. "Nästa bedömning" räknas fram.
- **Fastställd av:** namn, roll och datum.

### 4.5 Riskregister (steg 2 i riskarbetet)

Riskregistret är underlag för krav 6.1.1, 6.1.3 och 8.2.

- **Nyckeltal:**
  - antal risker
  - över acceptansnivå
  - restrisk ej uppnådd
  - väntar på godkännande
- **Värmekarta** med antal risker per ruta i matrisen, med växling mellan *före* och *efter* behandling.
- **Tabell** med kolumnerna:
  - ID (`R-001` …)
  - risk och tillgång
  - ägare
  - K, S och värde (färg efter nivå)
  - behandling: Reducera, Dela, Acceptera, Undvik eller *Ej beslutad*
  - kopplade kontroller
  - restrisk
  - godkänd
- **Sök och filter:** fritext, nivå, ägare och behandling.
- **Koppla kontroller:** en dialog med sökning bland Annex A-kontrollerna. Föreslagna kontroller markeras.
  - Kopplade kontroller **låses som tillämpliga i SoA**.
  - Om en kontroll som är bortvald i SoA kopplas, tas den tillbaka automatiskt och användaren får en tydlig notis om det.
- **Varning** när faktisk restrisk är högre än planerad, till exempel "▲ Faktisk 12 — A.8.20 delvis".
- **Ny risk** och **Importera typrisker**.
- **Markering av saknade uppgifter:** risker som saknar ägare eller behandlingsbeslut markeras.

### 4.6 Riskdetalj

- **Riskinformation:**
  - beskrivning, hot och sårbarhet
  - berörda tillgångar eller processer
  - riskägare
  - behandlingsval och plan
  - datum: identifierad, senast bedömd och nästa bedömning
- **Bedömning i tre steg**, visade som tre markeringar i samma matris:

  | Steg | Hur värdet tas fram |
  |---|---|
  | Före behandling | Anges för hand (K × S) |
  | Planerad restrisk | Anges för hand |
  | Faktisk restrisk | Räknas fram från status på kopplade kontroller (regeln är en öppen fråga, se ARCHITECTURE Ö-03) |

- **Kopplade kontroller:** ref, namn, status och SoA-läge ("Låst tillämplig"). Knappen "+ Koppla kontroll".
- **Historik** över ändringar, till exempel ändrad status på kopplad kontroll, ny koppling eller risk skapad från typrisk.
- **Godkännande av restrisk:**
  - Om faktisk restrisk ligger över acceptansnivån kan riskägaren bara godkänna genom ett aktivt beslut att acceptera högre risk. Det beslutet kräver en motivering.
  - Godkännandet sparar namn och datum.
- **Kopplad åtgärd** i åtgärdsplanen.
- **Navigering** till föregående och nästa risk.

### 4.7 Grundkrav och Annex A

Grundkrav och Annex A använder samma vy, med en växlare mellan dem.

- **Sidomeny:**
  - uppfyllnadsgrad
  - teman eller kapitel med stapel per status
  - "Behöver uppmärksamhet": ej bedömda, saknar evidens och saknar ansvarig
- **Verktygsrad:**
  - sök i kontroll, kommentar och filnamn
  - filtrera på status
  - "Dölj ej tillämpliga"
  - "Visa alla detaljer" och "Dölj detaljer"
- **Rad per kontroll:** ID, namn, antal bilagor, kopplade risker och status.
- **Öppnad kontroll:**
  - **Status:** Uppfylld, Delvis uppfylld, Ej uppfylld eller Ej bedömd.
  - **Motivering och observation:** fritext. Knappen "Föreslå text från risker" hämtar text från kopplade risker.
  - **Ansvarig** och **kopplade risker** (med riskvärde).
  - **Bevisbörda:** texten `guidance` från ramverket, skrivskyddad.
  - **Bifogad evidens:** dra in filer eller klicka för att bifoga. Filerna sparas i en evidensmapp bredvid projektfilen i kundens mapp. Projektfilen innehåller bara sökväg, storlek, kontrollsumma, källa (manuell eller automatisk), vem som lade till filen och när. Saknas filen, eller har den ändrats, visas en varning.
  - **Teknisk och organisatorisk del (valfritt):** statusen kan delas upp i två delar som underlag. Den övergripande statusen sätts alltid av konsulten (ARCHITECTURE B-18).
  - **Sidfot:** "Senast uppdaterad … av …".
- **Åtgärd skapas automatiskt** när status sätts till Delvis eller Ej uppfylld. Den föreslås i åtgärdsplanen och länkas med "Visa".
- **Bortvalda kontroller** i Annex A visas utgråade och kan inte bedömas.
- **Grundkrav kan aldrig väljas bort.**

### 4.8 SoA (Statement of Applicability)

- **Lista** över alla Annex A-kontroller med kryssruta för *tillämplig*.
- **Bortvalda kontroller** kräver en motivering. Tillämpliga kontroller kan också få en motivering.
- **Låsta kontroller:** kontroller som är kopplade till risker är låsta som tillämpliga och visar vilka risker det gäller.
- **Filter:** alla, tillämpliga, bortvalda, och bortvalda utan motivering (det som stoppar en godkänd SoA).
- **Sammanfattning:** antal tillämpliga, antal bortvalda och antal saknade motiveringar.
- **Export:** SoA kan exporteras separat för utskrift (krav 6.1.3 d).

### 4.9 Åtgärdsplan

- **Åtgärder** skapas automatiskt från kontroller som är Delvis eller Ej uppfyllda, och från risker över acceptansnivån. De kan också skapas för hand.
- **Fält per åtgärd:**
  - beskrivning och ansvarig
  - deadline
  - status: Ej påbörjad, Pågår eller Klar
  - källa, till exempel "Genererad från A.8.20"
- **Sortering och filter:** ansvarig, deadline, status och försenade.
- **Koppling tillbaka:** en klar åtgärd föreslår att kontrollens status ses över. Status ändras inte automatiskt.

### 4.10 Rapport

- **Utskriftsvänlig rapport** (webbläsarens "Skriv ut → Spara som PDF"). Den innehåller:
  - sammanfattning och uppfyllnadsgrad
  - riskmetoden som bilaga
  - riskregistret
  - grundkrav och Annex A med status, motivering och ansvarig
  - SoA
  - åtgärdsplan
- **Kundnamn, datum och ramverk** står på varje sida.

### 4.11 Spara och öppna

- **"Spara" och "Spara som"** skriver direkt till en fil i kundens SharePoint-mapp (Chrome och Edge). I Safari och Firefox laddas filen ned i stället (ARCHITECTURE Ö-01).
- **Autosparning** var tionde minut, men bara när något har ändrats.
- **Sparstatus** visas tydligt: sparat till fil, osparade ändringar, eller bara sparat i webbläsaren.
- **Osparade ändringar** ger en varning vid stängning.
- **Ogiltig projektfil** ger ett tydligt fel om vad som är fel. Filen skrivs aldrig över.

## 5. Projektfilens format

Schemat finns i [`src/lib/project/schema.ts`](src/lib/project/schema.ts), och en komplett påhittad exempelfil finns i [`tests/fixtures/exempel.grc.json`](tests/fixtures/exempel.grc.json). Skälen bakom formatet står i ARCHITECTURE B-17.

```jsonc
{
  "schemaVersion": 1,
  "tool": "method-grc",
  "id": "0f8c2b7e-…",                  // unikt för bedömningen
  "previousId": "…",                   // valfritt: bedömningen den utgår från (fas 7)
  "client": { "name": "Exempelbolaget AB" },
  "framework": { "id": "iso27001", "version": "2022" },
  "createdAt": "2026-09-02T09:00:00Z",
  "updatedAt": "2026-09-22T14:42:00Z",

  "riskMethod": { … },                 // skalor, acceptansnivå, intervall, fastställd av

  "risks": [{
    "id": "R-001",
    "title": "Obehörig åtkomst via öppen fjärrskrivbordsport",
    "owner": "Bertil Berg, IT-chef",
    "before":  { "consequence": 4, "likelihood": 4 },
    "planned": { "consequence": 4, "likelihood": 1 },
    "treatment": "reduce",
    "controls": [{ "control": "A.8.20", "effect": "high", "type": "preventive" }],
    "evidence": [],
    "identifiedAt": "2026-09-02",
    "approval": null,
    "history": [{ "at": "2026-09-09T10:00:00Z", "by": "Konsult K.", "text": "A.5.15 kopplad" }]
  }],

  "controls": {
    "A.8.20": {
      "status": "partial",
      "parts": { "technical": "not_fulfilled", "organizational": "fulfilled" },
      "comment": "…", "owner": "…", "evidenceNote": "",
      "applicable": true, "soaJustification": "",
      "evidence": [{ "id": "EV-001", "file": "evidens/Natverkspolicy_v2.1.pdf", "size": 348160,
                     "sha256": "…", "source": "manual",
                     "addedBy": "Cecilia Carlsson", "addedAt": "2026-09-18T11:20:00Z" }],
      "updated": { "at": "2026-09-22T14:40:00Z", "by": "Konsult K." }
    }
  },

  "actions": [{
    "id": "ATG-001", "title": "Stäng port 3389 och inför säker fjärråtkomst",
    "owner": "Bertil Berg", "due": "2026-10-15", "status": "in_progress",
    "source": { "type": "control", "id": "A.8.20" },
    "controls": ["A.8.20"], "risks": ["R-001"], "createdAt": "2026-09-22"
  }],

  "nextNumber": { "risk": 4, "action": 2, "evidence": 2 }
}
```

**Regler för formatet:**

- **Tillåtna värden:**
  - status: `not_assessed`, `fulfilled`, `partial` eller `not_fulfilled`
  - behandling: `undecided`, `reduce`, `share`, `accept` eller `avoid`
  - åtgärdsstatus: `not_started`, `in_progress` eller `done`
  - evidensens källa: `manual` eller `automatic`
- **Fasta ID:n.** Risker (`R-001`), åtgärder (`ATG-001`) och evidens (`EV-001`) får löpnummer från `nextNumber`. Ett ID återanvänds aldrig, inte ens när posten tas bort.
- **Beräknade värden sparas aldrig.** Det gäller riskvärde, nivå, faktisk restrisk och uppfyllnadsgrad.
- **Kontroller som inte finns i `controls`** tolkas som `not_assessed`, alltså tillämpliga men ännu inte bedömda.
- **Fält som saknas** fylls i med standardvärden vid inläsning, så filen behöver inte innehålla tomma fält.
- **Kopplingar mot ramverket** (okända kontroll-ID:n, bortvald kontroll som är kopplad till en risk) kontrolleras med `checkAgainstFramework()` i `project.ts`.

## 6. Lägga till ett nytt ramverk

1. **Skapa filen** `src/lib/frameworks/<id>-<version>.yaml` enligt schemat i `schema.ts`. Använd `iso27001-2022.yaml` som mall.
   - Alla ID:n ska vara fullständiga textsträngar.
   - Sätt `soa: true` bara på avsnitt som ska ingå i en SoA.
2. **Registrera ramverket** i `src/lib/frameworks/index.ts`: importera YAML-filen, lägg den i `available` och ta bort posten ur `upcoming` om den fanns där.
3. **Skriv ett test** `<id>.test.ts` som låser antalet kontroller per grupp, på samma sätt som `iso27001.test.ts`.
4. **Kör kontrollerna:** `npm test` och `npm run check`.
5. **Dokumentera ändringar** i ARCHITECTURE.md om ramverket kräver ändringar i schemat. Nya fält är alltid valfria.

## 7. Arbetssätt

- **Designbeslut** skrivs in i [ARCHITECTURE.md](ARCHITECTURE.md) i samma commit som koden som följer av beslutet.
- **Nya paket** installeras med `npm install`, och både `package.json` och `package-lock.json` committas.
- **Planer, rapporter och andra dokument** hålls utanför repot. Repot innehåller bara kod och det som beskriver koden: README och ARCHITECTURE.
- **Kunddata committas aldrig.** `*.grc.json` och `exports/` är ignorerade. Testfiler läggs avidentifierade i `tests/fixtures/`.
- **Sökvägar i skript** byggs med `node:path` (`join`, `resolve`), aldrig med hårdkodade snedstreck. Utvecklingen sker på både Mac och Windows.
- **Innan commit:** kör `npm test` och `npm run check`.

## 8. Faser

Faserna följer Plan 2.0, som hålls utanför repot. Verktyget ska gå att använda efter varje milstolpe.

| Fas | Innehåll | Milstolpe | Status |
|---|---|---|---|
| **0 · Kodgrund** | Projektuppsättning, ramverk som YAML, projektfilens datamodell, bygge till en HTML-fil | | Klar |
| **1 · Filsparande** | Spara, Spara som, autospara, sparstatus, varning vid stängning | | |
| **2 · Startsida** | Nytt arbete, öppna från fil, senaste arbeten | **M1:** ersätter dagens verktyg | |
| **3 · Risk** | Riskmetod, riskregister, riskdetalj, koppling risk ↔ kontroll, typrisker | | |
| **4 · Bilagor** | Evidens i mapp bredvid projektfilen, kontrollsumma, "saknar evidens" | | |
| **5 · Åtgärdsplan** | Åtgärder från kontroller och risker, riskbehandlingsplan enligt 6.1.3 | **M2:** hela ISO-cykeln | |
| **6 · Dashboard** | Uppfyllnad, riskprofil, åtgärder, redo för revision | | |
| **7 · Progress** | Jämförelse mellan två bedömningar | **M3:** uppföljning över tid | |
| **8 · Lansering** | Rapporter, kundtest, test på Mac och Windows, instruktion | **M4:** skarp version | |

Fas 3 och 4 kan göras parallellt, liksom fas 6 och 7. Fler ramverk (NIS2, CIS Controls v8, DORA), CloudSecComp och en skrivbordsversion kommer efter M4.
