# Arkitektur och designbeslut

Den här filen samlar alla designbeslut i projektet, i den ordning de fattades. Den är projektets minne: läs den först när du byter dator eller tar upp arbetet efter ett uppehåll.

- **Vad verktyget ska göra** och hur koden är organiserad beskrivs i [README.md](README.md).
- **Varför det är byggt så** står här.

Varje beslut har en status:

| Status | Betydelse |
|---|---|
| **Beslutat** | Gäller och är genomfört i koden. |
| **Planerat** | Bestämt, men inte genomfört ännu. |
| **Öppet** | Behöver ett beslut innan arbetet kan fortsätta. |

Nya beslut läggs till sist, med nästa lediga nummer. Ett beslut som ändras skrivs inte över. Det markeras som *Ersatt av B-xx*, och det nya beslutet förklarar varför.

---

## Nuläge

*Senast uppdaterad: 25 september 2026*

- **Fas:** 0, grundarbete.
- **Klart:**
  - Projektet är uppsatt med Svelte, TypeScript och Vite.
  - ISO/IEC 27001:2022 är flyttat från det gamla verktyget (`method-grc-verktyg.html`) till YAML, med schema och test.
  - Grundkraven i kapitel 6 följer nu standardens numrering (B-15).
- **Pågår:** första körningen av `npm test` på Mac.
- **Nästa steg:** projektfilens format (`.grc.json`), se B-10, och läsning av gamla exportfiler, se B-11.
- **Väntar på beslut:** Ö-01 (sparande till fil) och Ö-03 (regel för restrisk).

---

## B-01 · Svelte 5 + TypeScript + Vite, utan SvelteKit

**Status:** Beslutat

Verktyget är en ren klientapp utan server. Vi använder Vite-mallen `svelte-ts` i stället för SvelteKit. SvelteKit tillför routing, serverrendering och adaptrar som vi inte behöver. Det gör också bygget till en enda fil (B-03) krångligare.

Svelte 5 med runes (`$state`, `$derived`) används för all delad state. Vi använder inga externa state-bibliotek.

## B-02 · All data stannar hos kunden

**Status:** Beslutat

Method IT ska aldrig lagra kunddata. Verktyget har ingen backend, ingen inloggning och ingen telemetri. En bedömning sparas som en projektfil i kundens egen mapp, till exempel i SharePoint (se B-10).

Kunddata får heller aldrig hamna i repot. Därför innehåller `.gitignore` reglerna `*.grc.json` och `exports/`. Enda undantaget är avidentifierade testfiler i `tests/fixtures/`.

## B-03 · Leverans som en enda HTML-fil

**Status:** Planerat

Det gamla verktyget är en enda HTML-fil som går att öppna utan installation, och det ska det nya också vara. `vite-plugin-singlefile` är installerat. Det kopplas in i `vite.config.ts` när det första riktiga bygget görs.

Konsekvens: alla ramverk, typsnitt och ikoner bäddas in i filen vid bygget. Verktyget får inte hämta något från nätet när det körs.

## B-04 · Ramverk är data i YAML, inte kod

**Status:** Beslutat

Kraven och kontrollerna i ett ramverk ligger i `src/lib/frameworks/<ramverk>-<version>.yaml`. Förut låg de som ett JavaScript-objekt inuti HTML-filen.

Skäl:

- **Flera ramverk:** NIS2, CIS Controls v8 och DORA ska kunna läggas till utan att någon kod ändras.
- **Läsbarhet:** innehållet ska kunna granskas och ändras av någon som inte programmerar.
- **Ett gemensamt format:** en framtida automatisk kontroll av molnmiljöer ska kunna läsa kraven i samma format.

YAML valdes före JSON eftersom det tål kommentarer och långa svenska texter bättre, och ger rena diffar.

## B-05 · Ett gemensamt schema för alla ramverk, validerat med zod

**Status:** Beslutat

Alla ramverksfiler följer schemat i `src/lib/frameworks/schema.ts`:

```
Ramverk → avsnitt (sections) → grupper (groups) → kontroller (controls)
```

- **`schemaVersion: 1`** finns i varje fil, så att formatet kan utvecklas och gamla filer ändå kännas igen.
- **`soa: true`** på ett avsnitt betyder att dess kontroller ingår i Statement of Applicability. I ISO 27001 gäller det bara Annex A.
- **`unit`** styr UI-texter som "26 krav" och "93 kontroller".
- **Nya fält är alltid valfria.** Exempel är kopplingar mellan ramverk och uppgifter för automatiska kontroller. Befintliga filer ska aldrig sluta validera.
- **ID:n kontrolleras.** Schemat ser till att alla kontroll-ID:n i ett ramverk är unika.

## B-06 · Kontroll-ID:n är alltid fullständiga textsträngar

**Status:** Beslutat

Ett ID skrivs alltid ut i sin helhet, till exempel `"4.1"` och `"A.8.10"`. Det gamla verktyget använde ett separat `idPrefix`, och det är borttaget.

ID:n ska aldrig behandlas som tal. Om YAML läser `8.10` utan citattecken blir det talet `8.1`, och då krockar det med `A.8.1`. Testet `iso27001.test.ts` kontrollerar just det fallet.

## B-07 · Fältet `guidance` i stället för `evidence`

**Status:** Beslutat

Texten om vad revisorn förväntar sig se heter `guidance` (i UI: "Bevisbörda"). Namnet `evidence` är reserverat för den faktiska evidensen, alltså bifogade filer och liknande. Den hör hemma i projektfilen, inte i ramverket.

## B-08 · Ramverket flyttas oförändrat först, rättelser görs separat

**Status:** Beslutat

I fas 0 flyttades ISO 27001 till YAML utan att någon text eller något ID ändrades. Innehållet stämdes av fält för fält mot originalet: 119 kontroller, alla identiska. Rättelser görs i egna commits, så att det syns vad som är flytt och vad som är ändring.

Konvertering görs med `scripts/extract-framework.mjs`. Skriptet läser HTML-filen direkt, så inget behöver klistras in för hand. Det behövs inte igen, men sparas som dokumentation av hur flytten gick till.

## B-09 · YAML importeras vid bygget via `@rollup/plugin-yaml`

**Status:** Beslutat

Ramverken importeras som moduler: `import raw from './iso27001-2022.yaml'`. Datan valideras sedan med `FrameworkSchema.parse(raw)`.

- **Inga filer läses i webbläsaren.** Allt bäddas in vid bygget, vilket stämmer med B-03.
- **Testerna läser filen på samma sätt som appen.** Vitest använder samma `vite.config.ts`.
- **`src/yaml.d.ts`** typar `*.yaml` som `unknown`. Det tvingar fram validering med zod innan datan används.

## B-10 · Projektfil `.grc.json` i kundens mapp

**Status:** Planerat

Varje kunduppdrag är en JSON-fil med ändelsen `.grc.json`. Den innehåller kund, ramverk, riskmetod, riskregister, kontrollbedömningar, SoA och åtgärdsplan. Utkastet till format finns i README.

- **Formatet valideras med zod** och har ett eget `schemaVersion`.
- **Ett ramverk per projektfil.** Om en kund behöver både ISO 27001 och NIS2 blir det två uppdrag.
- **Ramverket anges med `id` och `version`**, men själva innehållet kopieras inte in i projektfilen.

Öppen fråga: hur verktyget ska spara till filen, se Ö-01.

## B-11 · Gamla sparfiler ska kunna läsas in

**Status:** Planerat

Det gamla verktyget exporterar `{ version: 4, client, exported, data }`. I `data` sparas status per kontroll under nycklar som `K4.1` (grundkrav) och `A5.1` (Annex A). Det nya formatet använder `4.1` och `A.5.1`.

Importen översätter nycklarna så här:

| Gammal nyckel | Ny nyckel |
|---|---|
| `K` + id | id |
| `A` + id | `A.` + id |

Undantag: grundkraven i kapitel 6 har fått nya ID:n (B-15) och översätts med en egen tabell, till exempel `K6.4` → `6.1.3 d`.

Fälten mappas så här:

| Gammalt fält | Nytt fält |
|---|---|
| `s` | `status` |
| `c` | `comment` |
| `doc` | `evidenceNote` |
| `own` | `owner` |
| `app` | `applicable` |
| `m` | `soaJustification` |

Äldre versioner (v2 och v3) översätts på samma sätt som det gamla verktygets egen `migrate()`.

## B-12 · TypeScript-inställning för `vite.config.ts`

**Status:** Beslutat

`tsconfig.node.json` använder `"module": "esnext"` och `"moduleResolution": "bundler"`, inte `nodenext`. Med `nodenext` behandlas `@rollup/plugin-yaml` som ett CommonJS-paket, och standardimporten får felet "not callable". Konfigurationsfilen byggs av Vite, så `bundler` är rätt läge.

## B-13 · Två datorer: samma Node-version, en gemensam lockfil, inga hemligheter

**Status:** Beslutat

Utvecklingen sker på både Mac och Windows.

- **Node-version:** `.nvmrc` anger Node 24.
- **Lockfil:** `package-lock.json` committas alltid, så att båda datorerna får exakt samma paketversioner.
- **Beroenden:** alla ligger i en enda `package.json` i repots rot.
- **Sökvägar:** skript använder alltid `node:path` (`join`, `resolve`), aldrig hårdkodade snedstreck.
- **Radslut:** normaliseras via `.gitattributes`.

## B-14 · Tester ligger bredvid koden

**Status:** Beslutat

Testfiler heter `*.test.ts` och ligger bredvid det de testar. Varje ramverk har ett test som låser antalet kontroller per grupp och kontrollerar att ID:n är unika textsträngar.

- `npm test` kör alla tester en gång.
- `npm run test:watch` kör om testerna vid varje ändring.
- `npm run check` gör typkontrollen.

## B-15 · Kontroll-ID:n följer standardens numrering

**Status:** Beslutat · avgör Ö-02

Alla ID:n ska vara de nummer som står i standarden, så att de kan kopplas mot andra ramverk och mot framtida automatiska kontroller. I det gamla verktyget var grundkraven i kapitel 6 numrerade i löpordning. De har nu bytts ut:

| Gammalt ID | Nytt ID | Krav |
|---|---|---|
| 6.1 | 6.1.1 | Hantering av risker och möjligheter |
| 6.2 | 6.1.2 | Dokumenterad metod för riskbedömning |
| 6.3 | 6.1.3 | Riskbehandlingsplan |
| 6.4 | 6.1.3 d | Statement of Applicability (SoA) |
| 6.5 | 6.2 | Mätbara informationssäkerhetsmål |
| 6.6 | 6.3 | Planering av ändringar i ledningssystemet |

Övriga grundkrav (kapitel 4, 5 och 7–10) och alla Annex A-kontroller stämde redan med standarden. Texterna är oförändrade.

- **SoA har ID:t `6.1.3 d`.** SoA är en punkt i krav 6.1.3, inte ett eget krav, men den ska kunna bedömas för sig. Därför används standardens egen hänvisning, med mellanslag.
- **Testet låser numreringen.** `iso27001.test.ts` kontrollerar att kapitel 6 har exakt dessa ID:n.
- **Gamla sparfiler** översätts med tabellen ovan (B-11).

---

## Öppna frågor

### Ö-01 · Hur verktyget sparar till fil

**Förslag:** Använd File System Access API (`showSaveFilePicker`). Då kan verktyget spara automatiskt till samma fil i kundens synkade SharePoint-mapp.

**Problem:** API:t finns bara i Chrome och Edge, och det fungerar inte i Safari eller Firefox.

**Reserv:** Om API:t saknas används "Spara" som laddar ned filen, plus en varning om osparade ändringar.

**Beslut behövs om:** Vi kräver Chrome/Edge, eller erbjuder båda lägena.

**Beslut:** 

### Ö-02 · Numreringen i kapitel 6 följer inte standarden

**Avgjord 25 september 2026:** ID:n följer standarden, se B-15.

Grundkraven 6.1–6.6 är numrerade i löpordning. I standarden heter de 6.1.1, 6.1.2, 6.1.3, 6.1.3 d, 6.2 och 6.3. För att kunna koppla ihop ramverk bör ID:n följa standarden.

Ändringen påverkar översättningen av gamla sparfiler (B-11). Den görs som en egen commit, med en tabell som översätter gamla ID:n till nya.

### Ö-03 · Regel för faktisk restrisk

Riskregistret visar två restrisker: den *planerade* (när alla åtgärder är genomförda) och den *faktiska* (utifrån hur kontrollerna faktiskt är uppfyllda just nu). Regeln för uträkningen behöver bestämmas innan riskregistret byggs. Två alternativ finns.

**Alternativ A · Steg i sannolikhet**

Planerad restrisk anges för hand. Faktisk restrisk är lika med planerad när alla kopplade kontroller är *Uppfyllda*. Annars ökar sannolikheten ett steg för varje kontroll som är *Delvis* uppfylld och två steg för varje kontroll som är *Ej uppfylld*, men aldrig över sannolikheten före behandling.

- **Fördel:** enkelt att förklara för kund och revisor.
- **Nackdel:** alla kontroller väger lika tungt, och planerad restrisk blir en bedömning utan koppling till kontrollerna.

**Alternativ B · Kontrollens effektivitet (förslag från Mateusz)**

Varje koppling mellan en risk och en kontroll får i förväg en effektivitet mellan 0 och 1, alltså hur mycket kontrollen minskar risken när den är fullt genomförd. Då gäller:

```
Restrisk = Risk × (1 − effektivitet)
```

- **Fördel:** både planerad och faktisk restrisk räknas fram, och viktiga kontroller väger tyngre.
- **Nackdel:** risk för skenbar precision, och ett resultat som 15 × (1 − 0,75) = 3,75 går inte att placera i matrisen.

**Rekommendation: alternativ B, med fyra justeringar**

1. **Grov skala i stället för fritt tal.** Effektiviteten väljs som *Låg 0,25*, *Medel 0,5* eller *Hög 0,75*. Det är lättare att motivera för en revisor än till exempel 0,62.
2. **Minska sannolikhet eller konsekvens, inte riskvärdet.** Vid kopplingen anges om kontrollen är *förebyggande* (sänker sannolikheten) eller *begränsande* (sänker konsekvensen). Värdet avrundas uppåt till närmaste hela nivå, lägst 1. Då hamnar restrisken alltid i en ruta i matrisen, och avrundningen uppåt gör bedömningen försiktig.
3. **Status styr den faktiska effekten.** Samma effektivitet används för båda restriskerna. Skillnaden är att planerad restrisk räknar med att alla kontroller är uppfyllda, medan faktisk restrisk multiplicerar effektiviteten med en faktor för status:

   | Status | Faktor |
   |---|---|
   | Uppfylld | 1 |
   | Delvis uppfylld | 0,5 |
   | Ej uppfylld | 0 |
   | Ej bedömd | 0 |

4. **Flera kontroller på samma risk kombineras som lager:** `1 − (1 − e₁) × (1 − e₂) × …`. Den sammanlagda effekten begränsas till högst 0,9, så att ingen risk kan räknas ned till noll.

**Exempel (R-004 i skisserna):** före behandling är K 4 × S 4 = 16. A.8.20 är kopplad som förebyggande med effektiviteten *Hög (0,75)*.

| | Effekt | Sannolikhet | Restrisk |
|---|---|---|---|
| Planerad | 0,75 | 4 × 0,25 = 1 | 4 × 1 = **4** |
| Faktisk, A.8.20 *Delvis* | 0,75 × 0,5 = 0,375 | 4 × 0,625 = 2,5 → **3** | 4 × 3 = **12** |

Skisserna visar samma värden, 4 och 12.

Metoden (skala, faktorer och avrundning) ska stå i riskmetoden och skrivas ut som bilaga i rapporten. Krav 6.1.2 kräver att riskbedömningar ger jämförbara och upprepbara resultat.

**Beslut behövs om:**

- Vi väljer alternativ A eller B.
- Justeringarna 1–4 gäller, om vi väljer B.
