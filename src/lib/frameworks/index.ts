import { FrameworkSchema, type Framework } from './schema'
import iso27001_2022 from './iso27001-2022.yaml'

// Register över ramverk (README avsnitt 6). Startsidan (fas 2) visar alla
// poster i FRAMEWORKS; bara de med `framework` satt går att välja.
//
// Ramverken valideras när modulen laddas. Ett fel i en YAML-fil stoppar
// därför både testerna och appen direkt, i stället för att synas senare.

export interface FrameworkEntry {
  id: string
  version: string
  name: string
  /** Undefined = visas som "kommer" på startsidan. */
  framework?: Framework
}

const available: Framework[] = [FrameworkSchema.parse(iso27001_2022)]

const upcoming: Omit<FrameworkEntry, 'framework'>[] = [
  { id: 'nis2', version: '2022', name: 'NIS2' },
  { id: 'cis', version: '8', name: 'CIS Controls v8' },
  { id: 'dora', version: '2022', name: 'DORA' },
]

export const FRAMEWORKS: readonly FrameworkEntry[] = [
  ...available.map((fw) => ({ id: fw.id, version: fw.version, name: fw.name, framework: fw })),
  ...upcoming,
]

/** Ramverket med givet id och version, eller undefined om det inte finns. */
export function getFramework(id: string, version: string): Framework | undefined {
  return FRAMEWORKS.find((e) => e.id === id && e.version === version)?.framework
}

/** Antal kontroller i ett avsnitt, t.ex. 93 för Annex A. */
export function countControls(fw: Framework, sectionId: string): number {
  const section = fw.sections.find((s) => s.id === sectionId)
  return section ? section.groups.reduce((n, g) => n + g.controls.length, 0) : 0
}
