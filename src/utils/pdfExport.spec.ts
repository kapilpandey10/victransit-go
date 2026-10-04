import { describe, expect, it } from 'vitest'
import { exportLearningStoryPdf, exportProgramBookPdf, formatStoryDate } from './pdfExport'
import type { Activity, LearningStory } from '@/types'

describe('pdfExport utility', () => {
  it('formats dates properly like 19 Sept 2026', () => {
    expect(formatStoryDate('2026-09-19')).toBe('19 Sept 2026')
    expect(formatStoryDate('2026-03-01')).toBe('1 Mar 2026')
    expect(formatStoryDate('19 Sept 2026')).toBe('19 Sept 2026')
  })

  it('generates a valid jsPDF document for a learning story with custom options and minimal header', () => {
    const sampleStory: LearningStory = {
      id: 'story-1',
      user_id: 'user-1',
      created_at: '2026-10-04T00:00:00Z',
      updated_at: '2026-10-04T00:00:00Z',
      project_id: null,
      child_name: 'Leonardo',
      title: "Leonardo's Sky Adventure",
      setting: 'Outdoor Garden',
      narrative: 'Leonardo looked up at the sky and spotted a bright airplane with a long trail of cloud behind it. He told the group that the plane was heading to the moon, then to an airport, and that it would fly over Nikki garden where people were inside the plane.',
      analysis: 'Leonardo demonstrated imaginative language and confidence.',
      next_steps: 'Provide paper airplanes and flight trajectory drawings.',
      family_link: 'Has Leonardo noticed airplanes passing overhead at home?',
      educator_reflection: 'Great enthusiasm shown today.',
      educator_name: 'Kelly',
      story_date: '2026-09-19',
      eylf_outcome_ids: [5],
      theory_ids: ['piaget'],
      photo_urls: [],
    }

    // Default clean template: no centre header, no educator clutter, inline outcome
    const doc = exportLearningStoryPdf(sampleStory, {
      includePhotos: true,
      includeEylfInline: true,
      includeAnalysis: false,
      includeNextSteps: false,
      includeFamilyLink: false,
      includeEducator: false,
      includeCentreName: false,
    })
    expect(doc).toBeDefined()
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
  })

  it('generates a valid jsPDF document for a programming book activity with options', () => {
    const sampleActivity: Activity = {
      id: 'act-1',
      user_id: 'user-1',
      created_at: '2026-10-04T00:00:00Z',
      updated_at: '2026-10-04T00:00:00Z',
      project_id: null,
      title: 'Waterway Engineering in the Sandpit',
      description: 'The children worked collectively to dig channels and test water flow.',
      learning_intentions: 'Children will investigate cause-and-effect and collaborate with peers.',
      success_criteria: 'Children discuss where the water travels and work together to prevent leaks.',
      extension_ideas: 'Add bamboo gutters and water wheels tomorrow.',
      resources: 'Pipes, gutters, buckets, watering cans, sand shovels',
      room: 'Dandelions',
      experience_type: 'inquiry',
      date: '2026-10-04',
      eylf_outcome_ids: [2, 4],
      theory_ids: ['reggio', 'dewey'],
    }

    const doc = exportProgramBookPdf(sampleActivity, {
      includePhotos: false,
      includeLearningIntentions: true,
    })
    expect(doc).toBeDefined()
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
  })
})
