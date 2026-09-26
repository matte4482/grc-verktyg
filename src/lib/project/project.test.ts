import { describe, it, expect } from 'vitest'
import raw from '../frameworks/iso27001-2022.yaml'
// ?raw läser filen som text vid bygget, så testet behöver inte node:fs
import fixture from '../../../tests/fixtures/exempel.grc.json?raw'
import { FrameworkSchema } from '../frameworks/schema'
import { ProjectSchema, type Project } from './schema'
import { checkAgainstFramework, createProject, formatId, parseProject, serializeProject, takeId } from './project'

const iso = FrameworkSchema.parse(raw)

/** Exempelfilen som objekt, för att kunna ändra i den per test. */
const sample = (): Record<string, any> => JSON.parse(fixture)
const errorsFor = (obj: unknown) => {
  const r = parseProject(JSON.stringify(obj))
  return r.ok ? [] : r.errors
}
/** Bara sökvägarna till felen. Zods egna texter kan ändras mellan versioner, sökvägarna inte. */
const pathsFor = (obj: unknown) => errorsFor(obj).map((e) => e.slice(0, e.indexOf(': ')))
const load = (): Project => {
  const r = parseProject(fixture)
  if (!r.ok) throw new Error(r.errors.join('\n'))
  return r.project
}

describe('nytt projekt', () => {
  const p = createProject({ client: '  Exempelbolaget AB ', framework: iso, now: new Date('2026-09-25T08:00:00Z') })

  it('är giltigt och tomt', () => {
    expect(ProjectSchema.safeParse(p).success).toBe(true)
    expect(p.client.name).toBe('Exempelbolaget AB')
    expect(p.framework).toEqual({ id: 'iso27001', version: '2022' })
    expect(p.risks).toEqual([])
    expect(p.controls).toEqual({})
    expect(p.actions).toEqual([])
    expect(p.nextNumber).toEqual({ risk: 1, action: 1, evidence: 1 })
    expect(checkAgainstFramework(p, iso)).toEqual([])
  })

  it('får ett unikt ID', () => {
    const q = createProject({ client: 'X', framework: iso })
    expect(q.id).not.toBe(p.id)
  })
})

describe('spara och öppna', () => {
  it('ger exakt samma projekt tillbaka (fas 0: klart när)', () => {
    const p = load()
    const again = parseProject(serializeProject(p))
    expect(again).toEqual({ ok: true, project: p })
    expect(serializeProject(p)).toBe(serializeProject((again as { project: Project }).project))
  })

  it('fyller i standardvärden för fält som saknas', () => {
    const p = load()
    const r3 = p.risks.find((r) => r.id === 'R-003')!
    expect(r3.controls).toEqual([])
    expect(r3.approval).toBeNull()
    expect(p.controls['6.1.2'].applicable).toBe(true)
    expect(p.controls['6.1.2'].evidence).toEqual([])
  })

  it('exempelfilen stämmer mot ISO 27001', () => {
    expect(checkAgainstFramework(load(), iso)).toEqual([])
  })
})

describe('ogiltiga filer ger begripliga fel', () => {
  it('inte JSON', () => {
    expect(parseProject('{ inte json')).toEqual({ ok: false, errors: ['Filen är inte giltig JSON.'] })
  })

  it('fel sorts fil, till exempel en gammal export', () => {
    const r = parseProject(JSON.stringify({ version: 4, client: 'Kund', data: {} }))
    expect(r).toEqual({ ok: false, errors: ['Filen är inte en projektfil från GRC-verktyget.'] })
  })

  it('nyare format än verktyget', () => {
    const r = parseProject(JSON.stringify({ ...sample(), schemaVersion: 99 }))
    expect(r.ok).toBe(false)
    expect(!r.ok && r.errors[0]).toMatch(/nyare version/)
  })

  it('okänd status pekas ut med sökväg', () => {
    const s = sample()
    s.controls['A.8.20'].status = 'ok'
    expect(pathsFor(s)).toEqual(['controls.A.8.20.status'])
  })

  it('riskvärde utanför skalan', () => {
    const s = sample()
    s.risks[0].before.likelihood = 6
    s.risks[0].planned.consequence = 0
    expect(pathsFor(s)).toEqual(['risks.0.before.likelihood', 'risks.0.planned.consequence'])
  })

  it('felmeddelandena är på svenska', () => {
    const s = sample()
    s.controls['A.8.20'].status = 'ok'
    s.risks[0].before.likelihood = 6
    const text = errorsFor(s).join('\n')
    expect(text).toMatch(/Ogiltigt val/)
    expect(text).not.toMatch(/expected|Invalid|Too big/)
  })
})

describe('fasta ID:n', () => {
  it('dubbletter underkänns', () => {
    const s = sample()
    s.risks[1].id = 'R-001'
    expect(errorsFor(s)).toContain('risks: Dubblett-ID för risk: R-001')
  })

  it('nextNumber måste ligga över högsta använda nummer', () => {
    const s = sample()
    s.nextNumber.risk = 3
    expect(errorsFor(s)).toContain('nextNumber.risk: nextNumber.risk är 3 men högsta använda nummer är 3')
  })

  it('ID:n återanvänds aldrig, inte ens efter borttagning', () => {
    const p = load() // R-002 är borttagen, R-003 finns
    expect(takeId(p, 'risk')).toBe('R-004')
    expect(takeId(p, 'risk')).toBe('R-005')
    expect(takeId(p, 'action')).toBe('ATG-002')
    expect(takeId(p, 'evidence')).toBe('EV-002')
  })

  it('formatId fyller ut till tre siffror men klarar fler', () => {
    expect(formatId('R', 7)).toBe('R-007')
    expect(formatId('ATG', 1234)).toBe('ATG-1234')
  })

  it('evidens-ID är unika över kontroller och risker', () => {
    const s = sample()
    s.risks[0].evidence = [{ ...s.controls['A.8.20'].evidence[0] }]
    expect(errorsFor(s)).toContain('controls: Dubblett-ID för evidens: EV-001')
  })
})

describe('regler i datamodellen', () => {
  it('godkännande över acceptansnivån kräver motivering', () => {
    const s = sample()
    s.risks[0].approval = { by: 'Bertil Berg', at: '2026-09-22', aboveThreshold: true, justification: ' ' }
    expect(errorsFor(s)).toContain('risks.0.approval.justification: Godkännande över acceptansnivån kräver en motivering')
    s.risks[0].approval.justification = 'Kompenseras av övervakning tills port stängts.'
    expect(errorsFor(s)).toEqual([])
  })

  it('varje konsekvensnivå har en beskrivning per konsekvenstyp', () => {
    const s = sample()
    s.riskMethod.consequence.types.push('Hälsa och säkerhet')
    expect(pathsFor(s)).toEqual([0, 1, 2, 3, 4].map((i) => `riskMethod.consequence.levels.${i}.descriptions`))
    expect(errorsFor(s)[0]).toBe(
      'riskMethod.consequence.levels.0.descriptions: Nivå 1 har 2 beskrivningar men det finns 3 konsekvenstyper',
    )
  })

  it('evidens kräver kontrollsumma och källa', () => {
    const s = sample()
    delete s.controls['A.8.20'].evidence[0].sha256
    s.controls['A.8.20'].evidence[0].source = 'cloud'
    expect(pathsFor(s)).toEqual(['controls.A.8.20.evidence.0.sha256', 'controls.A.8.20.evidence.0.source'])
  })
})

describe('kontroll mot ramverket', () => {
  it('okänd kontroll', () => {
    const p = load()
    p.controls['A.9.9'] = { ...p.controls['6.1.2'] }
    expect(checkAgainstFramework(p, iso)).toEqual(['Bedömning: okänd kontroll A.9.9'])
  })

  it('grundkrav kan inte väljas bort', () => {
    const p = load()
    p.controls['6.1.2'].applicable = false
    expect(checkAgainstFramework(p, iso)).toEqual(['6.1.2 kan inte väljas bort, den ingår inte i SoA.'])
  })

  it('kontroll kopplad till risk är låst som tillämplig', () => {
    const p = load()
    p.controls['A.8.20'].applicable = false
    expect(checkAgainstFramework(p, iso)).toEqual(['A.8.20 är bortvald i SoA men kopplad till R-001.'])
  })

  it('åtgärd som pekar på borttagen risk', () => {
    const p = load()
    p.actions[0].risks = ['R-002']
    expect(checkAgainstFramework(p, iso)).toEqual(['ATG-001: okänd risk R-002'])
  })

  it('fel ramverk', () => {
    const p = load()
    p.framework.version = '2013'
    expect(checkAgainstFramework(p, iso)[0]).toMatch(/gäller iso27001 2013/)
  })
})
