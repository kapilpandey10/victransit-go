<script setup lang="ts">
import { computed } from 'vue'

/**
 * Deliberately tiny, dependency-free Markdown renderer.
 * Supports headings, bold, italics, inline code, links, bullet/numbered lists
 * and paragraphs — everything the AI assistant is expected to emit.
 * Input is escaped first, so it is safe to bind with v-html.
 */
const props = defineProps<{ source: string }>()

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inline(text: string) {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener" class="text-brand-700 underline">$1</a>',
    )
}

const html = computed(() => {
  const source = escapeHtml(props.source ?? '')
  const lines = source.split('\n')
  const out: string[] = []
  let listType: 'ul' | 'ol' | null = null

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`)
      listType = null
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()

    if (!line.trim()) {
      closeList()
      continue
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      closeList()
      const level = heading[1].length + 1
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`)
      continue
    }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/)
    if (bullet) {
      if (listType !== 'ul') {
        closeList()
        out.push('<ul>')
        listType = 'ul'
      }
      out.push(`<li>${inline(bullet[1])}</li>`)
      continue
    }

    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/)
    if (numbered) {
      if (listType !== 'ol') {
        closeList()
        out.push('<ol>')
        listType = 'ol'
      }
      out.push(`<li>${inline(numbered[1])}</li>`)
      continue
    }

    closeList()
    out.push(`<p>${inline(line)}</p>`)
  }
  closeList()
  return out.join('\n')
})
</script>

<template>
  <div class="prose-educator" v-html="html" />
</template>