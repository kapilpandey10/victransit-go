export interface WrapUpSegment {
  id: string
  text: string
  isExtra: boolean
  extraIndex?: number
}

/**
 * Parses raw wrap-up text containing `<extra>...</extra>` tags into
 * ordered segments for interactive rendering.
 */
export function parseWrapUpSegments(raw: string): WrapUpSegment[] {
  if (!raw) return []
  const segments: WrapUpSegment[] = []
  const regex = /<extra>([\s\S]*?)<\/extra>/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let segCounter = 0
  let extraCounter = 0

  while ((match = regex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      const plain = raw.slice(lastIndex, match.index)
      if (plain) {
        segments.push({
          id: `seg-plain-${segCounter++}`,
          text: plain,
          isExtra: false,
        })
      }
    }
    segments.push({
      id: `seg-extra-${segCounter++}`,
      text: match[1],
      isExtra: true,
      extraIndex: extraCounter++,
    })
    lastIndex = regex.lastIndex
  }

  if (lastIndex < raw.length) {
    const trailing = raw.slice(lastIndex)
    if (trailing) {
      segments.push({
        id: `seg-plain-${segCounter++}`,
        text: trailing,
        isExtra: false,
      })
    }
  }

  return segments
}

/**
 * Strips markdown bold/italic asterisks and converts bullet asterisks into clean unicode bullets.
 */
export function removeMarkdownFormatting(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/^\s*[*]\s+/gm, '• ')
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1')
    .replace(/_([_\n]+)_/g, '$1')
}

/**
 * Produces clean, professional plain text for copying to clipboard or parent portals:
 * - Unwraps `<extra>` tags while preserving their content
 * - Strips any stray markdown bold/italic asterisks
 */
export function cleanPlainText(raw: string): string {
  if (!raw) return ''
  const withoutTags = raw.replace(/<\/?extra>/gi, '')
  return removeMarkdownFormatting(withoutTags).trim()
}

/**
 * Produces factual-only plain text by completely stripping all `<extra>...</extra>`
 * elaborations and cleaning any redundant spaces/newlines.
 */
export function factualOnlyPlainText(raw: string): string {
  if (!raw) return ''
  const withoutExtras = raw.replace(/<extra>[\s\S]*?<\/extra>/gi, '')
  return removeMarkdownFormatting(withoutExtras)
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Updates a specific `<extra>` segment in the raw text by its 0-based extra index.
 * - 'delete': removes the extra segment completely
 * - 'update': replaces the text inside the <extra>...</extra> tag
 * - 'keepPlain': keeps the text (or replacement text) but removes the <extra> tags
 */
export function updateSegmentInRaw(
  raw: string,
  targetExtraIndex: number,
  action:
    | { type: 'delete' }
    | { type: 'update'; newText: string }
    | { type: 'keepPlain'; newText?: string },
): string {
  let currentIndex = 0
  const updated = raw.replace(/<extra>([\s\S]*?)<\/extra>/g, (fullMatch, content) => {
    if (currentIndex === targetExtraIndex) {
      currentIndex++
      if (action.type === 'delete') {
        return ''
      }
      if (action.type === 'keepPlain') {
        return action.newText !== undefined ? action.newText : content
      }
      return `<extra>${action.newText}</extra>`
    }
    currentIndex++
    return fullMatch
  })

  return updated
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
}
