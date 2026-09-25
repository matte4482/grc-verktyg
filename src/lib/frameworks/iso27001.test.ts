import { describe, it, expect } from 'vitest'
// Samma import som appen kommer att använda (via @rollup/plugin-yaml i vite.config.ts)
import raw from './iso27001-2022.yaml'
import { FrameworkSchema } from './schema'

describe('iso27001-2022.yaml', () => {
  const fw = FrameworkSchema.parse(raw) // kastar om formatet är fel eller ID:n dubblerade

  const count = (sectionId: string) =>
    fw.sections.find((s) => s.id === sectionId)!.groups.flatMap((g) => g.controls).length

  it('har 26 grundkrav och 93 Annex A-kontroller', () => {
    expect(count('clauses')).toBe(26)
    expect(count('annex-a')).toBe(93)
  })

  it('har rätt antal kontroller per Annex A-tema', () => {
    const annexA = fw.sections.find((s) => s.id === 'annex-a')!
    expect(Object.fromEntries(annexA.groups.map((g) => [g.id, g.controls.length]))).toEqual({
      'A.5': 37,
      'A.6': 8,
      'A.7': 14,
      'A.8': 34,
    })
  })

  it('tolkar inte ID:n som tal (A.8.10 får inte bli A.8.1)', () => {
    const ids = fw.sections.flatMap((s) => s.groups.flatMap((g) => g.controls.map((c) => c.id)))
    expect(ids).toContain('A.8.10')
    expect(ids).toContain('10.1')
    expect(fw.version).toBe('2022')
  })

  it('grundkrav i kapitel 6 följer standardens numrering', () => {
    const k6 = fw.sections.find((s) => s.id === 'clauses')!.groups.find((g) => g.id === '6')!
    expect(k6.controls.map((c) => c.id)).toEqual(['6.1.1', '6.1.2', '6.1.3', '6.1.3 d', '6.2', '6.3'])
  })

  it('endast Annex A ingår i SoA', () => {
    expect(fw.sections.filter((s) => s.soa).map((s) => s.id)).toEqual(['annex-a'])
  })
})
