<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import jsMind, { type MindData, type JsMindNode, type MindNode } from 'jsmind'
import type { MindMapNode, NodeType } from '@/types'

const props = defineProps<{
  /** Flat nodes as stored in the database. */
  nodes: MindMapNode[]
  centralTopic: string
  /** Debounced autosave callback. */
  onSave?: (nodes: Partial<MindMapNode>[]) => void | Promise<void>
  saving?: boolean
}>()

const container = ref<HTMLElement | null>(null)
const selectedTopic = ref<string>('')
const hasSelection = ref(false)

let jm: jsMind | null = null
let saveTimer: number | undefined
let suppressEvents = false

const NODE_TYPES: { type: NodeType; label: string; icon: string; color: string }[] = [
  { type: 'theme', label: 'Line of inquiry', icon: '🧵', color: '#0d9488' },
  { type: 'question', label: 'Question', icon: '❓', color: '#7c3aed' },
  { type: 'activity', label: 'Experience', icon: '🎨', color: '#d1734a' },
  { type: 'resource', label: 'Resource', icon: '🧺', color: '#0284c7' },
  { type: 'theory', label: 'Theory', icon: '📚', color: '#b45309' },
  { type: 'outcome', label: 'EYLF outcome', icon: '🎯', color: '#be185d' },
]

function typeMeta(type: NodeType) {
  return NODE_TYPES.find(t => t.type === type) ?? NODE_TYPES[0]
}

/** Build a jsMind tree from the flat node rows. */
function buildMind(): MindData {
  const byId = new Map<string, MindMapNode>()
  props.nodes.forEach(n => byId.set(n.id, n))

  const childrenOf = (parentId: string | null) =>
    props.nodes
      .filter(n => (n.parent_id ?? 'root') === parentId)
      .sort((a, b) => a.sort_order - b.sort_order)

  const toNode = (row: MindMapNode): MindNode => {
    const meta = typeMeta(row.node_type)
    return {
      id: row.id,
      topic: row.text,
      expanded: true,
      direction: 1,
      background_color: meta.color,
      foreground_color: '#ffffff',
      note: row.note ?? '',
      node_type: row.node_type,
      children: childrenOf(row.id).map(toNode),
    }
  }

  return {
    meta: { name: props.centralTopic, author: 'Hadfield Inquiry Planner', version: '1.0' },
    format: 'node_tree',
    data: {
      id: 'root',
      topic: props.centralTopic || 'New inquiry',
      expanded: true,
      background_color: '#0f766e',
      foreground_color: '#ffffff',
      children: childrenOf('root').map(toNode),
    },
  }
}

/** Flatten the current jsMind tree back into rows for persistence. */
function collectNodes(): Partial<MindMapNode>[] {
  if (!jm) return []
  const data = jm.get_data('node_tree')
  const rows: Partial<MindMapNode>[] = []
  let order = 0

  const walk = (node: Record<string, unknown>, parentId: string | null) => {
    if (node.id !== 'root') {
      rows.push({
        id: node.id as string,
        parent_id: parentId,
        text: (node.topic as string) ?? '',
        note: (node.note as string) ?? '',
        node_type: (node.node_type as NodeType) ?? 'theme',
        color: (node.background_color as string) ?? null,
        sort_order: order++,
      })
    }
    const children = (node.children as Record<string, unknown>[]) ?? []
    children.forEach(child => walk(child, (node.id as string) ?? null))
  }

  walk(data.data as unknown as Record<string, unknown>, null)
  return rows
}

function scheduleSave() {
  if (suppressEvents) return
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    void props.onSave?.(collectNodes())
  }, 1500)
}

function init() {
  if (!container.value || jm) return
  jm = new jsMind({
    container: container.value,
    editable: true,
    theme: 'primary',
    mode: 'full',
    support_html: false,
    view: { engine: 'svg', hide_scrollbar: false, draggable: false, zoom: -1 },
    layout: { hspace: 40, vspace: 18 },
    shortcut: { enable: true },
  })
  jm.show(buildMind())

  const onSelect = (node?: JsMindNode) => {
    hasSelection.value = Boolean(node)
    selectedTopic.value = node?.topic ?? ''
  }
  jm.add_event_listener(onSelect, 'select_node')
  jm.add_event_listener(() => scheduleSave(), 'update_node')
  jm.add_event_listener(() => scheduleSave(), 'add_node')
  jm.add_event_listener(() => scheduleSave(), 'remove_node')
}

function addChild(type: NodeType) {
  if (!jm) return
  const parent = jm.get_selected_node() ?? jm.get_node('root')
  if (!parent) return
  const meta = typeMeta(type)
  const id = `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  jm.add_node(parent, id, `${meta.icon} New ${meta.label}`, {
    node_type: type,
    background_color: meta.color,
    foreground_color: '#ffffff',
    note: '',
  })
  scheduleSave()
}

function removeSelected() {
  if (!jm) return
  const node = jm.get_selected_node()
  if (!node || node.isroot) return
  suppressEvents = true
  jm.remove_node(node)
  suppressEvents = false
  scheduleSave()
}

function saveNow() {
  window.clearTimeout(saveTimer)
  void props.onSave?.(collectNodes())
}

defineExpose({ saveNow, collectNodes })

onMounted(init)

watch(
  () => props.nodes,
  () => {
    if (jm) jm.show(buildMind())
  },
)

onBeforeUnmount(() => {
  window.clearTimeout(saveTimer)
  jm = null
})
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs font-bold text-slate-500 dark:text-slate-400">
        Add to selection:
      </span>
      <button
        v-for="t in NODE_TYPES"
        :key="t.type"
        class="chip border border-slate-200 bg-white text-slate-700 transition hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        :title="`Add ${t.label}`"
        @click="addChild(t.type)"
      >
        <span>{{ t.icon }}</span>
        <span>{{ t.label }}</span>
      </button>
      <button
        class="btn-secondary !min-h-0 !py-1.5 text-xs"
        :disabled="!hasSelection"
        @click="removeSelected"
      >
        🗑 Delete selected
      </button>
      <button class="btn-secondary !min-h-0 !py-1.5 text-xs" @click="saveNow">
        💾 Save now
      </button>
    </div>

    <p v-if="hasSelection" class="text-xs text-slate-500 dark:text-slate-400">
      Selected: <span class="font-bold">{{ selectedTopic }}</span> — double-tap a node
      to edit its text.
    </p>
    <p v-else class="text-xs text-slate-500 dark:text-slate-400">
      Tap a node to select it, then add child ideas. Double-tap to rename.
    </p>

    <div
      ref="container"
      class="h-[60vh] min-h-[380px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
    />

    <p v-if="saving" class="text-xs text-brand-600">Saving…</p>
  </div>
</template>
