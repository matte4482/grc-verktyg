// Engångsskript (fas 0): flyttar FRAMEWORKS-objektet från det gamla
// enfilsverktyget (method-grc-verktyg.html) till YAML.
//
// Körning från repots rot:
//   node scripts/extract-framework.mjs legacy/method-grc-verktyg.html
//
// Skriptet läser HTML-filen direkt, så inget behöver kopieras för hand.
// Data flyttas 1:1 — texter och ID:n ändras inte.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import yaml from 'js-yaml'

const here = dirname(fileURLToPath(import.meta.url))
const htmlPath = resolve(process.argv[2] ?? join(here, '..', 'legacy', 'method-grc-verktyg.html'))
const outPath = join(here, '..', 'src', 'lib', 'frameworks', 'iso27001-2022.yaml')

// 1. Plocka ut "const FRAMEWORKS = { ... };" ur <script>-blocket
const html = readFileSync(htmlPath, 'utf8')
const match = html.match(/const FRAMEWORKS = (\{[\s\S]*?\n\});/)
if (!match) throw new Error(`Hittade inte "const FRAMEWORKS = {" i ${htmlPath}`)
const FRAMEWORKS = vm.runInNewContext(`(${match[1]})`)

// 2. Mappa om till det nya formatet
const SECTION_META = {
  krav:   { id: 'clauses', title: 'Grundläggande krav' },
  annexa: { id: 'annex-a', title: 'Annex A' },
}

function toDoc(fw) {
  return {
    schemaVersion: 1,
    id: 'iso27001',
    version: '2022',
    name: fw.name,
    language: 'sv',
    sections: fw.sections.map((sec) => {
      const meta = SECTION_META[sec.id]
      if (!meta) throw new Error(`Okänt avsnitt: ${sec.id}`)
      return {
        id: meta.id,
        title: meta.title,
        soa: sec.soa,
        unit: sec.unit,
        groups: sec.groups.map((g) => {
          // "A.5 Organisatoriska kontroller" -> id "A.5", title "Organisatoriska kontroller"
          const [, num, title] = g.name.match(/^(\S+)\s+(.+)$/)
          return {
            id: num,
            title,
            controls: g.controls.map(([id, title, guidance]) => ({
              id: `${sec.idPrefix}${id}`, // alltid sträng: "4.1", "A.8.10"
              title,
              ...(guidance ? { guidance } : {}),
            })),
          }
        }),
      }
    }),
  }
}

const doc = toDoc(FRAMEWORKS.iso27001_2022)

// 3. Skriv YAML
const header = [
  '# ISO/IEC 27001:2022 — krav och Annex A-kontroller',
  '# Flyttad från method-grc-verktyg.html (fas 0). Redigera här, inte i koden.',
  '# ID:n är alltid strängar. "guidance" = vad revisorn förväntar sig se som bevis.',
  '',
  '',
].join('\n')

const body = yaml.dump(doc, { lineWidth: -1, noRefs: true, quotingType: '"' })
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, header + body, 'utf8')

// 4. Kontrollräkning
for (const s of doc.sections) {
  const n = s.groups.reduce((sum, g) => sum + g.controls.length, 0)
  console.log(`${s.title}: ${n} (${s.groups.map((g) => `${g.id}=${g.controls.length}`).join(', ')})`)
}
console.log(`Skrev ${outPath}`)
