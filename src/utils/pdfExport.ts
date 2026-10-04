import { jsPDF } from 'jspdf'
import type { Activity, LearningStory } from '@/types'
import { EYLF_OUTCOMES } from '@/data/eylf'
import { THEORIES } from '@/data/theories'

export interface LearningStoryPrintOptions {
  centreName?: string
  includePhotos?: boolean
  includeEylfInline?: boolean
  includeAnalysis?: boolean
  includeNextSteps?: boolean
  includeFamilyLink?: boolean
  includeEducator?: boolean
  includeCentreName?: boolean
  includeFooterTags?: boolean
  imageSize?: 'tiny' | 'small' | 'medium'
  targetFormat?: 'a4' | '1/4-a3'
}

export interface ProgramBookPrintOptions {
  centreName?: string
  includePhotos?: boolean
  includeEylfInline?: boolean
  includeLearningIntentions?: boolean
  includeStrategies?: boolean
  includeResources?: boolean
  includeExtensions?: boolean
  includeEducator?: boolean
  includeCentreName?: boolean
  includeFooterTags?: boolean
  imageSize?: 'tiny' | 'small' | 'medium'
  targetFormat?: 'a4' | '1/4-a3'
}

/**
 * Formats a date string (YYYY-MM-DD or standard) to e.g. "19 Sept 2026"
 */
export function formatStoryDate(dateStr?: string | null): string {
  if (!dateStr) {
    const today = new Date()
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec']
    return `${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`
  }
  const parts = dateStr.split('-')
  if (parts.length === 3 && parts[0].length === 4) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
    if (!isNaN(d.getTime())) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec']
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
    }
  }
  return dateStr
}

/**
 * Creates and downloads a print-ready PDF report for an individual child's Learning Story.
 * Follows the user's template: Bold Title left, Bold Date right, small images stacked
 * vertically on the right with wrapped narrative text and inline EYLF outcome tag.
 * Tuned for compact cards (1/4 of A3 scrapbook quadrant) with small images and 0 wasted pages.
 */
export function exportLearningStoryPdf(
  story: LearningStory,
  opts: LearningStoryPrintOptions = {},
): jsPDF {
  const isA5 = opts.targetFormat === '1/4-a3'
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: isA5 ? 'a5' : 'a4',
  })

  const pageWidth = isA5 ? 148 : 210
  const pageHeight = isA5 ? 210 : 297
  const marginX = isA5 ? 12 : 16
  const contentWidth = pageWidth - marginX * 2
  let currentY = isA5 ? 12 : 16

  function ensureSpace(neededMm: number) {
    if (currentY + neededMm > pageHeight - marginX) {
      doc.addPage()
      currentY = marginX
    }
  }

  // 1. Optional Centre Header
  if (opts.includeCentreName) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(100, 116, 139)
    doc.text((opts.centreName || 'HADFIELD EARLY LEARNING CENTRE').toUpperCase(), marginX, currentY)
    currentY += 5
  }

  // 2. Header: Bold Title on the left, Bold Date on the right
  const title = story.title || 'Learning Story'
  const dateStr = formatStoryDate(story.story_date)

  const dateFontSize = isA5 ? 11 : 13
  const titleFontSize = isA5 ? 15 : 18
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(dateFontSize)
  const dateWidth = doc.getTextWidth(dateStr)

  doc.setFontSize(titleFontSize)
  doc.setTextColor(15, 23, 42) // slate-900

  const titleMaxWidth = contentWidth - dateWidth - 6
  const titleLines = doc.splitTextToSize(title, titleMaxWidth)
  doc.text(titleLines, marginX, currentY)

  // Date aligned to right on first line
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(dateFontSize)
  doc.setTextColor(15, 23, 42)
  doc.text(dateStr, marginX + contentWidth, currentY, { align: 'right' })

  currentY += Math.max(titleLines.length * (isA5 ? 6.5 : 7.5), 7) + 3

  // 3. Optional Child / Educator Details
  if (opts.includeEducator) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(isA5 ? 8 : 9)
    doc.setTextColor(71, 85, 105)
    const authorStr = story.educator_name ? `Educator: ${story.educator_name}` : ''
    const childStr = story.child_name ? ` · Child: ${story.child_name}` : ''
    const settingStr = story.setting ? ` · Setting: ${story.setting}` : ''
    const metaStr = `${authorStr}${childStr}${settingStr}`.replace(/^ · /, '')
    if (metaStr) {
      doc.text(metaStr, marginX, currentY)
      currentY += 4.5
    }
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(marginX, currentY, marginX + contentWidth, currentY)
    currentY += 4.5
  }

  // 4. Photos (compact small images, max 2 stacked vertically on right) & Wrapped Narrative
  const includePhotos = opts.includePhotos !== false
  const rawPhotos = (includePhotos ? (story.photo_urls || []) : []).filter(Boolean).slice(0, 2)
  const hasPhotos = rawPhotos.length > 0

  let narrativeText = (story.narrative || '').trim()
  if (opts.includeEylfInline !== false && story.eylf_outcome_ids?.length) {
    const outcomeLabels = story.eylf_outcome_ids.map(id => `EYLF Outcome ${id}`).join(', ')
    if (outcomeLabels) {
      narrativeText = narrativeText ? `${narrativeText} (${outcomeLabels})` : `(${outcomeLabels})`
    }
  }

  if (hasPhotos) {
    // Sizing tuned for compact layout and 1/4 A3 pasting
    const isTiny = opts.imageSize === 'tiny'
    const isMedium = opts.imageSize === 'medium'
    const photoWidth = isTiny ? 22 : isMedium ? 38 : 28 // default 28mm (~80pt)
    const photoHeight = isTiny ? 16 : isMedium ? 28 : 21 // default 21mm (~60pt)
    const photoGap = 2
    const photoX = marginX + contentWidth - photoWidth
    const totalPhotosHeight = rawPhotos.length === 2 ? photoHeight * 2 + photoGap : photoHeight

    // Draw up to 2 small photos stacked on right
    for (let i = 0; i < rawPhotos.length; i++) {
      const imgY = currentY + i * (photoHeight + photoGap)
      try {
        const format = rawPhotos[i].startsWith('data:image/png') ? 'PNG' : 'JPEG'
        doc.addImage(rawPhotos[i], format, photoX, imgY, photoWidth, photoHeight)
        doc.setDrawColor(203, 213, 225)
        doc.setLineWidth(0.2)
        doc.rect(photoX, imgY, photoWidth, photoHeight)
      } catch {
        // Fallback gracefully
      }
    }

    // Text wrapping beside photos (tight 4mm margin on edge)
    const textWidthBeside = contentWidth - photoWidth - 4
    doc.setFont('helvetica', 'normal')
    const bodyFontSize = isA5 ? 8.8 : 9.5
    const lineHeight = isA5 ? 4.4 : 4.8
    doc.setFontSize(bodyFontSize)
    doc.setTextColor(30, 41, 59)

    const linesBesideMax = Math.floor(totalPhotosHeight / lineHeight)
    const allLinesBeside = doc.splitTextToSize(narrativeText, textWidthBeside)

    if (allLinesBeside.length <= linesBesideMax) {
      doc.text(allLinesBeside, marginX, currentY + 1)
      currentY = currentY + Math.max(totalPhotosHeight, allLinesBeside.length * lineHeight) + 5
    } else {
      const linesBeside = allLinesBeside.slice(0, linesBesideMax)
      doc.text(linesBeside, marginX, currentY + 1)

      const remainingText = allLinesBeside.slice(linesBesideMax).join(' ')
      const linesBelow = doc.splitTextToSize(remainingText, contentWidth)

      currentY = currentY + totalPhotosHeight + 4
      ensureSpace(linesBelow.length * lineHeight)
      doc.text(linesBelow, marginX, currentY)
      currentY += linesBelow.length * lineHeight + 5
    }
  } else {
    // Full width narrative
    doc.setFont('helvetica', 'normal')
    const bodyFontSize = isA5 ? 8.8 : 9.5
    const lineHeight = isA5 ? 4.4 : 4.8
    doc.setFontSize(bodyFontSize)
    doc.setTextColor(30, 41, 59)
    const narrativeLines = doc.splitTextToSize(narrativeText, contentWidth)
    ensureSpace(narrativeLines.length * lineHeight)
    doc.text(narrativeLines, marginX, currentY + 1)
    currentY += narrativeLines.length * lineHeight + 5
  }

  // 5. Optional Section: "What [Child] is learning here?" (Analysis)
  if (opts.includeAnalysis && story.analysis?.trim()) {
    ensureSpace(18)
    const childName = story.child_name || 'the child'
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(isA5 ? 9.5 : 10.5)
    doc.setTextColor(15, 118, 110)
    doc.text(`What ${childName} is learning here?`, marginX, currentY)
    currentY += 4.5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(isA5 ? 8 : 9)
    doc.setTextColor(51, 65, 85)
    const analysisLines = doc.splitTextToSize(story.analysis.trim(), contentWidth)
    ensureSpace(analysisLines.length * 4.2)
    doc.text(analysisLines, marginX, currentY)
    currentY += analysisLines.length * 4.2 + 5
  }

  // 6. Optional Section: "Ways to support continued engagement for [Child]" (Next Steps)
  if (opts.includeNextSteps && story.next_steps?.trim()) {
    ensureSpace(18)
    const childName = story.child_name || 'the child'
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(isA5 ? 9.5 : 10.5)
    doc.setTextColor(15, 118, 110)
    doc.text(`Ways to support continued engagement for ${childName}`, marginX, currentY)
    currentY += 4.5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(isA5 ? 8 : 9)
    doc.setTextColor(51, 65, 85)
    const nextLines = doc.splitTextToSize(story.next_steps.trim(), contentWidth)
    ensureSpace(nextLines.length * 4.2)
    doc.text(nextLines, marginX, currentY)
    currentY += nextLines.length * 4.2 + 5
  }

  // 7. Optional Section: Family Connection
  if (opts.includeFamilyLink && story.family_link?.trim()) {
    ensureSpace(16)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(isA5 ? 9.5 : 10.5)
    doc.setTextColor(15, 118, 110)
    doc.text('Family Connection / Question for Home', marginX, currentY)
    currentY += 4.5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(isA5 ? 8 : 9)
    doc.setTextColor(51, 65, 85)
    const familyLines = doc.splitTextToSize(story.family_link.trim(), contentWidth)
    ensureSpace(familyLines.length * 4.2)
    doc.text(familyLines, marginX, currentY)
    currentY += familyLines.length * 4.2 + 5
  }

  // 8. Optional Footer Tags (EYLF & Theorists)
  if (opts.includeFooterTags) {
    ensureSpace(12)
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(marginX, currentY, marginX + contentWidth, currentY)
    currentY += 4

    const outcomesStr = (story.eylf_outcome_ids || [])
      .map(id => {
        const found = EYLF_OUTCOMES.find(o => o.id === id)
        return `Outcome ${id}: ${found?.title || ''}`
      })
      .join(' · ')

    const theoriesStr = (story.theory_ids || [])
      .map(tid => {
        const found = THEORIES.find(t => t.id === tid)
        return found?.name ? found.name.split('—')[0].trim() : tid
      })
      .join(', ')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    if (outcomesStr) {
      doc.text(`EYLF v2.0: ${outcomesStr}`, marginX, currentY)
      currentY += 3.2
    }
    if (theoriesStr) {
      doc.text(`Theoretical Lens: ${theoriesStr}`, marginX, currentY)
    }
  }

  return doc
}

/**
 * Creates and downloads a print-ready PDF report for a Programming Book entry.
 * Supports bold title left, bold date right, small wrapped images, and selective pedagogical sections.
 */
export function exportProgramBookPdf(
  activity: Activity,
  opts: ProgramBookPrintOptions = {},
): jsPDF {
  const isA5 = opts.targetFormat === '1/4-a3'
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: isA5 ? 'a5' : 'a4',
  })

  const pageWidth = isA5 ? 148 : 210
  const pageHeight = isA5 ? 210 : 297
  const marginX = isA5 ? 12 : 16
  const contentWidth = pageWidth - marginX * 2
  let currentY = isA5 ? 12 : 16

  function ensureSpace(neededMm: number) {
    if (currentY + neededMm > pageHeight - marginX) {
      doc.addPage()
      currentY = marginX
    }
  }

  // 1. Optional Centre Header
  if (opts.includeCentreName) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(100, 116, 139)
    doc.text((opts.centreName || 'HADFIELD EARLY LEARNING CENTRE · PROGRAMMING BOOK').toUpperCase(), marginX, currentY)
    currentY += 5
  }

  // 2. Bold Title (left) & Bold Date (right)
  const title = activity.title || 'Curriculum Experience'
  const dateStr = formatStoryDate(activity.date)

  const dateFontSize = isA5 ? 11 : 13
  const titleFontSize = isA5 ? 15 : 18
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(dateFontSize)
  const dateWidth = doc.getTextWidth(dateStr)

  doc.setFontSize(titleFontSize)
  doc.setTextColor(15, 23, 42)

  const titleMaxWidth = contentWidth - dateWidth - 6
  const titleLines = doc.splitTextToSize(title, titleMaxWidth)
  doc.text(titleLines, marginX, currentY)

  // Date on right
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(dateFontSize)
  doc.setTextColor(15, 23, 42)
  doc.text(dateStr, marginX + contentWidth, currentY, { align: 'right' })

  currentY += Math.max(titleLines.length * (isA5 ? 6.5 : 7.5), 7) + 3

  // 3. Optional Educator / Room / Type
  if (opts.includeEducator) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(isA5 ? 8 : 9)
    doc.setTextColor(71, 85, 105)
    const typeLabel = activity.experience_type
      ? activity.experience_type.charAt(0).toUpperCase() + activity.experience_type.slice(1) + ' Experience'
      : 'Group Experience'
    const roomLabel = activity.room ? ` · Room: ${activity.room}` : ''
    const educatorLabel = activity.educator_name ? ` · Educator: ${activity.educator_name}` : ''
    doc.text(`${typeLabel}${roomLabel}${educatorLabel}`, marginX, currentY)
    currentY += 4.5

    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(marginX, currentY, marginX + contentWidth, currentY)
    currentY += 4.5
  }

  // 4. Description / What Happened with small photos
  const includePhotos = opts.includePhotos !== false
  const rawPhotos = (includePhotos ? (activity.photo_urls || []) : []).filter(Boolean).slice(0, 2)
  const hasPhotos = rawPhotos.length > 0

  let descText = (activity.description || '').trim()
  if (opts.includeEylfInline !== false && activity.eylf_outcome_ids?.length) {
    const outcomeLabels = activity.eylf_outcome_ids.map(id => `EYLF Outcome ${id}`).join(', ')
    if (outcomeLabels) {
      descText = descText ? `${descText} (${outcomeLabels})` : `(${outcomeLabels})`
    }
  }

  if (hasPhotos) {
    const isTiny = opts.imageSize === 'tiny'
    const isMedium = opts.imageSize === 'medium'
    const photoWidth = isTiny ? 22 : isMedium ? 38 : 28
    const photoHeight = isTiny ? 16 : isMedium ? 28 : 21
    const photoGap = 2
    const photoX = marginX + contentWidth - photoWidth
    const totalPhotosHeight = rawPhotos.length === 2 ? photoHeight * 2 + photoGap : photoHeight

    for (let i = 0; i < rawPhotos.length; i++) {
      const imgY = currentY + i * (photoHeight + photoGap)
      try {
        const format = rawPhotos[i].startsWith('data:image/png') ? 'PNG' : 'JPEG'
        doc.addImage(rawPhotos[i], format, photoX, imgY, photoWidth, photoHeight)
        doc.setDrawColor(203, 213, 225)
        doc.setLineWidth(0.2)
        doc.rect(photoX, imgY, photoWidth, photoHeight)
      } catch {
        // Fallback
      }
    }

    const textWidthBeside = contentWidth - photoWidth - 4
    doc.setFont('helvetica', 'normal')
    const bodyFontSize = isA5 ? 8.8 : 9.5
    const lineHeight = isA5 ? 4.4 : 4.8
    doc.setFontSize(bodyFontSize)
    doc.setTextColor(30, 41, 59)

    const linesBesideMax = Math.floor(totalPhotosHeight / lineHeight)
    const allLinesBeside = doc.splitTextToSize(descText, textWidthBeside)

    if (allLinesBeside.length <= linesBesideMax) {
      doc.text(allLinesBeside, marginX, currentY + 1)
      currentY = currentY + Math.max(totalPhotosHeight, allLinesBeside.length * lineHeight) + 5
    } else {
      const linesBeside = allLinesBeside.slice(0, linesBesideMax)
      doc.text(linesBeside, marginX, currentY + 1)

      const remainingText = allLinesBeside.slice(linesBesideMax).join(' ')
      const linesBelow = doc.splitTextToSize(remainingText, contentWidth)

      currentY = currentY + totalPhotosHeight + 4
      ensureSpace(linesBelow.length * lineHeight)
      doc.text(linesBelow, marginX, currentY)
      currentY += linesBelow.length * lineHeight + 5
    }
  } else if (descText) {
    doc.setFont('helvetica', 'normal')
    const bodyFontSize = isA5 ? 8.8 : 9.5
    const lineHeight = isA5 ? 4.4 : 4.8
    doc.setFontSize(bodyFontSize)
    doc.setTextColor(30, 41, 59)
    const descLines = doc.splitTextToSize(descText, contentWidth)
    ensureSpace(descLines.length * lineHeight)
    doc.text(descLines, marginX, currentY + 1)
    currentY += descLines.length * lineHeight + 5
  }

  // 5. Optional Learning Intentions
  if (opts.includeLearningIntentions && activity.learning_intentions?.trim()) {
    ensureSpace(18)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(isA5 ? 9.5 : 10.5)
    doc.setTextColor(15, 118, 110)
    doc.text('Learning Intentions', marginX, currentY)
    currentY += 4.5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(isA5 ? 8 : 9)
    doc.setTextColor(51, 65, 85)
    const intentLines = doc.splitTextToSize(activity.learning_intentions.trim(), contentWidth)
    ensureSpace(intentLines.length * 4.2)
    doc.text(intentLines, marginX, currentY)
    currentY += intentLines.length * 4.2 + 5
  }

  // 6. Optional Teaching Strategies
  if (opts.includeStrategies && activity.success_criteria?.trim()) {
    ensureSpace(18)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(isA5 ? 9.5 : 10.5)
    doc.setTextColor(15, 118, 110)
    doc.text('Intentional Teaching Strategies & Educator Role', marginX, currentY)
    currentY += 4.5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(isA5 ? 8 : 9)
    doc.setTextColor(51, 65, 85)
    const stratLines = doc.splitTextToSize(activity.success_criteria.trim(), contentWidth)
    ensureSpace(stratLines.length * 4.2)
    doc.text(stratLines, marginX, currentY)
    currentY += stratLines.length * 4.2 + 5
  }

  // 7. Optional Environment & Loose parts
  if (opts.includeResources && activity.resources?.trim()) {
    ensureSpace(16)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(isA5 ? 9.5 : 10.5)
    doc.setTextColor(15, 118, 110)
    doc.text('Environment, Materials & Loose Parts', marginX, currentY)
    currentY += 4.5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(isA5 ? 8 : 9)
    doc.setTextColor(51, 65, 85)
    const resLines = doc.splitTextToSize(activity.resources.trim(), contentWidth)
    ensureSpace(resLines.length * 4.2)
    doc.text(resLines, marginX, currentY)
    currentY += resLines.length * 4.2 + 5
  }

  // 8. Optional Extensions
  if (opts.includeExtensions && activity.extension_ideas?.trim()) {
    ensureSpace(16)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(isA5 ? 9.5 : 10.5)
    doc.setTextColor(15, 118, 110)
    doc.text('Extensions & Continuing Inquiries', marginX, currentY)
    currentY += 4.5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(isA5 ? 8 : 9)
    doc.setTextColor(51, 65, 85)
    const extLines = doc.splitTextToSize(activity.extension_ideas.trim(), contentWidth)
    ensureSpace(extLines.length * 4.2)
    doc.text(extLines, marginX, currentY)
    currentY += extLines.length * 4.2 + 5
  }

  // 9. Optional Footer Tags
  if (opts.includeFooterTags) {
    ensureSpace(12)
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(marginX, currentY, marginX + contentWidth, currentY)
    currentY += 4

    const outcomesStr = (activity.eylf_outcome_ids || [])
      .map(id => `Outcome ${id}`)
      .join(' · ')
    const theoriesStr = (activity.theory_ids || []).join(', ')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    if (outcomesStr) doc.text(`EYLF Outcomes: ${outcomesStr}`, marginX, currentY)
    if (theoriesStr) doc.text(`Theorists / Pedagogy: ${theoriesStr}`, marginX, currentY + 3.2)
  }

  return doc
}
