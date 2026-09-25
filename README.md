# GRC-verktyget

Method IT:s verktyg för gap-analys och riskarbete enligt ISO/IEC 27001:2022. Konsulten använder det tillsammans med kunden och går igenom tre delar:

- **Riskbedömning:** först bestäms riskmetoden, sedan byggs riskregistret upp.
- **Krav och kontroller:** alla krav och kontroller bedöms, och en SoA tas fram.
- **Resultat:** en åtgärdsplan och en rapport.

Verktyget är en fristående webbapp utan server. Varje kunduppdrag sparas som en projektfil i kundens egen mapp, och ingenting lagras hos Method IT.

> **Designbeslut** och skälen bakom dem finns i [ARCHITECTURE.md](ARCHITECTURE.md). Läs den först när du tar upp arbetet på en ny dator.

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
npm run build        # bygger verktyget till dist/
```

## 2. Projektstruktur

Filer markerade med ✅ finns redan. Resten är målbilden som byggs upp fas för fas.

```
grc-tool/
├── ARCHITECTURE.md                   ✅ designbeslut
├── README.md                         ✅ den här filen
├── package.json / package-lock.json  ✅
├── vite.config.ts                    ✅ Svelte + YAML-import
├── scripts/
│   └── extract-framework.mjs         ✅ engångsskript: gamla HTML-verktyget → YAML
├── tests/fixtures/                   avidentifierade projektfiler för tester
└── src/
    ├── main.ts / App.svelte          ✅ startpunkt
    ├── yaml.d.ts                     ✅ typning av *.yaml-importer
    ├── lib/
    │   ├── frameworks/               ✅ ramverk som data
    │   │   ├── schema.ts             ✅ zod-schema för alla ramverk
    │   │   ├── iso27001-2022.yaml    ✅ 26 grundkrav + 93 Annex A-kontroller
    │   │   ├── iso27001.test.ts      ✅
    │   │   └── index.ts              register över tillgängliga ramverk
    │   ├── project/                  projektfilen (.grc.json)
    │   │   ├── schema.ts             zod-schema för projektfilen
    │   │   ├── store.svelte.ts       app-state med Svelte-runes
    │   │   └── legacy.ts             import av gamla exportfiler (v2–v4)
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
- **Öppna befintligt arbete:** dra in en `.grc.json`, eller välj fil. Gamla exportfiler från det tidigare verktyget känns igen och översätts (ARCHITECTURE B-11).
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
  - **Bifogad evidens:** dra in filer eller klicka för att bifoga. Filerna sparas i kundens mapp bredvid projektfilen. Projektfilen innehåller bara sökväg, storlek, vem som lade till filen och när.
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

- **Åtgärder** skapas automatiskt från kontroller som är Delvis eller Ej uppfyllda, och från risker med behandlingen *Reducera*. De kan också skapas för hand.
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

- **Autosparning** till projektfilen en kort stund efter varje ändring, och direkt när fliken döljs eller stängs.
- **"Spara" och "Spara som"** kan väljas manuellt.
- **Osparade ändringar** ger en varning vid stängning.
- **Ogiltig projektfil** ger ett tydligt fel om vad som är fel. Filen skrivs aldrig över.
- Hur sparningen sker tekniskt är en öppen fråga (ARCHITECTURE Ö-01).

## 5. Projektfilens format

Formatet är ett utkast. Det slutliga schemat definieras i `src/lib/project/schema.ts` (ARCHITECTURE B-10).

```jsonc
{
  "schemaVersion": 1,
  "tool": "method-grc",
  "client": { "name": "Nordvik Logistik AB" },
  "framework": { "id": "iso27001", "version": "2022" },
  "createdAt": "2026-09-02T09:00:00Z",
  "updatedAt": "2026-09-22T14:42:00Z",

  "riskMethod": {
    "consequence": { "types": ["Verksamhet och ekonomi", "Information och anseende"],
                     "levels": [{ "level": 1, "name": "Försumbar", "descriptions": ["…", "…"] }] },
    "likelihood":  { "levels": [{ "level": 1, "name": "Mycket osannolik", "frequency": "…", "interpretation": "…" }] },
    "acceptanceThreshold": 6,
    "reviewIntervalMonths": 12,
    "approvedBy": "Eva Lindqvist, vd",
    "approvedAt": "2026-09-22"
  },

  "risks": [{
    "id": "R-004",
    "title": "Obehörig åtkomst via öppen fjärrskrivbordsport",
    "description": "…", "threat": "…", "vulnerability": "…", "assets": ["…"],
    "owner": "Johan Ek, IT-chef",
    "before":  { "consequence": 4, "likelihood": 4 },
    "planned": { "consequence": 4, "likelihood": 1 },
    "treatment": "reduce",
    "treatmentPlan": "…",
    "controls": ["A.8.20", "A.8.5", "A.5.15"],
    "identifiedAt": "2026-09-02", "lastAssessedAt": "2026-09-22",
    "approval": null,
    "history": [{ "at": "2026-09-09", "by": "Mateusz W.", "text": "A.5.15 kopplad" }]
  }],

  "controls": {
    "A.8.20": {
      "status": "partial",
      "comment": "…",
      "owner": "Johan Ek, IT-chef",
      "applicable": true,
      "soaJustification": "",
      "evidence": [{ "file": "evidens/Natverkspolicy_v2.1.pdf", "size": 348160,
                     "addedBy": "Sara Holm", "addedAt": "2026-09-18" }],
      "updatedAt": "2026-09-22", "updatedBy": "Mateusz W."
    }
  },

  "actions": [{
    "id": "ATG-001",
    "title": "Stäng port 3389 i två nätverksregler och inför Azure Bastion",
    "owner": "Johan Ek", "due": "2026-10-15", "status": "in_progress",
    "source": { "type": "control", "id": "A.8.20" }
  }]
}
```

**Regler för formatet:**

- **Tillåtna värden:**
  - status: `not_assessed`, `fulfilled`, `partial` eller `not_fulfilled`
  - behandling: `reduce`, `share`, `accept`, `avoid` eller `undecided`
- **Beräknade värden sparas aldrig.** Det gäller riskvärde, nivå, faktisk restrisk och uppfyllnadsgrad.
- **Kontroller som inte finns i `controls`** tolkas som `not_assessed`, alltså tillämpliga men ännu inte bedömda.

## 6. Lägga till ett nytt ramverk

1. **Skapa filen** `src/lib/frameworks/<id>-<version>.yaml` enligt schemat i `schema.ts`. Använd `iso27001-2022.yaml` som mall.
   - Alla ID:n ska vara fullständiga textsträngar.
   - Sätt `soa: true` bara på avsnitt som ska ingå i en SoA.
2. **Registrera ramverket** i `src/lib/frameworks/index.ts`.
3. **Skriv ett test** `<id>.test.ts` som låser antalet kontroller per grupp, på samma sätt som `iso27001.test.ts`.
4. **Kör kontrollerna:** `npm test` och `npm run check`.
5. **Dokumentera ändringar** i ARCHITECTURE.md om ramverket kräver ändringar i schemat. Nya fält är alltid valfria.

## 7. Arbetssätt

- **Designbeslut** skrivs in i [ARCHITECTURE.md](ARCHITECTURE.md) i samma commit som koden som följer av beslutet.
- **Nya paket** installeras med `npm install`, och både `package.json` och `package-lock.json` committas.
- **Kunddata committas aldrig.** `*.grc.json` och `exports/` är ignorerade. Testfiler läggs avidentifierade i `tests/fixtures/`.
- **Sökvägar i skript** byggs med `node:path` (`join`, `resolve`), aldrig med hårdkodade snedstreck. Utvecklingen sker på både Mac och Windows.
- **Innan commit:** kör `npm test` och `npm run check`.

## 8. Faser

| Fas | Innehåll | Status |
|---|---|---|
| **0 · Grund** | Projektuppsättning, ISO 27001 som YAML med schema och test | Pågår |
| **1 · Projektfil** | Schema för `.grc.json`, store, öppna/spara/autospara, import av gamla exporter | |
| **2 · Kontroller** | Grundkrav, Annex A och SoA med samma funktioner som det gamla verktyget | |
| **3 · Riskarbete** | Riskmetod, riskregister, riskdetalj, koppling risk ↔ kontroll | |
| **4 · Resultat** | Översikt, åtgärdsplan och rapport | |
| **5 · Leverans** | Bygge till en enda HTML-fil, startsida med senaste arbeten | |
| **6 · Fler ramverk** | NIS2, CIS Controls v8, DORA | |
