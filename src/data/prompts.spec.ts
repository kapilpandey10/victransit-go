import { describe, expect, it } from 'vitest'
import { CHAT_STARTERS, EYLF_REFERENCE, PROMPTS } from './prompts'

describe('AI prompt builders', () => {
  it('embeds all five outcomes in the reference block', () => {
    for (let i = 1; i <= 5; i++) {
      expect(EYLF_REFERENCE).toContain(String(i))
    }
  })

  it('learningOutcomes prompt names the valid theory ids', () => {
    const text = PROMPTS.learningOutcomes('water play', '2-3 years')
    for (const id of ['vygotsky', 'piaget', 'reggio', 'montessori', 'dewey', 'bruner']) {
      expect(text).toContain(id)
    }
    expect(text.toUpperCase()).not.toContain('AMELIA')
  })

  it('learningStory prompt asks for valid JSON shape', () => {
    const text = PROMPTS.learningStory({ child: 'Ava', observation: 'stacked blocks' })
    expect(text).toContain('narrative')
    expect(text).toContain('educatorReflection')
    expect(text).toContain('Return ONLY valid JSON')
  })

  it('newsletter prompt caps length and softens jargon', () => {
    const text = PROMPTS.newsletter({ term: 'Term 1', highlights: 'gardening' })
    expect(text).toContain('450')
    expect(text.toLowerCase()).toContain('jargon')
  })

  it('programAnalysis prompt demands integer coverage scores', () => {
    expect(PROMPTS.programAnalysis({ programText: 'x' })).toContain('"coverage"')
  })

  it('has six chat starters', () => {
    expect(CHAT_STARTERS).toHaveLength(6)
    for (const s of CHAT_STARTERS) {
      expect(s.label.length).toBeGreaterThan(0)
      expect(s.prompt.length).toBeGreaterThan(20)
    }
  })
})