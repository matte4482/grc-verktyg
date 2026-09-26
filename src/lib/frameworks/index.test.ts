import { describe, it, expect } from 'vitest'
import { FRAMEWORKS, countControls, getFramework } from './index'

describe('ramverksregistret', () => {
  it('ISO 27001:2022 går att välja', () => {
    const fw = getFramework('iso27001', '2022')
    expect(fw?.name).toBe('ISO/IEC 27001:2022')
    expect(countControls(fw!, 'clauses')).toBe(26)
    expect(countControls(fw!, 'annex-a')).toBe(93)
  })

  it('kommande ramverk finns i listan men kan inte väljas', () => {
    const upcoming = FRAMEWORKS.filter((e) => !e.framework).map((e) => e.name)
    expect(upcoming).toEqual(['NIS2', 'CIS Controls v8', 'DORA'])
    expect(getFramework('nis2', '2022')).toBeUndefined()
  })

  it('okänt ramverk eller okänd version ger undefined', () => {
    expect(getFramework('iso27001', '2013')).toBeUndefined()
    expect(getFramework('finns-inte', '1')).toBeUndefined()
  })

  it('id och version är unika i registret', () => {
    const keys = FRAMEWORKS.map((e) => `${e.id}@${e.version}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('okänt avsnitt ger 0 kontroller', () => {
    expect(countControls(getFramework('iso27001', '2022')!, 'finns-inte')).toBe(0)
  })
})
