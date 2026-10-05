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

  it('weeklyWrapUp prompt includes room, week dates, raw notes, and reminders', () => {
    const prompt = PROMPTS.weeklyWrapUp({
      room: 'Chamomiles',
      weekLabel: 'Mon 6 Oct – Fri 10 Oct 2026',
      closed: 'Sat 11 Oct & Sun 12 Oct (centre closed)',
      days: [
        { label: 'Monday', date: '6 October', notes: 'Sandpit sensory exploration' },
        { label: 'Tuesday', date: '7 October', notes: '' },
      ],
      reminders: 'Hats: Please bring a sunhat',
      lostFound: 'Blue jumper',
      message: 'Bush kinder next term',
    })

    expect(prompt).toContain('ROOM: Chamomiles')
    expect(prompt).toContain('WEEK: Mon 6 Oct – Fri 10 Oct 2026')
    expect(prompt).toContain('Sandpit sensory exploration')
    expect(prompt).toContain('Hats: Please bring a sunhat')
    expect(prompt).toContain('Blue jumper')
    expect(prompt).toContain('Bush kinder next term')
    expect(prompt).toContain('<extra>...</extra>')
    expect(prompt).toContain('IGNORE Saturday and Sunday as holiday or closure')
    expect(prompt).toContain('happy and restful weekend')
  })

  it('suggestAlternativeExtra prompt asks for 3 alternatives in valid JSON', () => {
    const prompt = PROMPTS.suggestAlternativeExtra({
      activity: 'Making pancakes with Lakshmi',
      currentSnippet: 'Supported fine-motor skills and turn-taking.',
    })
    expect(prompt).toContain('Making pancakes with Lakshmi')
    expect(prompt).toContain('Supported fine-motor skills and turn-taking.')
    expect(prompt).toContain('"suggestions"')
  })

  it('learningStoryTopics prompt asks for 4 creative titles', () => {
    const prompt = PROMPTS.learningStoryTopics({
      child: 'Lacey',
      observation: 'Posting blocks into the abacus toy repeatedly.',
    })
    expect(prompt).toContain('Lacey')
    expect(prompt).toContain('Posting blocks')
    expect(prompt).toContain('"topics"')
  })

  it('programExperience prompt builds group inquiry plan for Programming Book', () => {
    const prompt = PROMPTS.programExperience({
      topicOrNotes: 'Building waterways and sand bridges with PVC pipes',
      room: 'Dandelions',
      type: 'inquiry',
      ageGroup: '3-5 years',
    })
    expect(prompt).toContain('Dandelions')
    expect(prompt).toContain('Building waterways')
    expect(prompt).toContain('learningIntentions')
    expect(prompt).toContain('teachingStrategies')
  })

  it('programExperienceTopics prompt asks for 4 inquiry topics', () => {
    const prompt = PROMPTS.programExperienceTopics({
      notes: 'Children interested in insects and mini beasts in the garden',
      room: 'Chamomiles',
    })
    expect(prompt).toContain('Chamomiles')
    expect(prompt).toContain('mini beasts')
    expect(prompt).toContain('"topics"')
  })
})