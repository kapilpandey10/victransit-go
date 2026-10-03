import { describe, expect, it } from 'vitest'
import { EYLF_OUTCOMES, EYLF_PRACTICES, EYLF_PRINCIPLES, eylfById } from './eylf'
import { REGGIO_PRINCIPLES } from './reggio'
import { THEORIES } from './theories'

describe('EYLF reference data', () => {
  it('has exactly 5 outcomes with ids 1-5', () => {
    expect(EYLF_OUTCOMES.map(o => o.id)).toEqual([1, 2, 3, 4, 5])
  })

  it('every outcome has at least one sub-outcome with observation prompts', () => {
    for (const o of EYLF_OUTCOMES) {
      expect(o.subOutcomes.length).toBeGreaterThan(0)
      for (const sub of o.subOutcomes) {
        expect(sub.lookFor.length).toBeGreaterThan(0)
      }
    }
  })

  it('sub-outcome ids look like "1.1"', () => {
    for (const o of EYLF_OUTCOMES) {
      for (const sub of o.subOutcomes) {
        expect(sub.id).toMatch(/^[1-5]\.\d+$/)
      }
    }
  })

  it('eylfById finds outcomes', () => {
    expect(eylfById(4)?.shortTitle).toBe('Learning')
    expect(eylfById(99)).toBeUndefined()
  })

  it('has 8 principles and 7 practices', () => {
    expect(EYLF_PRINCIPLES).toHaveLength(8)
    expect(EYLF_PRACTICES).toHaveLength(7)
  })
})

describe('theory reference data', () => {
  it('every theory links to valid outcomes and has content', () => {
    for (const t of THEORIES) {
      expect(t.keyConcepts.length).toBeGreaterThan(0)
      expect(t.inPractice.length).toBeGreaterThan(0)
      expect(t.references.length).toBeGreaterThan(0)
      for (const id of t.eylfLinks) {
        expect(id).toBeGreaterThanOrEqual(1)
        expect(id).toBeLessThanOrEqual(5)
      }
    }
  })

  it('includes the Reggio Emilia approach', () => {
    const reggio = THEORIES.find(t => t.id === 'reggio')
    expect(reggio?.name).toContain('Reggio Emilia')
    expect(REGGIO_PRINCIPLES.length).toBeGreaterThanOrEqual(8)
  })
})