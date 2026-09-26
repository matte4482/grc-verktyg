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

- **Fas:** 0 är klar. Nästa fas är 1, säkert filsparande (faser enligt [Plan 2.0](docs/plan-2.0.md), se B-19).
- **Klart i fas 0:**
  - Projektet är uppsatt med Svelte, TypeScript och Vite.
  - ISO/IEC 27001:2022 är flyttat från det gamla verktyget (`legacy/method-grc-verktyg.html`) till YAML, med schema och test.
  - Grundkraven i kapitel 6 följer standardens numrering (B-15).
  - Projektfilens datamodell (`src/lib/project/`) med tester och en påhittad exempelfil (B-17).
  - Register över ramverk (B-21).
  - Bygget ger en enda fristående HTML-fil med säkerhetspolicy (B-03, B-20).
  - Vites startmall är ersatt av ett enkelt skal, och det felaktiga beroendet `npm` är borttaget.
- **Nästa steg:** fas 1. Spara och Spara som med File System Access API, autosparning var tionde minut, sparstatus och varning vid stängning (Ö-01). Kontrollera först att `showSaveFilePicker` fungerar när verktyget öppnas från disk (`file://`) i Chrome och Edge.
- **Väntar på beslut:** Ö-03 (regel för restrisk), senast före fas 3.

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

**Status:** Beslutat

Det gamla verktyget är en enda HTML-fil som går att öppna utan installation, och det ska det nya också vara.

Så går bygget till (`npm run build`):

1. **Vite** bygger appen från `index.html` och `src/main.ts`. Svelte-komponenterna kompileras till vanlig JavaScript, TypeScript-typerna tas bort och YAML-ramverken blir JavaScript-objekt (B-09).
2. **`vite-plugin-singlefile`** bäddar in all JavaScript och CSS direkt i `dist/index.html`. Pluginet är bara aktivt vid bygget, inte i utvecklingsservern eller testerna.
3. **`publicDir: false`** i `vite.config.ts` gör att inga filer kopieras bredvid index.html. Ikonen ligger som en data:-adress i `index.html`.
4. **`scripts/finalize-build.mjs`** kontrollerar resultatet och lägger in CSP (B-20). Bygget misslyckas om `dist/` innehåller mer än `index.html`, eller om filen hänvisar till något utanför sig själv.

Konsekvens: alla ramverk, typsnitt och ikoner bäddas in i filen vid bygget. Verktyget får inte hämta något från nätet när det körs. Typsnitten är systemtypsnitt (Calibri, Cambria med reserver), så inga typsnittsfiler behövs.

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

**Status:** Beslutat · datamodellen beskrivs i B-17

Varje kunduppdrag är en JSON-fil med ändelsen `.grc.json`. Den innehåller kund, ramverk, riskmetod, riskregister, kontrollbedömningar, SoA och åtgärdsplan. Utkastet till format finns i README.

- **Formatet valideras med zod** och har ett eget `schemaVersion`. Schemat finns i `src/lib/project/schema.ts`.
- **Ett ramverk per projektfil.** Om en kund behöver både ISO 27001 och NIS2 blir det två uppdrag.
- **Ramverket anges med `id` och `version`**, men själva innehållet kopieras inte in i projektfilen.

Hur verktyget sparar till filen avgjordes i Ö-01.

## B-11 · Gamla sparfiler ska kunna läsas in

**Status:** Ersatt av B-16

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
- **Gamla sparfiler** skulle översättas med tabellen ovan (B-11). Det gäller inte längre, eftersom gamla filer inte läses in (B-16).

## B-16 · Nytt verktyg, gamla sparfiler läses inte in

**Status:** Beslutat · ersätter B-11

Beslutat 25 september 2026. Det nya verktyget byggs från grunden och är inte en ny version av det gamla. Det gamla verktyget (`legacy/method-grc-verktyg.html`) är förebild för innehåll och arbetssätt, och ramverket är flyttat därifrån (B-08), men dess sparfiler behöver inte gå att öppna.

Skäl:

- Det nya verktyget har många fler funktioner (risker, evidens, åtgärder, jämförelse). En översättning från det gamla formatet skulle bara fylla en liten del av projektfilen och ändå kräva underhåll.
- Gamla bedömningar görs om i det nya verktyget när kunden bedöms nästa gång.

Konsekvenser:

- Punkten om migrering i fas 0 och punkten om att uppgradera gamla filer i fas 7 stryks ur Plan 2.0.
- Kriteriet för att fas 0 är klar blir: ett nytt projekt kan sparas, öppnas igen och valideras utan att något ändras.
- Om någon försöker öppna en gammal exportfil visas "Filen är inte en projektfil från GRC-verktyget." Den skrivs aldrig över.
- Jämförelse i fas 7 fungerar bara mellan bedömningar som gjorts i det nya verktyget.

## B-17 · Projektfilens datamodell

**Status:** Beslutat

Datamodellen i `src/lib/project/schema.ts` har plats för allt i Plan 2.0 från start, även det som byggs i senare faser. Då behöver formatet inte ändras för varje fas.

- **Fasta ID:n (krav för fas 7).** Risker, åtgärder och evidens får ID:n av formen `R-001`, `ATG-001` och `EV-001`. Löpnumren ligger i `nextNumber` i projektfilen. Ett ID återanvänds aldrig, inte ens när posten tas bort, eftersom jämförelsen mellan två bedömningar matchar på ID. Kontroller identifieras med ramverkets ID (B-06).
- **ID för bedömningen.** Varje projektfil har ett `id` (UUID) och kan ha `previousId`, som pekar på bedömningen den utgår från.
- **Fält som saknas fylls i vid inläsning.** Tomma texter, tomma listor och standardvärden behöver inte stå i filen. Det gör att nya valfria fält kan läggas till utan att äldre filer slutar validera.
- **Beräknade värden sparas aldrig.** Riskvärde, nivå, faktisk restrisk och uppfyllnadsgrad räknas fram.
- **Kopplingen mellan risk och kontroll är ett objekt**, `{ control, effect?, type? }`, inte bara ett ID. Effekt och typ är valfria, så modellen fungerar med både alternativ A och B i Ö-03.
- **Godkännande av restrisk över acceptansnivån** kräver en motivering. Det kontrolleras i schemat.
- **Evidens kan finnas på både kontroller och risker** och har sökväg, storlek, `sha256`, källa, vem som lade till den och när. Kontrollsumman gör att verktyget kan varna om en fil har flyttats eller ändrats.
- **Kontroller mot ramverket görs separat.** Schemat känner inte till ramverket. `checkAgainstFramework()` i `project.ts` kontrollerar okända kontroll-ID:n, att grundkrav inte väljs bort och att kontroller som är kopplade till en risk inte är bortvalda.
- **Inläsning kastar aldrig.** `parseProject()` returnerar antingen ett giltigt projekt eller en lista med felmeddelanden med sökväg, till exempel `controls.A.8.20.status: …`. En fil från en nyare version av verktyget avvisas med ett eget meddelande.

## B-18 · Grunden för CloudSecComp

**Status:** Beslutat

CloudSecComp, en automatisk granskning av kundens molnmiljö, byggs inte nu. Enligt Plan 2.0 läggs fyra saker in så att det kan kopplas på senare utan omskrivning:

| Vad | Fas | Hur |
|---|---|---|
| Fasta ID:n för alla Annex A-kontroller | 0 | Klart genom B-06 och B-15 |
| Status per kontroll kan delas i teknisk och organisatorisk del | 0 | Valfritt fält `parts: { technical, organizational }` |
| Källa på varje evidens | 4 | Fältet `source`: `manual` eller `automatic` (finns redan i schemat) |
| Beskrivet filformat för import av fynd | 4 | Beskrivs i fas 4 |

Den övergripande statusen sätts alltid av konsulten. Delarna är underlag, inte en beräkning. Regeln för hur en automatisk teknisk bedömning påverkar den övergripande statusen bestäms när CloudSecComp byggs.

Inloggning mot kundens molnmiljö kräver ett riktigt program, eftersom en HTML-fil inte kan skydda en hemlighet. Molnsynken väntar därför till en skrivbordsversion.

## B-19 · Faser enligt Plan 2.0

**Status:** Beslutat

Arbetet följer de nio faserna (0–8) och milstolparna M1–M4 i [docs/plan-2.0.md](docs/plan-2.0.md), med ändringarna i B-16. Fastabellen i README är uppdaterad. Nya idéer läggs efter M4, inte i pågående fas.

## B-20 · Säkerhetspolicy (CSP) i den byggda filen

**Status:** Beslutat

Efter bygget lägger `scripts/finalize-build.mjs` in en `Content-Security-Policy` som `<meta>`-tagg direkt efter `<meta charset>`, före alla skript.

| Regel | Effekt |
|---|---|
| `default-src 'none'` | Allt som inte uttryckligen tillåts är förbjudet. |
| `script-src 'sha256-…'` | Bara exakt det skript som bygget gav får köras. Ändras ett enda tecken i filen körs inget skript alls. |
| `connect-src 'none'` | Verktyget kan inte skicka eller hämta något över nätet: ingen telemetri och inga anrop hem (B-02). |
| `style-src 'unsafe-inline'` | Krävs eftersom CSS:en är inbäddad och Svelte sätter stilar på element. Stilar kan inte skicka data. |
| `img-src data: blob:`, `font-src data:` | Bara inbäddade bilder och typsnitt. |
| `object-src`, `base-uri`, `form-action` `'none'` | Stänger vanliga vägar för injektion. |

Skäl:

- Projektfilerna innehåller känsliga uppgifter om kundens säkerhetsbrister. Även om verktyget självt aldrig skickar något, gör CSP:n att inte heller en bugg, ett beroende eller en ändrad fil kan göra det.
- Hashen gör att en fil som ändrats efter bygget slutar fungera i stället för att köra ändrad kod.

Konsekvenser:

- CSP:n läggs in efter bygget och inte i `index.html`, eftersom utvecklingsservern behöver nätverk och kör ändrade skript hela tiden.
- Zod får inte generera kod med `new Function`. `src/lib/zod-setup.ts` sätter `jitless: true` och importeras först i `main.ts`.
- Om verktyget någon gång behöver nätet (till exempel CloudSecComp) blir det i skrivbordsversionen, inte genom att öppna CSP:n (B-18).

Verifierat 25 september 2026 i Chromium med filen öppnad direkt från disk: projektlogik och zod fungerar, `fetch` blockeras och ett ändrat skript körs inte. Den byggda Svelte-appen ska också verifieras lokalt med `npm run build`.

## B-21 · Ramverksregister och felmeddelanden på svenska

**Status:** Beslutat

- **Register.** `src/lib/frameworks/index.ts` listar alla ramverk. Tillgängliga ramverk valideras med zod när modulen laddas, så ett fel i en YAML-fil stoppar både testerna och appen direkt. Kommande ramverk (NIS2, CIS Controls v8, DORA) står i samma lista utan innehåll och visas som "Kommer" på startsidan.
- **Svenska felmeddelanden.** `parseProject()` använder zods svenska språkpaket. Egna meddelanden i schemat, till exempel om motivering för godkännande, går före. Testerna kontrollerar sökvägen till felet och inte zods ordalydelse, eftersom den kan ändras mellan versioner.

---

## Öppna frågor

### Ö-01 · Hur verktyget sparar till fil

**Förslag:** Använd File System Access API (`showSaveFilePicker`). Då kan verktyget spara automatiskt till samma fil i kundens synkade SharePoint-mapp.

**Problem:** API:t finns bara i Chrome och Edge, och det fungerar inte i Safari eller Firefox.

**Reserv:** Om API:t saknas används "Spara" som laddar ned filen, plus en varning om osparade ändringar.

**Beslut behövs om:** Vi kräver Chrome/Edge, eller erbjuder båda lägena.

**Avgjord 25 september 2026 (Plan 2.0, fas 1):** Båda lägena. Chrome och Edge skriver direkt till filen i kundens SharePoint-mapp. I Safari och Firefox laddas filen ned i stället, och verktyget rekommenderar Chrome eller Edge. Autosparning sker var tionde minut, men bara när något har ändrats. Sparstatusen visas alltid, och stängning med osparade ändringar ger en varning.

### Ö-02 · Numreringen i kapitel 6 följer inte standarden

**Avgjord 25 september 2026:** ID:n följer standarden, se B-15.

Grundkraven 6.1–6.6 är numrerade i löpordning. I standarden heter de 6.1.1, 6.1.2, 6.1.3, 6.1.3 d, 6.2 och 6.3. För att kunna koppla ihop ramverk bör ID:n följa standarden.

Ändringen påverkar översättningen av gamla sparfiler (B-11). Den görs som en egen commit, med en tabell som översätter gamla ID:n till nya.

### Ö-03 · Regel för faktisk restrisk

*Måste avgöras före fas 3. Datamodellen (B-17) fungerar med båda alternativen.*

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
