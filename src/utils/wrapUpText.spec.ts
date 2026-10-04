import { describe, expect, it } from 'vitest'
import {
  cleanPlainText,
  factualOnlyPlainText,
  parseWrapUpSegments,
  removeMarkdownFormatting,
  updateSegmentInRaw,
} from './wrapUpText'

describe('wrapUpText utilities', () => {
  const sampleRaw = `Dandelions Room – Weekly Wrap-Up

Hello Dandelions Families,
Wominjeka!

This week, the children made pancakes with Lakshmi. <extra>This hands-on cooking experience supported fine-motor skills and turn-taking.</extra>

Later, Kapil guided a road map building experience with cardboard. <extra>This encouraged spatial reasoning and community discussions.</extra>

Reminders:
• Sun Protection: Please ensure children bring a sun-safe hat and spare clothes.

The Dandelions Team`

  it('parses raw text into plain and extra segments', () => {
    const segments = parseWrapUpSegments(sampleRaw)
    expect(segments.length).toBe(5)
    expect(segments[0].isExtra).toBe(false)
    expect(segments[0].text).toContain('Dandelions Room')
    expect(segments[1].isExtra).toBe(true)
    expect(segments[1].text).toContain('This hands-on cooking experience')
    expect(segments[1].extraIndex).toBe(0)
    expect(segments[2].isExtra).toBe(false)
    expect(segments[3].isExtra).toBe(true)
    expect(segments[3].extraIndex).toBe(1)
    expect(segments[4].isExtra).toBe(false)
  })

  it('strips markdown formatting and returns clean plain text with no bold syntax', () => {
    const markdownText = `**Dandelions Room** – **Weekly Wrap-Up**\n* **Sun Protection:** Bring hat.`
    const cleaned = removeMarkdownFormatting(markdownText)
    expect(cleaned).not.toContain('**')
    expect(cleaned).not.toContain('*')
    expect(cleaned).toContain('Dandelions Room – Weekly Wrap-Up')
    expect(cleaned).toContain('Sun Protection: Bring hat.')
  })

  it('cleanPlainText unwraps extra tags and removes bold markdown', () => {
    const result = cleanPlainText(sampleRaw)
    expect(result).not.toContain('<extra>')
    expect(result).not.toContain('</extra>')
    expect(result).toContain('This hands-on cooking experience supported fine-motor skills')
    expect(result).toContain('Reminders:')
  })

  it('factualOnlyPlainText strips all extra blocks completely', () => {
    const factual = factualOnlyPlainText(sampleRaw)
    expect(factual).not.toContain('fine-motor skills')
    expect(factual).not.toContain('spatial reasoning')
    expect(factual).toContain('children made pancakes with Lakshmi.')
    expect(factual).toContain('Kapil guided a road map building experience')
    expect(factual).toContain('Sun Protection:')
  })

  it('updateSegmentInRaw can delete a specific extra segment', () => {
    const updated = updateSegmentInRaw(sampleRaw, 0, { type: 'delete' })
    expect(updated).not.toContain('This hands-on cooking experience')
    expect(updated).toContain('This encouraged spatial reasoning')
  })

  it('updateSegmentInRaw can update text inside an extra segment', () => {
    const updated = updateSegmentInRaw(sampleRaw, 1, {
      type: 'update',
      newText: 'Children explored collaborative engineering.',
    })
    expect(updated).toContain('<extra>Children explored collaborative engineering.</extra>')
    expect(updated).not.toContain('spatial reasoning')
  })

  it('updateSegmentInRaw can convert an extra segment into permanent plain text', () => {
    const updated = updateSegmentInRaw(sampleRaw, 0, {
      type: 'keepPlain',
      newText: 'Approved reflection for families.',
    })
    expect(updated).toContain('Approved reflection for families.')
    expect(updated).not.toContain('<extra>Approved reflection for families.</extra>')
    // Second extra should remain tagged
    expect(updated).toContain('<extra>This encouraged spatial reasoning and community discussions.</extra>')
  })
})
