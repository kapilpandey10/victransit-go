<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'

const ui = useUiStore()
const auth = useAuthStore()
const router = useRouter()

// ---- Types -----------------------------------------------------------------

export type TemplateId =
  | 'grid-4-quad'
  | 'grid-4-hero'
  | 'grid-5-showcase'
  | 'grid-5-split'
  | 'grid-6-equal'
  | 'grid-6-magazine'
  | 'grid-8-floorbook'
  | 'freeform'

export type AspectRatio = 'a4-landscape' | 'a4-portrait' | 'square' | 'wide'

export type CanvasTheme = 'white' | 'linen' | 'dark' | 'sage' | 'ochre'

export interface PhotoCell {
  id: string
  image: string | null
  zoom: number // 1.0 to 3.0
  panX: number // percentage -50 to 50
  panY: number // percentage -50 to 50
  rotation: number // 0, 90, 180, 270
  caption: string
  filter: 'none' | 'warm' | 'vivid' | 'bw' | 'soft'
}

export interface CanvasTextItem {
  id: string
  text: string
  type: 'title' | 'quote' | 'note' | 'stamp'
  x: number // percentage 0 to 100
  y: number // percentage 0 to 100
  fontSize: number // px
  fontFamily: 'sans' | 'sketch' | 'serif' | 'display'
  color: string
  bgColor: 'transparent' | 'dark-glass' | 'frosted' | 'emerald' | 'amber' | 'rose'
  isDragging?: boolean
}

export interface CanvasStickerItem {
  id: string
  label: string
  icon: string
  category: 'eylf' | 'reggio' | 'disposition'
  x: number // percentage 0 to 100
  y: number // percentage 0 to 100
  colorClass: string
  isDragging?: boolean
}

export interface FreeformImageItem {
  id: string
  image: string
  x: number // px or percentage
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  caption: string
  polaroid: boolean
  isDragging?: boolean
  isResizing?: boolean
}

// ---- State -----------------------------------------------------------------

const activeTemplate = ref<TemplateId>('grid-4-quad')
const aspectRatio = ref<AspectRatio>('a4-landscape')
const canvasTheme = ref<CanvasTheme>('linen')
const gapSize = ref<number>(10)
const paddingSize = ref<number>(16)
const cornerRadius = ref<number>(12)
const polaroidStyle = ref<boolean>(false)

// Canvas elements
const cells = ref<PhotoCell[]>([])
const textItems = ref<CanvasTextItem[]>([])
const stickerItems = ref<CanvasStickerItem[]>([])
const freeformImages = ref<FreeformImageItem[]>([])

// Selection & interaction state
const selectedCellId = ref<string | null>(null)
const selectedTextId = ref<string | null>(null)
const selectedFreeformId = ref<string | null>(null)
const exportLoading = ref(false)
const hiddenFileInput = ref<HTMLInputElement | null>(null)
const targetedCellForUpload = ref<string | null>(null)

// UI panels
const sidebarCollapsed = ref(false)
const activePanel = ref<'templates' | 'style' | 'text' | 'stickers'>('templates')

// Memory Tracking
const inMemoryPhotoCount = computed(() => {
  const gridPhotos = cells.value.filter(c => !!c.image).length
  const freePhotos = freeformImages.value.length
  return gridPhotos + freePhotos
})

// Aspect Ratio Dimensions in CSS pixels (compact baseline for crisp responsive layout)
const canvasDimensions = computed(() => {
  switch (aspectRatio.value) {
    case 'a4-landscape':
      return { width: 760, height: 538, ratioLabel: 'A4 Landscape (1.41 : 1)' }
    case 'a4-portrait':
      return { width: 538, height: 760, ratioLabel: 'A4 Portrait (1 : 1.41)' }
    case 'square':
      return { width: 540, height: 540, ratioLabel: 'Square 1:1' }
    case 'wide':
      return { width: 780, height: 438, ratioLabel: 'Wide 16:9' }
  }
})

// Interactive scale/zoom for canvas playground
const canvasScale = ref(0.9)

function zoomInCanvas() {
  canvasScale.value = Math.min(1.3, Number((canvasScale.value + 0.1).toFixed(1)))
}

function zoomOutCanvas() {
  canvasScale.value = Math.max(0.5, Number((canvasScale.value - 0.1).toFixed(1)))
}

function resetCanvasZoom(scale = 0.9) {
  canvasScale.value = scale
}

// Theme Classes
const themeClasses = computed(() => {
  switch (canvasTheme.value) {
    case 'white':
      return 'bg-white text-slate-900 border-slate-200'
    case 'linen':
      return 'bg-[#F9F7F2] text-stone-900 border-[#E9E4DC]'
    case 'dark':
      return 'bg-slate-950 text-slate-100 border-slate-800'
    case 'sage':
      return 'bg-[#F0FDF4] text-emerald-950 border-emerald-100'
    case 'ochre':
      return 'bg-[#FEFCE8] text-amber-950 border-amber-100'
  }
})

// Templates Definition
const TEMPLATES: Array<{
  id: TemplateId
  name: string
  gridCount: number
  icon: string
  description: string
}> = [
  {
    id: 'grid-4-quad',
    name: '4-Grid Quad',
    gridCount: 4,
    icon: '⊞',
    description: '4 balanced equal panels. Ideal for four distinct stages of discovery.',
  },
  {
    id: 'grid-4-hero',
    name: '4-Grid Hero + Progression',
    gridCount: 4,
    icon: '◫',
    description: '1 large hero focus on the left with 3 sequential progression photos.',
  },
  {
    id: 'grid-5-showcase',
    name: '5-Grid Showcase',
    gridCount: 5,
    icon: '⬚',
    description: '1 large center anchor with 4 surrounding detail snapshots.',
  },
  {
    id: 'grid-5-split',
    name: '5-Grid Split',
    gridCount: 5,
    icon: '☵',
    description: '2 featured top photos with 3 bottom action moments.',
  },
  {
    id: 'grid-6-equal',
    name: '6-Grid Inquiry Series',
    gridCount: 6,
    icon: '⠿',
    description: '3 x 2 grid. Perfect for step-by-step scientific or sensory investigations.',
  },
  {
    id: 'grid-6-magazine',
    name: '6-Grid Magazine',
    gridCount: 6,
    icon: '📰',
    description: '2 large horizontal headers with 4 supporting gallery tiles.',
  },
  {
    id: 'grid-8-floorbook',
    name: '8-Grid Floorbook Panel',
    gridCount: 8,
    icon: '▦',
    description: '4 x 2 comprehensive floorbook investigation documentation.',
  },
  {
    id: 'freeform',
    name: 'Freeform Scrapbook Canvas',
    gridCount: 0,
    icon: '🎨',
    description: 'Freeform canvas. Drop, drag, rotate, and scale photos anywhere.',
  },
]

// Preset Stickers
const PRESET_STICKERS = [
  { label: 'Outcome 1 · Identity & Agency', icon: '🌱', category: 'eylf', colorClass: 'bg-rose-500/90 text-white' },
  { label: 'Outcome 2 · Connected to World', icon: '🌏', category: 'eylf', colorClass: 'bg-sky-500/90 text-white' },
  { label: 'Outcome 3 · Wellbeing & Health', icon: '☀️', category: 'eylf', colorClass: 'bg-amber-500/90 text-white' },
  { label: 'Outcome 4 · Inquiry & STEM', icon: '🔍', category: 'eylf', colorClass: 'bg-violet-500/90 text-white' },
  { label: 'Outcome 5 · 100 Languages', icon: '💬', category: 'eylf', colorClass: 'bg-emerald-500/90 text-white' },
  { label: 'Reggio: 3rd Teacher', icon: '🌿', category: 'reggio', colorClass: 'bg-teal-600/90 text-white' },
  { label: 'Loose Parts Inquiry', icon: '🧩', category: 'reggio', colorClass: 'bg-orange-600/90 text-white' },
  { label: 'Child Theory in Action', icon: '💡', category: 'disposition', colorClass: 'bg-indigo-600/90 text-white' },
  { label: 'Wonder & Curiosity', icon: '✨', category: 'disposition', colorClass: 'bg-yellow-500 text-slate-900' },
  { label: 'Persistence & Agency', icon: '💪', category: 'disposition', colorClass: 'bg-cyan-600/90 text-white' },
]

// ---- Template Setup & Switching --------------------------------------------

function initializeCellsForTemplate(tpl: TemplateId) {
  const currentImages = cells.value.map(c => c.image).filter(Boolean) as string[]
  let requiredCount = 4
  const tplDef = TEMPLATES.find(t => t.id === tpl)
  if (tplDef) requiredCount = tplDef.gridCount

  if (tpl === 'freeform') {
    // If switching to freeform, migrate any existing photos onto canvas as freeform images
    if (cells.value.some(c => !!c.image) && freeformImages.value.length === 0) {
      cells.value.forEach((c, idx) => {
        if (c.image) {
          freeformImages.value.push({
            id: `free-${Date.now()}-${idx}`,
            image: c.image,
            x: 80 + (idx % 3) * 220,
            y: 80 + Math.floor(idx / 3) * 200,
            width: 220,
            height: 160,
            rotation: (idx % 2 === 0 ? -2 : 3) * (idx + 1),
            zIndex: idx + 1,
            caption: c.caption || '',
            polaroid: true,
          })
        }
      })
    }
    return
  }

  const newCells: PhotoCell[] = []
  for (let i = 0; i < requiredCount; i++) {
    const existing = cells.value[i]
    newCells.push({
      id: `cell-${i + 1}`,
      image: existing?.image || currentImages[i] || null,
      zoom: existing?.zoom || 1.0,
      panX: existing?.panX || 0,
      panY: existing?.panY || 0,
      rotation: existing?.rotation || 0,
      caption: existing?.caption || '',
      filter: existing?.filter || 'none',
    })
  }
  cells.value = newCells
}

function selectTemplate(tpl: TemplateId) {
  activeTemplate.value = tpl
  initializeCellsForTemplate(tpl)
}

function handleKeyDown(event: KeyboardEvent) {
  const tag = (event.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return

  const isCmdOrCtrl = event.metaKey || event.ctrlKey

  if (selectedFreeformId.value) {
    const item = freeformImages.value.find(i => i.id === selectedFreeformId.value)
    if (item) {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        removeFreeformImage(item.id)
      } else if (isCmdOrCtrl && (event.key === 'c' || event.key === 'C')) {
        event.preventDefault()
        copyFreeformImage(item)
      } else if (isCmdOrCtrl && (event.key === 'x' || event.key === 'X')) {
        event.preventDefault()
        cutFreeformImage(item)
      } else if (isCmdOrCtrl && (event.key === 'd' || event.key === 'D')) {
        event.preventDefault()
        duplicateFreeformImage(item)
      }
    }
  } else if (selectedCellId.value) {
    const cell = cells.value.find(c => c.id === selectedCellId.value)
    if (cell && cell.image) {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        removeCellPhoto(cell)
      } else if (isCmdOrCtrl && (event.key === 'c' || event.key === 'C')) {
        event.preventDefault()
        copyCellPhoto(cell)
      } else if (isCmdOrCtrl && (event.key === 'x' || event.key === 'X')) {
        event.preventDefault()
        cutCellPhoto(cell)
      } else if (isCmdOrCtrl && (event.key === 'd' || event.key === 'D')) {
        event.preventDefault()
        duplicateCellPhoto(cell)
      }
    }
  }

  if (isCmdOrCtrl && (event.key === 'v' || event.key === 'V')) {
    event.preventDefault()
    pasteImage()
  }
}

function handleNativePaste(event: ClipboardEvent) {
  const items = event.clipboardData?.items
  if (!items) return

  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      const blob = items[i].getAsFile()
      if (blob) {
        event.preventDefault()
        const reader = new FileReader()
        reader.onload = e => {
          const result = e.target?.result as string
          if (result) {
            internalImageClipboard.value = result
            pasteImage()
          }
        }
        reader.readAsDataURL(blob)
        return
      }
    }
  }
}

onMounted(() => {
  initializeCellsForTemplate(activeTemplate.value)
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('paste', handleNativePaste)
})

// ---- Image Upload & Management ---------------------------------------------

function triggerUploadForCell(cellId: string) {
  targetedCellForUpload.value = cellId
  if (hiddenFileInput.value) {
    hiddenFileInput.value.click()
  }
}

function triggerAddFreeformPhoto() {
  targetedCellForUpload.value = '__freeform__'
  if (hiddenFileInput.value) {
    hiddenFileInput.value.click()
  }
}

function handleFileSelected(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return

  const fileList = Array.from(files)

  if (targetedCellForUpload.value === '__freeform__') {
    fileList.forEach((file, idx) => {
      const reader = new FileReader()
      reader.onload = e => {
        const result = e.target?.result as string
        freeformImages.value.push({
          id: `free-${Date.now()}-${idx}`,
          image: result,
          x: 100 + (freeformImages.value.length % 3) * 60,
          y: 100 + (freeformImages.value.length % 3) * 50,
          width: 240,
          height: 180,
          rotation: Math.floor(Math.random() * 8) - 4,
          zIndex: freeformImages.value.length + 1,
          caption: '',
          polaroid: polaroidStyle.value,
        })
      }
      reader.readAsDataURL(file)
    })
    ui.showToast(`${fileList.length} photo(s) added to canvas`, 'success')
  } else if (targetedCellForUpload.value) {
    const cell = cells.value.find(c => c.id === targetedCellForUpload.value)
    if (cell && fileList[0]) {
      const reader = new FileReader()
      reader.onload = e => {
        cell.image = e.target?.result as string
        cell.zoom = 1.0
        cell.panX = 0
        cell.panY = 0
        cell.rotation = 0
      }
      reader.readAsDataURL(fileList[0])
      ui.showToast('Photo loaded into collage frame', 'success')
    }
  }

  // Reset input value so same file can be uploaded again if needed
  target.value = ''
  targetedCellForUpload.value = null
}

function handleDropOnCell(event: DragEvent, cell: PhotoCell) {
  event.preventDefault()
  if (!event.dataTransfer?.files || event.dataTransfer.files.length === 0) return
  const file = event.dataTransfer.files[0]
  if (!file.type.startsWith('image/')) {
    ui.showToast('Please drop an image file', 'error')
    return
  }
  const reader = new FileReader()
  reader.onload = e => {
    cell.image = e.target?.result as string
    cell.zoom = 1.0
    cell.panX = 0
    cell.panY = 0
    cell.rotation = 0
    ui.showToast('Photo dropped into frame', 'success')
  }
  reader.readAsDataURL(file)
}

function handleDropOnFreeform(event: DragEvent) {
  event.preventDefault()
  if (!event.dataTransfer?.files || event.dataTransfer.files.length === 0) return
  const files = Array.from(event.dataTransfer.files).filter(f => f.type.startsWith('image/'))
  files.forEach((file, idx) => {
    const reader = new FileReader()
    reader.onload = e => {
      freeformImages.value.push({
        id: `free-${Date.now()}-${idx}`,
        image: e.target?.result as string,
        x: Math.max(20, event.offsetX - 100),
        y: Math.max(20, event.offsetY - 80),
        width: 240,
        height: 180,
        rotation: Math.floor(Math.random() * 8) - 4,
        zIndex: freeformImages.value.length + 1,
        caption: '',
        polaroid: polaroidStyle.value,
      })
    }
    reader.readAsDataURL(file)
  })
  ui.showToast(`${files.length} photo(s) dropped onto scrapbook canvas`, 'success')
}

function removeCellPhoto(cell: PhotoCell) {
  cell.image = null
  cell.caption = ''
  cell.zoom = 1.0
  cell.panX = 0
  cell.panY = 0
}

function rotateCellPhoto(cell: PhotoCell) {
  cell.rotation = (cell.rotation + 90) % 360
}

const internalImageClipboard = ref<string | null>(null)

function removeFreeformImage(id: string) {
  freeformImages.value = freeformImages.value.filter(i => i.id !== id)
  if (selectedFreeformId.value === id) selectedFreeformId.value = null
  ui.showToast('Photo deleted', 'info')
}

async function copyFreeformImage(item: FreeformImageItem) {
  internalImageClipboard.value = item.image
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(item.image)
    }
  } catch {
    // fallback
  }
  ui.showToast('Photo copied! You can paste or press Ctrl+V', 'success')
}

function cutFreeformImage(item: FreeformImageItem) {
  copyFreeformImage(item)
  removeFreeformImage(item.id)
  ui.showToast('Photo cut to clipboard', 'info')
}

function duplicateFreeformImage(item: FreeformImageItem) {
  const maxZ = Math.max(0, ...freeformImages.value.map(i => i.zIndex))
  const dup: FreeformImageItem = {
    ...item,
    id: `free-${Date.now()}-dup`,
    x: item.x + 24,
    y: item.y + 24,
    zIndex: maxZ + 1,
  }
  freeformImages.value.push(dup)
  selectedFreeformId.value = dup.id
  ui.showToast('Photo duplicated on canvas', 'success')
}

function copyCellPhoto(cell: PhotoCell) {
  if (!cell.image) return
  internalImageClipboard.value = cell.image
  try {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(cell.image).catch(() => {})
    }
  } catch {
    // fallback
  }
  ui.showToast('Photo copied! You can paste or press Ctrl+V', 'success')
}

function cutCellPhoto(cell: PhotoCell) {
  if (!cell.image) return
  copyCellPhoto(cell)
  cell.image = null
  cell.caption = ''
  selectedCellId.value = null
  ui.showToast('Photo cut to clipboard', 'info')
}

function duplicateCellPhoto(cell: PhotoCell) {
  if (!cell.image) return
  const emptyCell = cells.value.find(c => !c.image)
  if (emptyCell) {
    emptyCell.image = cell.image
    emptyCell.filter = cell.filter
    emptyCell.caption = cell.caption
    emptyCell.zoom = cell.zoom
    emptyCell.rotation = cell.rotation
    ui.showToast('Photo duplicated to next open cell', 'success')
  } else {
    // Add to freeform so educator never loses the duplication intent
    const maxZ = Math.max(0, ...freeformImages.value.map(i => i.zIndex))
    const freeItem: FreeformImageItem = {
      id: `free-${Date.now()}`,
      image: cell.image,
      x: 60 + (freeformImages.value.length % 5) * 30,
      y: 60 + (freeformImages.value.length % 5) * 30,
      width: 240,
      height: 180,
      rotation: cell.rotation || 0,
      zIndex: maxZ + 1,
      caption: cell.caption || '',
      polaroid: polaroidStyle.value,
    }
    freeformImages.value.push(freeItem)
    activeTemplate.value = 'freeform'
    selectedFreeformId.value = freeItem.id
    ui.showToast('Cells filled: switched to Freeform Canvas with duplicated photo', 'info')
  }
}

function popCellToFreeform(cell: PhotoCell) {
  if (!cell.image) return
  const maxZ = Math.max(0, ...freeformImages.value.map(i => i.zIndex))
  const freeItem: FreeformImageItem = {
    id: `free-${Date.now()}`,
    image: cell.image,
    x: 80,
    y: 80,
    width: 260,
    height: 195,
    rotation: cell.rotation || 0,
    zIndex: maxZ + 1,
    caption: cell.caption || '',
    polaroid: polaroidStyle.value,
  }
  freeformImages.value.push(freeItem)
  cell.image = null
  cell.caption = ''
  activeTemplate.value = 'freeform'
  selectedFreeformId.value = freeItem.id
  ui.showToast('Photo moved to Freeform Canvas! You can freely resize length & width', 'success')
}

function pasteImage() {
  if (!internalImageClipboard.value) {
    ui.showToast('Clipboard is empty! Copy or Cut a photo first', 'info')
    return
  }
  if (activeTemplate.value === 'freeform') {
    const maxZ = Math.max(0, ...freeformImages.value.map(i => i.zIndex))
    const newItem: FreeformImageItem = {
      id: `free-${Date.now()}-paste`,
      image: internalImageClipboard.value,
      x: 100 + (freeformImages.value.length % 4) * 25,
      y: 100 + (freeformImages.value.length % 4) * 25,
      width: 240,
      height: 180,
      rotation: 0,
      zIndex: maxZ + 1,
      caption: '',
      polaroid: polaroidStyle.value,
    }
    freeformImages.value.push(newItem)
    selectedFreeformId.value = newItem.id
    ui.showToast('Photo pasted onto canvas', 'success')
  } else {
    const targetCell = (selectedCellId.value && cells.value.find(c => c.id === selectedCellId.value)) || cells.value.find(c => !c.image)
    if (targetCell) {
      targetCell.image = internalImageClipboard.value
      ui.showToast('Photo pasted into cell', 'success')
    } else {
      ui.showToast('All cells filled! Switch to Freeform to paste more photos', 'info')
    }
  }
}

function duplicateTextItem(item: CanvasTextItem) {
  const dup: CanvasTextItem = {
    ...item,
    id: `text-${Date.now()}-dup`,
    x: Math.min(85, item.x + 4),
    y: Math.min(85, item.y + 4),
  }
  textItems.value.push(dup)
  selectedTextId.value = dup.id
  ui.showToast('Text block duplicated', 'success')
}

async function copyTextItem(item: CanvasTextItem) {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(item.text)
    }
  } catch {
    // fallback
  }
  ui.showToast('Text copied to clipboard', 'success')
}

function bringToFront(item: FreeformImageItem) {
  const maxZ = Math.max(0, ...freeformImages.value.map(i => i.zIndex))
  item.zIndex = maxZ + 1
}

function sendToBack(item: FreeformImageItem) {
  const minZ = Math.min(...freeformImages.value.map(i => i.zIndex))
  item.zIndex = minZ - 1
}

// ---- Pan & Zoom Gestures (Mouse & Touch) ------------------------------------

let activePanTarget: PhotoCell | null = null
let panStartX = 0
let panStartY = 0
let initialPanX = 0
let initialPanY = 0

// Pinch Zoom Tracking
let touchStartDistance = 0
let touchStartZoom = 1.0

function startPan(event: MouseEvent | TouchEvent, cell: PhotoCell) {
  if (!cell.image) return
  selectedCellId.value = cell.id
  activePanTarget = cell

  if (window.TouchEvent && event instanceof TouchEvent) {
    if (event.touches.length === 1) {
      panStartX = event.touches[0].clientX
      panStartY = event.touches[0].clientY
      initialPanX = cell.panX
      initialPanY = cell.panY
    } else if (event.touches.length === 2) {
      // 2-finger pinch
      const dx = event.touches[0].clientX - event.touches[1].clientX
      const dy = event.touches[0].clientY - event.touches[1].clientY
      touchStartDistance = Math.hypot(dx, dy)
      touchStartZoom = cell.zoom
    }
  } else if (event instanceof MouseEvent) {
    panStartX = event.clientX
    panStartY = event.clientY
    initialPanX = cell.panX
    initialPanY = cell.panY
    window.addEventListener('mousemove', onPanMove)
    window.addEventListener('mouseup', stopPan)
  }
}

function onTouchMove(event: TouchEvent) {
  if (!activePanTarget) return
  if (event.touches.length === 1) {
    const dx = event.touches[0].clientX - panStartX
    const dy = event.touches[0].clientY - panStartY
    // Map pixel delta to percentage
    activePanTarget.panX = Math.max(-50, Math.min(50, initialPanX + dx * 0.25))
    activePanTarget.panY = Math.max(-50, Math.min(50, initialPanY + dy * 0.25))
  } else if (event.touches.length === 2) {
    const dx = event.touches[0].clientX - event.touches[1].clientX
    const dy = event.touches[0].clientY - event.touches[1].clientY
    const dist = Math.hypot(dx, dy)
    if (touchStartDistance > 0) {
      const scaleFactor = dist / touchStartDistance
      activePanTarget.zoom = Math.max(1.0, Math.min(3.0, touchStartZoom * scaleFactor))
    }
  }
}

function onPanMove(event: MouseEvent) {
  if (!activePanTarget) return
  const dx = event.clientX - panStartX
  const dy = event.clientY - panStartY
  activePanTarget.panX = Math.max(-50, Math.min(50, initialPanX + dx * 0.25))
  activePanTarget.panY = Math.max(-50, Math.min(50, initialPanY + dy * 0.25))
}

function stopPan() {
  activePanTarget = null
  touchStartDistance = 0
  window.removeEventListener('mousemove', onPanMove)
  window.removeEventListener('mouseup', stopPan)
}

// Wheel zoom over cell
function handleCellWheel(event: WheelEvent, cell: PhotoCell) {
  if (!cell.image) return
  event.preventDefault()
  const delta = event.deltaY < 0 ? 0.1 : -0.1
  cell.zoom = Math.max(1.0, Math.min(3.0, Number((cell.zoom + delta).toFixed(2))))
}

// ---- Freeform Drag & Resize (Mouse & Touch) --------------------------------

let activeFreeformDrag: FreeformImageItem | null = null
let freeformStartX = 0
let freeformStartY = 0
let freeformOrigX = 0
let freeformOrigY = 0

function onItemMouseDown(event: MouseEvent, item: FreeformImageItem) {
  const target = event.target as HTMLElement
  if (target.closest('.ff-toolbar') || target.closest('.resize-handle') || target.closest('.resize-edge') || target.closest('input')) {
    return
  }
  selectedFreeformId.value = item.id
  activeFreeformDrag = item
  const maxZ = Math.max(0, ...freeformImages.value.map(i => i.zIndex))
  item.zIndex = maxZ + 1

  freeformStartX = event.clientX
  freeformStartY = event.clientY
  freeformOrigX = item.x
  freeformOrigY = item.y

  window.addEventListener('mousemove', onFreeformMouseMove)
  window.addEventListener('mouseup', stopFreeformDrag)
}

function onItemTouchStart(event: TouchEvent, item: FreeformImageItem) {
  const target = event.target as HTMLElement
  if (target.closest('.ff-toolbar') || target.closest('.resize-handle') || target.closest('.resize-edge') || target.closest('input')) {
    return
  }
  selectedFreeformId.value = item.id
  activeFreeformDrag = item
  const maxZ = Math.max(0, ...freeformImages.value.map(i => i.zIndex))
  item.zIndex = maxZ + 1

  const touch = event.touches[0]
  freeformStartX = touch.clientX
  freeformStartY = touch.clientY
  freeformOrigX = item.x
  freeformOrigY = item.y

  window.addEventListener('touchmove', onFreeformTouchMove, { passive: false })
  window.addEventListener('touchend', stopFreeformDrag)
  window.addEventListener('touchcancel', stopFreeformDrag)
}

function onFreeformMouseMove(event: MouseEvent) {
  if (!activeFreeformDrag) return
  const dx = event.clientX - freeformStartX
  const dy = event.clientY - freeformStartY
  activeFreeformDrag.x = freeformOrigX + dx
  activeFreeformDrag.y = freeformOrigY + dy
}

function onFreeformTouchMove(event: TouchEvent) {
  if (!activeFreeformDrag) return
  if (event.cancelable) event.preventDefault()
  const touch = event.touches[0]
  const dx = touch.clientX - freeformStartX
  const dy = touch.clientY - freeformStartY
  activeFreeformDrag.x = freeformOrigX + dx
  activeFreeformDrag.y = freeformOrigY + dy
}

function stopFreeformDrag() {
  activeFreeformDrag = null
  window.removeEventListener('mousemove', onFreeformMouseMove)
  window.removeEventListener('mouseup', stopFreeformDrag)
  window.removeEventListener('touchmove', onFreeformTouchMove)
  window.removeEventListener('touchend', stopFreeformDrag)
  window.removeEventListener('touchcancel', stopFreeformDrag)
}

function rotateFreeform(item: FreeformImageItem, delta: number) {
  item.rotation = (item.rotation + delta) % 360
}


// ---- Border & Handle Resize (Length & Width Controls) ----------------------

let resizingItem: FreeformImageItem | null = null
let resizeHandle = '' // 'n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'
let resizeStartX = 0
let resizeStartY = 0
let resizeOrigW = 0
let resizeOrigH = 0
let resizeOrigX = 0
let resizeOrigY = 0

function startResize(event: MouseEvent | TouchEvent, item: FreeformImageItem, handle: string) {
  event.preventDefault()
  event.stopPropagation()
  resizingItem = item
  resizeHandle = handle

  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY
  resizeStartX = clientX
  resizeStartY = clientY
  resizeOrigW = item.width
  resizeOrigH = item.height
  resizeOrigX = item.x
  resizeOrigY = item.y

  if ('touches' in event) {
    window.addEventListener('touchmove', onResizeMove, { passive: false })
    window.addEventListener('touchend', stopResize)
    window.addEventListener('touchcancel', stopResize)
  } else {
    window.addEventListener('mousemove', onResizeMove)
    window.addEventListener('mouseup', stopResize)
  }
}

function onResizeMove(event: MouseEvent | TouchEvent) {
  if (!resizingItem) return
  if (event.cancelable) event.preventDefault()

  const clientX = 'touches' in event ? (event as TouchEvent).touches[0].clientX : (event as MouseEvent).clientX
  const clientY = 'touches' in event ? (event as TouchEvent).touches[0].clientY : (event as MouseEvent).clientY
  const rawDx = clientX - resizeStartX
  const rawDy = clientY - resizeStartY

  // Transform raw screen delta according to item's rotation
  let dx = rawDx
  let dy = rawDy
  if (resizingItem.rotation) {
    const rad = (-resizingItem.rotation * Math.PI) / 180
    dx = rawDx * Math.cos(rad) - rawDy * Math.sin(rad)
    dy = rawDx * Math.sin(rad) + rawDy * Math.cos(rad)
  }

  const minW = 60
  const minH = 50

  // Adjust width and/or length (height) based on handle pulled
  switch (resizeHandle) {
    case 'e': {
      resizingItem.width = Math.max(minW, resizeOrigW + dx)
      break
    }
    case 'w': {
      const newW = Math.max(minW, resizeOrigW - dx)
      resizingItem.width = newW
      resizingItem.x = resizeOrigX + (resizeOrigW - newW)
      break
    }
    case 's': {
      resizingItem.height = Math.max(minH, resizeOrigH + dy)
      break
    }
    case 'n': {
      const newH = Math.max(minH, resizeOrigH - dy)
      resizingItem.height = newH
      resizingItem.y = resizeOrigY + (resizeOrigH - newH)
      break
    }
    case 'se': {
      resizingItem.width = Math.max(minW, resizeOrigW + dx)
      resizingItem.height = Math.max(minH, resizeOrigH + dy)
      break
    }
    case 'sw': {
      const newW = Math.max(minW, resizeOrigW - dx)
      resizingItem.width = newW
      resizingItem.x = resizeOrigX + (resizeOrigW - newW)
      resizingItem.height = Math.max(minH, resizeOrigH + dy)
      break
    }
    case 'ne': {
      resizingItem.width = Math.max(minW, resizeOrigW + dx)
      const newH = Math.max(minH, resizeOrigH - dy)
      resizingItem.height = newH
      resizingItem.y = resizeOrigY + (resizeOrigH - newH)
      break
    }
    case 'nw': {
      const newW = Math.max(minW, resizeOrigW - dx)
      const newH = Math.max(minH, resizeOrigH - dy)
      resizingItem.width = newW
      resizingItem.x = resizeOrigX + (resizeOrigW - newW)
      resizingItem.height = newH
      resizingItem.y = resizeOrigY + (resizeOrigH - newH)
      break
    }
  }
}

function stopResize() {
  resizingItem = null
  resizeHandle = ''
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', stopResize)
  window.removeEventListener('touchmove', onResizeMove)
  window.removeEventListener('touchend', stopResize)
  window.removeEventListener('touchcancel', stopResize)
}

// ---- Text & Annotation Management ------------------------------------------

function addTextItem(type: 'title' | 'quote' | 'note' | 'stamp') {
  const roomName = auth.roomName || 'Classroom Room'
  const dateStr = new Date().toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })

  let defaultText = 'Click to edit inquiry text'
  let fontSize = 16
  let bgColor: CanvasTextItem['bgColor'] = 'dark-glass'

  if (type === 'title') {
    defaultText = '🌱 Inquiry: Investigating Balance & Natural Structures'
    fontSize = 22
    bgColor = 'dark-glass'
  } else if (type === 'quote') {
    defaultText = '💬 "Look! If we put the big log at the bottom, the bridge doesn\'t shake!" — Leo (4.2y)'
    fontSize = 15
    bgColor = 'frosted'
  } else if (type === 'note') {
    defaultText = '📝 Children demonstrated problem-solving schemas and deep collaborative dialogue.'
    fontSize = 13
    bgColor = 'frosted'
  } else if (type === 'stamp') {
    defaultText = `📍 ${roomName} · ${dateStr}`
    fontSize = 12
    bgColor = 'emerald'
  }

  const newItem: CanvasTextItem = {
    id: `text-${Date.now()}`,
    text: defaultText,
    type,
    x: 10 + Math.random() * 20,
    y: 10 + Math.random() * 20,
    fontSize,
    fontFamily: type === 'quote' ? 'sketch' : 'sans',
    color: bgColor === 'frosted' ? '#0f172a' : '#ffffff',
    bgColor,
  }

  textItems.value.push(newItem)
  selectedTextId.value = newItem.id
  ui.showToast('Text block added to canvas', 'success')
}

function removeTextItem(id: string) {
  textItems.value = textItems.value.filter(t => t.id !== id)
  if (selectedTextId.value === id) selectedTextId.value = null
}

// Draggable text block
let activeTextDrag: CanvasTextItem | null = null
let textDragStartX = 0
let textDragStartY = 0
let textDragOrigX = 0
let textDragOrigY = 0

function startTextDrag(event: MouseEvent | TouchEvent, item: CanvasTextItem) {
  selectedTextId.value = item.id
  activeTextDrag = item

  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY
  textDragStartX = clientX
  textDragStartY = clientY
  textDragOrigX = item.x
  textDragOrigY = item.y

  if ('touches' in event) {
    window.addEventListener('touchmove', onTextTouchMove, { passive: false })
    window.addEventListener('touchend', stopTextDrag)
  } else {
    window.addEventListener('mousemove', onTextMouseMove)
    window.addEventListener('mouseup', stopTextDrag)
  }
}

function onTextMouseMove(event: MouseEvent) {
  if (!activeTextDrag) return
  const dx = event.clientX - textDragStartX
  const dy = event.clientY - textDragStartY
  // Convert delta to percent of canvas (roughly 900x636)
  activeTextDrag.x = Math.max(0, Math.min(85, textDragOrigX + (dx / 9)))
  activeTextDrag.y = Math.max(0, Math.min(85, textDragOrigY + (dy / 6.36)))
}

function onTextTouchMove(event: TouchEvent) {
  if (!activeTextDrag) return
  event.preventDefault()
  const dx = event.touches[0].clientX - textDragStartX
  const dy = event.touches[0].clientY - textDragStartY
  activeTextDrag.x = Math.max(0, Math.min(85, textDragOrigX + (dx / 9)))
  activeTextDrag.y = Math.max(0, Math.min(85, textDragOrigY + (dy / 6.36)))
}

function stopTextDrag() {
  activeTextDrag = null
  window.removeEventListener('mousemove', onTextMouseMove)
  window.removeEventListener('mouseup', stopTextDrag)
  window.removeEventListener('touchmove', onTextTouchMove)
  window.removeEventListener('touchend', stopTextDrag)
}

// ---- Stickers & Badges -----------------------------------------------------

function addSticker(preset: (typeof PRESET_STICKERS)[0]) {
  const newSticker: CanvasStickerItem = {
    id: `sticker-${Date.now()}`,
    label: preset.label,
    icon: preset.icon,
    category: preset.category as any,
    colorClass: preset.colorClass,
    x: 15 + Math.random() * 50,
    y: 15 + Math.random() * 50,
  }
  stickerItems.value.push(newSticker)
  ui.showToast(`Added ${preset.icon} badge`, 'success')
}

function removeSticker(id: string) {
  stickerItems.value = stickerItems.value.filter(s => s.id !== id)
}

// ---- Zero-Data Memory Purge ------------------------------------------------

function purgeAllMemory() {
  if (confirm('🧹 Clean In-Memory Canvas?\n\nThis will remove all loaded photos, captions, and text from local memory. Remember: photos are never stored in the database, so this cannot be undone.')) {
    cells.value.forEach(c => {
      c.image = null
      c.caption = ''
      c.zoom = 1.0
      c.panX = 0
      c.panY = 0
    })
    freeformImages.value = []
    textItems.value = []
    stickerItems.value = []
    selectedCellId.value = null
    selectedTextId.value = null
    selectedFreeformId.value = null
    ui.showToast('All in-memory photos wiped clean. 0 bytes retained.', 'info')
  }
}

// Cleanup on unmount (when educator closes or leaves the page)
onBeforeUnmount(() => {
  cells.value.forEach(c => (c.image = null))
  freeformImages.value = []
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('paste', handleNativePaste)
})

// ---- High-Resolution Export Renderer ---------------------------------------

async function renderCanvasToBlob(format: 'image/png' | 'image/jpeg' = 'image/png'): Promise<Blob | null> {
  const container = document.getElementById('collage-export-artboard')
  if (!container) return null

  // Use native HTML5 Offscreen Canvas / high-DPI canvas capture
  // We can render the artboard DOM directly via HTML5 Canvas or html2canvas
  try {
    const { default: html2canvas } = await import('html2canvas')
    const canvas = await html2canvas(container, {
      scale: 2, // 2x Retina resolution
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      logging: false,
    })
    return new Promise(resolve => {
      canvas.toBlob(blob => resolve(blob), format, 0.95)
    })
  } catch (err) {
    console.error('Canvas render error:', err)
    ui.showToast('Could not render image: ' + (err as Error).message, 'error')
    return null
  }
}

async function downloadCollage(format: 'png' | 'jpg') {
  exportLoading.value = true
  try {
    const mime = format === 'png' ? 'image/png' : 'image/jpeg'
    const blob = await renderCanvasToBlob(mime)
    if (!blob) throw new Error('Render failed')

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inquiry-collage-${Date.now()}.${format}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)

    ui.showToast(`✅ Collage saved & downloaded as High-Res ${format.toUpperCase()}!`, 'success')
  } catch (err) {
    ui.showToast('Download failed: ' + (err as Error).message, 'error')
  } finally {
    exportLoading.value = false
  }
}

async function copyToClipboard() {
  exportLoading.value = true
  try {
    const blob = await renderCanvasToBlob('image/png')
    if (!blob) throw new Error('Render failed')

    if (navigator.clipboard && navigator.clipboard.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob,
        }),
      ])
      ui.showToast('Collage copied to clipboard! Paste anywhere (Word, Mail, WhatsApp)', 'success')
    } else {
      throw new Error('Clipboard image copy is not supported in this browser')
    }
  } catch (err) {
    ui.showToast('Clipboard notice: ' + (err as Error).message, 'info')
  } finally {
    exportLoading.value = false
  }
}

async function transferToLearningStory() {
  exportLoading.value = true
  try {
    const blob = await renderCanvasToBlob('image/jpeg')
    if (!blob) throw new Error('Failed to generate collage image')

    const reader = new FileReader()
    reader.onload = e => {
      const dataUrl = e.target?.result as string
      // Save temporarily in sessionStorage for immediate pick-up by LearningStoriesView
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem('hadfield:v1:pending_collage_photo', dataUrl)
      }
      ui.showToast('Collage attached! Redirecting to Learning Stories Studio…', 'success')
      void router.push({ path: '/learning-stories', query: { fromCollage: 'true' } })
    }
    reader.readAsDataURL(blob)
  } catch (err) {
    ui.showToast('Transfer notice: ' + (err as Error).message, 'error')
  } finally {
    exportLoading.value = false
  }
}

function printCollage() {
  window.print()
}
</script>

<template>
  <div class="collage-studio">
    <!-- Hidden File Input for Image Selection -->
    <input
      ref="hiddenFileInput"
      type="file"
      accept="image/*"
      multiple
      class="hidden"
      @change="handleFileSelected"
    />

    <!-- ======================== TOP HEADER BAR ======================== -->
    <header class="studio-header">
      <div class="studio-header__left">
        <div class="studio-header__icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
        <div>
          <h1 class="studio-header__title">Collage Studio</h1>
          <p class="studio-header__sub">Photo collages &amp; pedagogical documentation panels</p>
        </div>
      </div>

      <div class="studio-header__actions">
        <!-- Privacy Chip -->
        <div class="privacy-chip">
          <span class="privacy-chip__dot"></span>
          <span>{{ inMemoryPhotoCount }} in memory</span>
          <span class="privacy-chip__separator">·</span>
          <span>Zero cloud storage</span>
        </div>

        <div class="studio-header__btns">
          <button
            type="button"
            class="action-btn action-btn--ghost"
            title="Clear all in-memory photos"
            @click="purgeAllMemory"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            <span class="action-btn__label">Clear</span>
          </button>

          <button
            type="button"
            class="action-btn action-btn--ghost"
            :disabled="inMemoryPhotoCount === 0 || exportLoading"
            @click="copyToClipboard"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <span class="action-btn__label">Copy</span>
          </button>

          <button
            type="button"
            class="action-btn action-btn--ghost"
            :disabled="inMemoryPhotoCount === 0 || exportLoading"
            title="Save collage to device (PNG)"
            @click="downloadCollage('png')"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            <span class="action-btn__label">Save Image</span>
          </button>

          <button
            type="button"
            class="action-btn action-btn--ghost"
            :disabled="inMemoryPhotoCount === 0 || exportLoading"
            @click="printCollage"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            <span class="action-btn__label">Print</span>
          </button>

          <button
            type="button"
            class="action-btn action-btn--primary"
            :disabled="inMemoryPhotoCount === 0 || exportLoading"
            @click="transferToLearningStory"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            <span>Send to Story</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        </div>
      </div>
    </header>

    <!-- ======================== MAIN WORKSPACE ======================== -->
    <div class="workspace" :class="{ 'workspace--collapsed': sidebarCollapsed }">

      <!-- ============ LEFT SIDEBAR ============ -->
      <aside class="sidebar" :class="{ 'sidebar--collapsed': sidebarCollapsed }">
        <!-- Collapse Toggle -->
        <button
          type="button"
          class="sidebar__toggle"
          :title="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          @click="sidebarCollapsed = !sidebarCollapsed"
        >
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round"
            :style="{ transform: sidebarCollapsed ? 'rotate(180deg)' : 'none' }"
          >
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        <div v-show="!sidebarCollapsed" class="sidebar__content">
          <!-- Panel Tabs -->
          <nav class="panel-tabs">
            <button
              type="button"
              class="panel-tab"
              :class="{ 'panel-tab--active': activePanel === 'templates' }"
              @click="activePanel = 'templates'"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              <span>Layout</span>
            </button>
            <button
              type="button"
              class="panel-tab"
              :class="{ 'panel-tab--active': activePanel === 'style' }"
              @click="activePanel = 'style'"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="2.5"/><path d="M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z"/></svg>
              <span>Style</span>
            </button>
            <button
              type="button"
              class="panel-tab"
              :class="{ 'panel-tab--active': activePanel === 'text' }"
              @click="activePanel = 'text'"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
              <span>Text</span>
            </button>
            <button
              type="button"
              class="panel-tab"
              :class="{ 'panel-tab--active': activePanel === 'stickers' }"
              @click="activePanel = 'stickers'"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              <span>EYLF</span>
            </button>
          </nav>

          <!-- ======== TEMPLATES PANEL ======== -->
          <div v-if="activePanel === 'templates'" class="panel-body">
            <div class="panel-section-label">
              <span>Collage Templates</span>
              <span class="panel-section-badge">{{ activeTemplate === 'freeform' ? 'Freeform' : `${cells.length} cells` }}</span>
            </div>

            <div class="template-grid">
              <button
                v-for="tpl in TEMPLATES"
                :key="tpl.id"
                type="button"
                class="template-card"
                :class="{ 'template-card--active': activeTemplate === tpl.id }"
                @click="selectTemplate(tpl.id)"
              >
                <span class="template-card__icon">{{ tpl.icon }}</span>
                <span class="template-card__name">{{ tpl.name }}</span>
              </button>
            </div>

            <!-- Freeform Add Photo Button -->
            <div v-if="activeTemplate === 'freeform'" class="freeform-cta">
              <button
                type="button"
                class="action-btn action-btn--primary action-btn--full"
                @click="triggerAddFreeformPhoto"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                <span>Add Photos to Canvas</span>
              </button>
            </div>
          </div>

          <!-- ======== STYLE PANEL ======== -->
          <div v-if="activePanel === 'style'" class="panel-body">
            <!-- Aspect Ratio -->
            <div class="panel-section-label"><span>Format / Aspect Ratio</span></div>
            <div class="format-grid">
              <button
                type="button"
                class="format-btn"
                :class="{ 'format-btn--active': aspectRatio === 'a4-landscape' }"
                @click="aspectRatio = 'a4-landscape'"
              >A4 Landscape</button>
              <button
                type="button"
                class="format-btn"
                :class="{ 'format-btn--active': aspectRatio === 'a4-portrait' }"
                @click="aspectRatio = 'a4-portrait'"
              >A4 Portrait</button>
              <button
                type="button"
                class="format-btn"
                :class="{ 'format-btn--active': aspectRatio === 'square' }"
                @click="aspectRatio = 'square'"
              >Square 1:1</button>
              <button
                type="button"
                class="format-btn"
                :class="{ 'format-btn--active': aspectRatio === 'wide' }"
                @click="aspectRatio = 'wide'"
              >Wide 16:9</button>
            </div>

            <!-- Paper Theme -->
            <div class="panel-section-label" style="margin-top: 16px"><span>Paper Texture</span></div>
            <div class="theme-picker">
              <button
                v-for="theme in [
                  { id: 'linen', label: 'Linen', bg: '#F9F7F2', ring: '#C4B99A' },
                  { id: 'white', label: 'White', bg: '#FFFFFF', ring: '#CBD5E1' },
                  { id: 'sage', label: 'Sage', bg: '#F0FDF4', ring: '#6EE7B7' },
                  { id: 'ochre', label: 'Ochre', bg: '#FEFCE8', ring: '#FDE68A' },
                  { id: 'dark', label: 'Dark', bg: '#0F172A', ring: '#475569' },
                ]" :key="theme.id"
                type="button"
                class="theme-swatch"
                :class="{ 'theme-swatch--active': canvasTheme === theme.id }"
                :style="{ backgroundColor: theme.bg, '--ring-color': theme.ring }"
                :title="theme.label"
                @click="canvasTheme = theme.id as CanvasTheme"
              >
                <span v-if="canvasTheme === theme.id" class="theme-swatch__check" :style="{ color: theme.id === 'dark' ? '#fff' : '#0F172A' }">✓</span>
              </button>
            </div>

            <!-- Spacing -->
            <div class="panel-section-label" style="margin-top: 16px"><span>Spacing & Corners</span></div>
            <div class="slider-row">
              <label>Gap</label>
              <input v-model.number="gapSize" type="range" min="0" max="24" step="2" />
              <span class="slider-val">{{ gapSize }}px</span>
            </div>
            <div class="slider-row">
              <label>Radius</label>
              <input v-model.number="cornerRadius" type="range" min="0" max="24" step="2" />
              <span class="slider-val">{{ cornerRadius }}px</span>
            </div>

            <!-- Polaroid -->
            <label class="toggle-row">
              <span>Polaroid Frames</span>
              <input v-model="polaroidStyle" type="checkbox" class="toggle-check" />
            </label>
          </div>

          <!-- ======== TEXT PANEL ======== -->
          <div v-if="activePanel === 'text'" class="panel-body">
            <div class="panel-section-label"><span>Add Pedagogical Text</span></div>
            <div class="text-btn-grid">
              <button type="button" class="text-add-btn" @click="addTextItem('title')">
                <span class="text-add-btn__icon">🌱</span>
                <span>Inquiry Title</span>
              </button>
              <button type="button" class="text-add-btn" @click="addTextItem('quote')">
                <span class="text-add-btn__icon">💬</span>
                <span>Child Quote</span>
              </button>
              <button type="button" class="text-add-btn" @click="addTextItem('note')">
                <span class="text-add-btn__icon">📝</span>
                <span>Observation</span>
              </button>
              <button type="button" class="text-add-btn" @click="addTextItem('stamp')">
                <span class="text-add-btn__icon">📍</span>
                <span>Room &amp; Date</span>
              </button>
            </div>
            <p class="panel-hint">Drag text blocks to reposition on canvas.</p>
          </div>

          <!-- ======== STICKERS PANEL ======== -->
          <div v-if="activePanel === 'stickers'" class="panel-body">
            <div class="panel-section-label"><span>EYLF & Reggio Badges</span></div>
            <div class="sticker-list">
              <button
                v-for="stk in PRESET_STICKERS"
                :key="stk.label"
                type="button"
                class="sticker-btn"
                :class="stk.colorClass"
                @click="addSticker(stk)"
              >
                <span>{{ stk.icon }}</span>
                <span>{{ stk.label }}</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      <!-- ============ MAIN CANVAS AREA ============ -->
      <main class="canvas-area">
        <!-- Canvas Toolbar -->
        <div class="canvas-toolbar">
          <div class="canvas-toolbar__left">
            <span class="canvas-toolbar__badge">PLAYGROUND</span>
            <span class="canvas-toolbar__ratio">{{ canvasDimensions.ratioLabel }}</span>

            <!-- Template Quick Switcher -->
            <div class="canvas-mode-toggle">
              <button
                type="button"
                class="mode-toggle__btn"
                :class="{ 'mode-toggle__btn--active': activeTemplate === 'freeform' }"
                title="Freeform canvas with unrestricted resize & drag"
                @click="selectTemplate('freeform')"
              >
                <span>🎨 Freeform Canvas</span>
              </button>
              <button
                type="button"
                class="mode-toggle__btn"
                :class="{ 'mode-toggle__btn--active': activeTemplate !== 'freeform' }"
                title="Structured grid templates"
                @click="activeTemplate === 'freeform' ? selectTemplate('grid-4-quad') : null"
              >
                <span>▦ Grid Layouts</span>
              </button>
            </div>
          </div>

          <!-- Canvas Zoom/Scale Controls -->
          <div class="canvas-toolbar__center">
            <div class="canvas-zoom-control">
              <button type="button" class="zoom-btn" title="Make canvas playground smaller" @click="zoomOutCanvas">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
              <span class="zoom-value">{{ Math.round(canvasScale * 100) }}%</span>
              <button type="button" class="zoom-btn" title="Make canvas playground bigger" @click="zoomInCanvas">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
              <button type="button" class="zoom-reset-btn" title="Fit comfortably at 85%" @click="resetCanvasZoom(0.85)">
                Fit 85%
              </button>
              <button type="button" class="zoom-reset-btn" title="Reset scale to 100%" @click="resetCanvasZoom(1.0)">
                100%
              </button>
            </div>
          </div>

          <div class="canvas-toolbar__hints">
            <button
              v-if="internalImageClipboard"
              type="button"
              class="canvas-paste-btn"
              title="Paste copied photo onto canvas"
              @click="pasteImage"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
              <span>Paste Photo</span>
            </button>
            <span>👆 Tap photo for Copy/Cut/Duplicate &amp; Resize</span>
          </div>
        </div>

        <!-- The Printable / Exportable Canvas Container -->
        <div class="canvas-scroll-wrap">
          <div
            class="artboard-scale-container"
            :style="{
              width: `${Math.round(canvasDimensions.width * canvasScale)}px`,
              height: `${Math.round(canvasDimensions.height * canvasScale)}px`,
            }"
          >
            <div
              id="collage-export-artboard"
              class="artboard"
              :class="[themeClasses]"
              :style="{
                width: `${canvasDimensions.width}px`,
                height: `${canvasDimensions.height}px`,
                minHeight: `${canvasDimensions.height}px`,
                padding: `${paddingSize}px`,
                transform: `scale(${canvasScale})`,
                transformOrigin: 'top left',
              }"
              @dragover.prevent
              @drop="activeTemplate === 'freeform' ? handleDropOnFreeform($event) : null"
              @touchmove="onTouchMove"
              @touchend="stopPan"
            >
              <!-- ================= TEMPLATE GRID RENDER ================= -->
              <div
                v-if="activeTemplate !== 'freeform'"
                class="w-full h-full"
                :style="{
                  minHeight: `${canvasDimensions.height - paddingSize * 2}px`,
                  gap: `${gapSize}px`,
                }"
              :class="[
                activeTemplate === 'grid-4-quad' ? 'grid grid-cols-2 grid-rows-2 h-full' : '',
                activeTemplate === 'grid-4-hero' ? 'grid grid-cols-12 grid-rows-3 h-full' : '',
                activeTemplate === 'grid-5-showcase' ? 'grid grid-cols-12 grid-rows-12 h-full' : '',
                activeTemplate === 'grid-5-split' ? 'grid grid-cols-6 grid-rows-2 h-full' : '',
                activeTemplate === 'grid-6-equal' ? 'grid grid-cols-3 grid-rows-2 h-full' : '',
                activeTemplate === 'grid-6-magazine' ? 'grid grid-cols-4 grid-rows-3 h-full' : '',
                activeTemplate === 'grid-8-floorbook' ? 'grid grid-cols-4 grid-rows-2 h-full' : '',
              ]"
            >
              <div
                v-for="(cell, index) in cells"
                :key="cell.id"
                class="cell"
                :class="[
                  polaroidStyle ? 'cell--polaroid' : 'cell--default',
                  selectedCellId === cell.id ? 'cell--selected' : '',
                  // Template cell spans:
                  activeTemplate === 'grid-4-hero' && index === 0 ? 'col-span-7 row-span-3 min-h-[500px]' : '',
                  activeTemplate === 'grid-4-hero' && index > 0 ? 'col-span-5 row-span-1 min-h-[160px]' : '',
                  activeTemplate === 'grid-5-showcase' && index === 0 ? 'col-span-6 col-start-4 row-span-8 row-start-3 z-10 shadow-xl' : '',
                  activeTemplate === 'grid-5-showcase' && index === 1 ? 'col-span-4 row-span-4 col-start-1 row-start-1' : '',
                  activeTemplate === 'grid-5-showcase' && index === 2 ? 'col-span-4 row-span-4 col-start-9 row-start-1' : '',
                  activeTemplate === 'grid-5-showcase' && index === 3 ? 'col-span-4 row-span-4 col-start-1 row-start-9' : '',
                  activeTemplate === 'grid-5-showcase' && index === 4 ? 'col-span-4 row-span-4 col-start-9 row-start-9' : '',
                  activeTemplate === 'grid-5-split' && index < 2 ? 'col-span-3 min-h-[260px]' : '',
                  activeTemplate === 'grid-5-split' && index >= 2 ? 'col-span-2 min-h-[220px]' : '',
                  activeTemplate === 'grid-6-magazine' && index < 2 ? 'col-span-2 row-span-2 min-h-[300px]' : '',
                  activeTemplate === 'grid-6-magazine' && index >= 2 ? 'col-span-1 row-span-1 min-h-[180px]' : '',
                ]"
                :style="{ borderRadius: `${cornerRadius}px` }"
                @click="selectedCellId = cell.id"
                @dragover.prevent
                @drop="handleDropOnCell($event, cell)"
                @wheel="handleCellWheel($event, cell)"
              >
                <!-- When cell has image -->
                <template v-if="cell.image">
                  <div
                    class="cell__image-wrap"
                    @mousedown="startPan($event, cell)"
                    @touchstart="startPan($event, cell)"
                  >
                    <img
                      :src="cell.image"
                      alt="Inquiry Photo"
                      class="cell__img"
                      :style="{
                        transform: `scale(${cell.zoom}) translate(${cell.panX}%, ${cell.panY}%) rotate(${cell.rotation}deg)`,
                        filter:
                          cell.filter === 'warm'
                            ? 'sepia(0.2) saturate(1.2)'
                            : cell.filter === 'vivid'
                              ? 'saturate(1.4) contrast(1.05)'
                              : cell.filter === 'bw'
                                ? 'grayscale(1) contrast(1.1)'
                                : cell.filter === 'soft'
                                  ? 'brightness(1.05) contrast(0.95)'
                                  : 'none',
                      }"
                    />
                  </div>

                  <!-- Floating Action Bar on hover -->
                  <!-- Floating Action Bar on hover or select -->
                  <div class="cell__actions">
                    <button type="button" class="cell__action-btn" title="Copy photo (Ctrl+C)" @click.stop="copyCellPhoto(cell)">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      <span class="cell__action-text">Copy</span>
                    </button>
                    <button type="button" class="cell__action-btn" title="Cut photo (Ctrl+X)" @click.stop="cutCellPhoto(cell)">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>
                      <span class="cell__action-text">Cut</span>
                    </button>
                    <button type="button" class="cell__action-btn" title="Duplicate photo" @click.stop="duplicateCellPhoto(cell)">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/><line x1="14" y1="11" x2="14" y2="17"/><line x1="11" y1="14" x2="17" y2="14"/></svg>
                      <span class="cell__action-text">Duplicate</span>
                    </button>
                    <button type="button" class="cell__action-btn cell__action-btn--danger" title="Delete photo" @click.stop="removeCellPhoto(cell)">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                      <span class="cell__action-text">Delete</span>
                    </button>
                    <span class="cell__action-divider"></span>
                    <button type="button" class="cell__action-btn cell__action-btn--brand" title="Detach to Freeform Canvas for free length/width resizing" @click.stop="popCellToFreeform(cell)">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14L21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                      <span class="cell__action-text">Free Canvas</span>
                    </button>
                    <button type="button" class="cell__action-btn" title="Rotate 90°" @click.stop="rotateCellPhoto(cell)">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                    </button>
                  </div>

                  <!-- Optional Polaroid Caption -->
                  <div v-if="polaroidStyle || cell.caption" class="cell__caption">
                    <input
                      v-model="cell.caption"
                      type="text"
                      placeholder="Add caption…"
                      class="cell__caption-input"
                    />
                  </div>
                </template>

                <!-- When cell is empty -->
                <template v-else>
                  <div class="cell__empty" @click="triggerUploadForCell(cell.id)">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="cell__empty-icon">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                    <span class="cell__empty-label">Tap or Drop Photo</span>
                    <span class="cell__empty-hint">In-memory only · no cloud</span>
                  </div>
                </template>
              </div>
            </div>

            <!-- ================= FREEFORM CANVAS RENDER ================= -->
            <div
              v-else
              class="freeform-canvas"
              :style="{
                minHeight: `${canvasDimensions.height - paddingSize * 2}px`,
              }"
              @click="selectedFreeformId = null"
            >
              <!-- Freeform Images -->
              <div
                v-for="item in freeformImages"
                :key="item.id"
                class="ff-item"
                :class="[
                  item.polaroid ? 'ff-item--polaroid' : 'ff-item--plain',
                  selectedFreeformId === item.id ? 'ff-item--selected' : '',
                ]"
                :style="{
                  left: `${item.x}px`,
                  top: `${item.y}px`,
                  width: `${item.width}px`,
                  height: `${item.height}px`,
                  transform: `rotate(${item.rotation}deg)`,
                  zIndex: item.zIndex,
                  borderRadius: item.polaroid ? '6px' : `${cornerRadius}px`,
                }"
                @mousedown="onItemMouseDown($event, item)"
                @touchstart="onItemTouchStart($event, item)"
              >
                <div class="ff-item__img-wrap" :style="{ borderRadius: item.polaroid ? '4px' : `${Math.max(0, cornerRadius - 4)}px` }">
                  <img :src="item.image" alt="Scrapbook photo" class="ff-item__img" />
                </div>

                <!-- Polaroid Caption Input -->
                <div v-if="item.polaroid" class="ff-item__caption">
                  <input
                    v-model="item.caption"
                    type="text"
                    placeholder="Add caption…"
                    class="ff-item__caption-input"
                    @mousedown.stop
                    @touchstart.stop
                  />
                </div>

                <!-- Active Selection & Resize Border Controls -->
                <template v-if="selectedFreeformId === item.id">
                  <!-- Active Draggable Border Edges (Adjust Length & Width) -->
                  <div class="resize-edge resize-edge--top" title="Drag border to adjust length (height)" @mousedown.stop="startResize($event, item, 'n')" @touchstart.stop="startResize($event, item, 'n')"></div>
                  <div class="resize-edge resize-edge--bottom" title="Drag border to adjust length (height)" @mousedown.stop="startResize($event, item, 's')" @touchstart.stop="startResize($event, item, 's')"></div>
                  <div class="resize-edge resize-edge--left" title="Drag border to adjust width" @mousedown.stop="startResize($event, item, 'w')" @touchstart.stop="startResize($event, item, 'w')"></div>
                  <div class="resize-edge resize-edge--right" title="Drag border to adjust width" @mousedown.stop="startResize($event, item, 'e')" @touchstart.stop="startResize($event, item, 'e')"></div>

                  <!-- 4 Corner Resize Handles -->
                  <div class="resize-handle resize-handle--nw" title="Resize diagonally (NW)" @mousedown.stop="startResize($event, item, 'nw')" @touchstart.stop="startResize($event, item, 'nw')"></div>
                  <div class="resize-handle resize-handle--ne" title="Resize diagonally (NE)" @mousedown.stop="startResize($event, item, 'ne')" @touchstart.stop="startResize($event, item, 'ne')"></div>
                  <div class="resize-handle resize-handle--sw" title="Resize diagonally (SW)" @mousedown.stop="startResize($event, item, 'sw')" @touchstart.stop="startResize($event, item, 'sw')"></div>
                  <div class="resize-handle resize-handle--se" title="Resize diagonally (SE)" @mousedown.stop="startResize($event, item, 'se')" @touchstart.stop="startResize($event, item, 'se')"></div>

                  <!-- 4 Side Middle Resize Handles -->
                  <div class="resize-handle resize-handle--n" title="Drag to adjust length (height)" @mousedown.stop="startResize($event, item, 'n')" @touchstart.stop="startResize($event, item, 'n')"></div>
                  <div class="resize-handle resize-handle--s" title="Drag to adjust length (height)" @mousedown.stop="startResize($event, item, 's')" @touchstart.stop="startResize($event, item, 's')"></div>
                  <div class="resize-handle resize-handle--w" title="Drag to adjust width" @mousedown.stop="startResize($event, item, 'w')" @touchstart.stop="startResize($event, item, 'w')"></div>
                  <div class="resize-handle resize-handle--e" title="Drag to adjust width" @mousedown.stop="startResize($event, item, 'e')" @touchstart.stop="startResize($event, item, 'e')"></div>

                  <!-- Floating Action Toolbar: COPY, CUT, DUPLICATE, DELETE -->
                  <div class="ff-toolbar" @mousedown.stop @touchstart.stop>
                    <button type="button" class="ff-toolbar__btn" title="Copy photo (Ctrl+C)" @click="copyFreeformImage(item)">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      <span>Copy</span>
                    </button>
                    <button type="button" class="ff-toolbar__btn" title="Cut photo (Ctrl+X)" @click="cutFreeformImage(item)">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>
                      <span>Cut</span>
                    </button>
                    <button type="button" class="ff-toolbar__btn" title="Duplicate (Ctrl+D)" @click="duplicateFreeformImage(item)">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/><line x1="14" y1="11" x2="14" y2="17"/><line x1="11" y1="14" x2="17" y2="14"/></svg>
                      <span>Duplicate</span>
                    </button>
                    <button type="button" class="ff-toolbar__btn ff-toolbar__btn--danger" title="Delete photo" @click="removeFreeformImage(item.id)">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                      <span>Delete</span>
                    </button>
                    <span class="ff-toolbar__divider"></span>
                    <button type="button" class="ff-toolbar__btn ff-toolbar__btn--icon" title="Rotate +15°" @click="rotateFreeform(item, 15)">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                    </button>
                    <button type="button" class="ff-toolbar__btn ff-toolbar__btn--icon" title="Bring to Front" @click="bringToFront(item)">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                    </button>
                    <button type="button" class="ff-toolbar__btn ff-toolbar__btn--icon" title="Send to Back" @click="sendToBack(item)">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                  </div>
                </template>
              </div>

              <!-- Empty Freeform Prompt -->
              <div
                v-if="freeformImages.length === 0"
                class="freeform-empty"
              >
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="freeform-empty__icon">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                <p class="freeform-empty__title">Your Scrapbook Artboard is Ready</p>
                <p class="freeform-empty__sub">Drag and drop images onto this canvas, or click below</p>
                <button
                  type="button"
                  class="action-btn action-btn--primary"
                  style="margin-top: 16px"
                  @click="triggerAddFreeformPhoto"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  <span>Add Photos</span>
                </button>
              </div>
            </div>

            <!-- ================= DRAGGABLE TEXT ANNOTATIONS ================= -->
            <div
              v-for="textItem in textItems"
              :key="textItem.id"
              class="canvas-text"
              :class="[
                textItem.bgColor === 'dark-glass' ? 'canvas-text--dark' : '',
                textItem.bgColor === 'frosted' ? 'canvas-text--frosted' : '',
                textItem.bgColor === 'emerald' ? 'canvas-text--emerald' : '',
                textItem.bgColor === 'amber' ? 'canvas-text--amber' : '',
                textItem.bgColor === 'rose' ? 'canvas-text--rose' : '',
                selectedTextId === textItem.id ? 'canvas-text--selected' : '',
              ]"
              :style="{
                left: `${textItem.x}%`,
                top: `${textItem.y}%`,
              }"
              @mousedown.stop="startTextDrag($event, textItem)"
              @touchstart.stop="startTextDrag($event, textItem)"
            >
              <div class="canvas-text__inner">
                <textarea
                  v-model="textItem.text"
                  rows="2"
                  class="canvas-text__textarea"
                  :style="{
                    fontSize: `${textItem.fontSize}px`,
                    color: textItem.color,
                    fontFamily: textItem.fontFamily === 'sketch' ? 'ui-serif, Georgia, serif' : 'inherit',
                  }"
                  @mousedown.stop
                ></textarea>

                <div class="canvas-text__actions">
                  <button
                    type="button"
                    class="canvas-text__action-btn"
                    title="Duplicate text"
                    @click.stop="duplicateTextItem(textItem)"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/><line x1="14" y1="11" x2="14" y2="17"/><line x1="11" y1="14" x2="17" y2="14"/></svg>
                  </button>
                  <button
                    type="button"
                    class="canvas-text__action-btn"
                    title="Copy text"
                    @click.stop="copyTextItem(textItem)"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  </button>
                  <button
                    type="button"
                    class="canvas-text__action-btn canvas-text__action-btn--danger"
                    title="Delete text"
                    @click.stop="removeTextItem(textItem.id)"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>
            </div>

            <!-- ================= DRAGGABLE STICKER BADGES ================= -->
            <div
              v-for="stk in stickerItems"
              :key="stk.id"
              class="canvas-sticker"
              :class="stk.colorClass"
              :style="{
                left: `${stk.x}%`,
                top: `${stk.y}%`,
              }"
            >
              <span>{{ stk.icon }}</span>
              <span>{{ stk.label }}</span>
              <button
                type="button"
                class="canvas-sticker__delete"
                @click.stop="removeSticker(stk.id)"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

        <!-- Cell Selection Editor -->
        <div
          v-if="selectedCellId && activeTemplate !== 'freeform'"
          class="cell-editor"
        >
          <div class="cell-editor__header">
            <h4 class="cell-editor__title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
              <span>Editing: {{ selectedCellId?.toUpperCase() }}</span>
            </h4>
            <button type="button" class="cell-editor__close" @click="selectedCellId = null">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div
            v-if="cells.find(c => c.id === selectedCellId)?.image"
            class="cell-editor__body"
          >
            <div class="cell-editor__control">
              <div class="cell-editor__control-header">
                <span>Zoom</span>
                <span class="cell-editor__val">{{ cells.find(c => c.id === selectedCellId)?.zoom }}x</span>
              </div>
              <input
                v-model.number="cells.find(c => c.id === selectedCellId)!.zoom"
                type="range" min="1.0" max="3.0" step="0.1"
                class="cell-editor__slider"
              />
            </div>

            <div class="cell-editor__control">
              <span>Color Tone</span>
              <select
                v-model="cells.find(c => c.id === selectedCellId)!.filter"
                class="cell-editor__select"
              >
                <option value="none">Original</option>
                <option value="warm">Warm Sunlight</option>
                <option value="vivid">Vivid</option>
                <option value="bw">B&W Archive</option>
                <option value="soft">Soft Classroom</option>
              </select>
            </div>

            <div class="cell-editor__actions">
              <button type="button" class="cell-editor__action-btn" @click="rotateCellPhoto(cells.find(c => c.id === selectedCellId)!)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                <span>Rotate</span>
              </button>
              <button type="button" class="cell-editor__action-btn" @click="triggerUploadForCell(selectedCellId!)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
                <span>Replace</span>
              </button>
              <button type="button" class="cell-editor__action-btn cell-editor__action-btn--danger" @click="removeCellPhoto(cells.find(c => c.id === selectedCellId)!)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>
                <span>Remove</span>
              </button>
            </div>
          </div>

          <div v-else class="cell-editor__empty">
            <span>Frame is empty</span>
            <button type="button" class="action-btn action-btn--primary action-btn--sm" @click="triggerUploadForCell(selectedCellId!)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              <span>Select Photo</span>
            </button>
          </div>
        </div>

        <!-- Privacy footer -->
        <div class="privacy-footer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span><strong>100% In-Memory Privacy</strong> — Photos live in browser RAM only. Zero cloud storage. Automatically erased on close.</span>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
/* ========================================================================
   COLLAGE STUDIO — PREMIUM DESIGN SYSTEM
   ======================================================================== */

/* == Base Layout == */
.collage-studio {
  min-height: 100vh;
  padding: 16px;
  max-width: 1600px;
  margin: 0 auto;
}

@media (min-width: 640px) {
  .collage-studio { padding: 20px 24px; }
}

/* == Header == */
.studio-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

@media (min-width: 768px) {
  .studio-header {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.studio-header__left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.studio-header__icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%);
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
}

.studio-header__title {
  font-size: 1.4rem;
  font-weight: 900;
  letter-spacing: -0.03em;
  color: var(--color-text-primary, #0f172a);
  line-height: 1.2;
}

:root.dark .studio-header__title,
.dark .studio-header__title {
  color: #f1f5f9;
}

.studio-header__sub {
  font-size: 0.75rem;
  color: var(--color-text-muted, #64748b);
  margin-top: 2px;
}

.studio-header__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-end;
}

@media (min-width: 640px) {
  .studio-header__actions {
    flex-direction: row;
    align-items: center;
  }
}

.studio-header__btns {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

/* == Privacy Chip == */
.privacy-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 100px;
  background: linear-gradient(135deg, #064e3b 0%, #065f46 100%);
  color: #a7f3d0;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.privacy-chip__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #34d399;
  animation: pulse-dot 2s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

.privacy-chip__separator { opacity: 0.4; }

/* == Action Buttons == */
.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.action-btn--ghost {
  background: rgba(15, 23, 42, 0.06);
  color: #334155;
  border: 1px solid rgba(15, 23, 42, 0.08);
}

.dark .action-btn--ghost {
  background: rgba(241, 245, 249, 0.08);
  color: #cbd5e1;
  border-color: rgba(241, 245, 249, 0.1);
}

.action-btn--ghost:hover:not(:disabled) {
  background: rgba(15, 23, 42, 0.12);
  transform: translateY(-1px);
}

.action-btn--primary {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: #fff;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.action-btn--primary:hover:not(:disabled) {
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.45);
  transform: translateY(-1px);
}

.action-btn--full { width: 100%; justify-content: center; }
.action-btn--sm { padding: 5px 10px; font-size: 0.7rem; }

.action-btn__label {
  display: none;
}

@media (min-width: 640px) {
  .action-btn__label { display: inline; }
}

/* == Workspace Layout == */
.workspace {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 16px;
  align-items: start;
}

.workspace--collapsed {
  grid-template-columns: 40px 1fr;
}

@media (max-width: 1023px) {
  .workspace {
    grid-template-columns: 1fr;
  }
  .workspace--collapsed {
    grid-template-columns: 1fr;
  }
}

/* == Sidebar == */
.sidebar {
  position: sticky;
  top: 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px) saturate(1.4);
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 8px 24px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.dark .sidebar {
  background: rgba(15, 23, 42, 0.85);
  border-color: rgba(255, 255, 255, 0.06);
}

.sidebar--collapsed {
  border-radius: 12px;
}

@media (max-width: 1023px) {
  .sidebar {
    position: static;
  }
  .sidebar--collapsed .sidebar__content {
    display: none;
  }
}

.sidebar__toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 10px;
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  transition: color 0.2s;
}

.sidebar__toggle:hover { color: #0f172a; }
.dark .sidebar__toggle:hover { color: #e2e8f0; }

.sidebar__content {
  padding: 0 0 12px;
}

/* == Panel Tabs == */
.panel-tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 2px;
  padding: 6px;
  background: rgba(0, 0, 0, 0.03);
}

.dark .panel-tabs { background: rgba(255, 255, 255, 0.03); }

.panel-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 4px;
  border: none;
  background: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 0.65rem;
  font-weight: 600;
  color: #94a3b8;
  transition: all 0.2s;
}

.panel-tab:hover {
  background: rgba(0, 0, 0, 0.04);
  color: #475569;
}

.dark .panel-tab:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #cbd5e1;
}

.panel-tab--active {
  background: #fff !important;
  color: #6366f1 !important;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.dark .panel-tab--active {
  background: rgba(99, 102, 241, 0.15) !important;
  color: #a5b4fc !important;
}

/* == Panel Body == */
.panel-body {
  padding: 12px 14px;
}

.panel-section-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #94a3b8;
  margin-bottom: 10px;
}

.panel-section-badge {
  font-size: 0.6rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 100px;
  background: rgba(99, 102, 241, 0.1);
  color: #6366f1;
}

.panel-hint {
  font-size: 0.65rem;
  color: #94a3b8;
  margin-top: 10px;
  font-style: italic;
}

/* == Template Grid == */
.template-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.template-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 6px;
  border-radius: 10px;
  border: 1.5px solid rgba(0, 0, 0, 0.06);
  background: rgba(0, 0, 0, 0.02);
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.dark .template-card {
  border-color: rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.03);
}

.template-card:hover {
  border-color: rgba(99, 102, 241, 0.3);
  background: rgba(99, 102, 241, 0.04);
  transform: translateY(-1px);
}

.template-card--active {
  border-color: #6366f1 !important;
  background: rgba(99, 102, 241, 0.08) !important;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

.template-card__icon {
  font-size: 1.1rem;
}

.template-card__name {
  font-size: 0.6rem;
  font-weight: 800;
  color: #334155;
  line-height: 1.2;
}

.dark .template-card__name { color: #cbd5e1; }

.template-card--active .template-card__name { color: #6366f1; }
.dark .template-card--active .template-card__name { color: #a5b4fc; }

/* == Format Buttons == */
.format-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 5px;
}

.format-btn {
  padding: 7px 10px;
  border-radius: 8px;
  border: 1.5px solid rgba(0, 0, 0, 0.08);
  background: rgba(0, 0, 0, 0.02);
  font-size: 0.65rem;
  font-weight: 700;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.dark .format-btn {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: #94a3b8;
}

.format-btn--active {
  background: #0f172a !important;
  color: #fff !important;
  border-color: transparent !important;
}

.dark .format-btn--active {
  background: #e2e8f0 !important;
  color: #0f172a !important;
}

/* == Theme Swatches == */
.theme-picker {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.theme-swatch {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.2s;
  display: grid;
  place-items: center;
  position: relative;
}

.theme-swatch:hover {
  transform: scale(1.15);
}

.theme-swatch--active {
  border-color: var(--ring-color) !important;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
  transform: scale(1.1);
}

.theme-swatch__check {
  font-size: 0.7rem;
  font-weight: 900;
}

/* == Sliders == */
.slider-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.slider-row label {
  font-size: 0.65rem;
  font-weight: 700;
  color: #64748b;
  min-width: 42px;
}

.slider-row input[type="range"] {
  flex: 1;
  accent-color: #6366f1;
  height: 4px;
}

.slider-val {
  font-size: 0.6rem;
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: #6366f1;
  min-width: 30px;
  text-align: right;
}

/* == Toggle == */
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 0.7rem;
  font-weight: 700;
  color: #475569;
  cursor: pointer;
}

.dark .toggle-row { color: #cbd5e1; }

.toggle-check {
  width: 16px;
  height: 16px;
  accent-color: #6366f1;
  border-radius: 4px;
}

/* == Text Add Buttons == */
.text-btn-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.text-add-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1.5px solid rgba(0, 0, 0, 0.06);
  background: rgba(0, 0, 0, 0.02);
  font-size: 0.7rem;
  font-weight: 700;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s;
}

.dark .text-add-btn {
  border-color: rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.03);
  color: #94a3b8;
}

.text-add-btn:hover {
  border-color: rgba(99, 102, 241, 0.3);
  transform: translateY(-1px);
}

.text-add-btn__icon { font-size: 1rem; }

/* == Sticker List == */
.sticker-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.sticker-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border-radius: 100px;
  font-size: 0.6rem;
  font-weight: 800;
  border: 1px solid rgba(255, 255, 255, 0.2);
  cursor: pointer;
  transition: all 0.15s;
}

.sticker-btn:hover {
  transform: scale(1.05);
}

.sticker-btn:active {
  transform: scale(0.95);
}

/* == Freeform CTA == */
.freeform-cta {
  margin-top: 12px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(99, 102, 241, 0.06);
  border: 1px dashed rgba(99, 102, 241, 0.25);
}

/* == Canvas Area == */
.canvas-area {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* == Canvas Toolbar == */
.canvas-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.92);
  backdrop-filter: blur(12px);
  color: #fff;
  flex-wrap: wrap;
  gap: 8px;
}

.canvas-toolbar__left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.canvas-toolbar__badge {
  font-size: 0.6rem;
  font-weight: 900;
  letter-spacing: 0.15em;
  color: #a5b4fc;
}

.canvas-toolbar__ratio {
  font-size: 0.65rem;
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: #94a3b8;
}

/* Template Mode Quick Toggle */
.canvas-mode-toggle {
  display: inline-flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 2px;
  gap: 2px;
}

.mode-toggle__btn {
  padding: 3px 8px;
  font-size: 0.65rem;
  font-weight: 700;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.15s;
}

.mode-toggle__btn:hover {
  color: #fff;
}

.mode-toggle__btn--active {
  background: #6366f1;
  color: #fff !important;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}

.canvas-toolbar__center {
  display: flex;
  align-items: center;
}

/* Canvas Scale / Zoom Controls */
.canvas-zoom-control {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 2px 4px;
}

.zoom-btn {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 5px;
  border: none;
  background: transparent;
  color: #e2e8f0;
  cursor: pointer;
  transition: all 0.15s;
}

.zoom-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.zoom-value {
  font-size: 0.65rem;
  font-weight: 800;
  font-family: monospace;
  padding: 0 4px;
  min-width: 36px;
  text-align: center;
  color: #cbd5e1;
}

.zoom-reset-btn {
  padding: 2px 6px;
  font-size: 0.6rem;
  font-weight: 700;
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.15s;
}

.zoom-reset-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.canvas-toolbar__hints {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.65rem;
  color: #64748b;
}

.canvas-paste-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  font-size: 0.65rem;
  font-weight: 700;
  border-radius: 6px;
  border: 1px solid #10b981;
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  cursor: pointer;
  transition: all 0.15s;
}

.canvas-paste-btn:hover {
  background: rgba(16, 185, 129, 0.3);
  color: #fff;
}

@media (max-width: 640px) {
  .canvas-toolbar__hints span { display: none; }
}

/* == Canvas Scroll Wrapper == */
.canvas-scroll-wrap {
  overflow: auto;
  padding: 12px 8px 24px 8px;
  -webkit-overflow-scrolling: touch;
  display: flex;
  justify-content: center;
}

/* == Artboard Scale Container == */
.artboard-scale-container {
  position: relative;
  margin: 0 auto;
  transition: width 0.15s ease, height 0.15s ease;
}

/* == Artboard == */
.artboard {
  position: relative;
  margin: 0 auto;
  border-width: 1px;
  border-style: solid;
  transition: all 0.2s;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.06),
    0 10px 40px rgba(0, 0, 0, 0.1),
    0 0 0 1px rgba(0, 0, 0, 0.02);
  user-select: none;
}

/* == Grid Cell == */
.cell {
  position: relative;
  overflow: hidden;
  transition: box-shadow 0.2s, outline 0.2s;
}

.cell--default {
  background: rgba(148, 163, 184, 0.08);
  border: 1px solid rgba(148, 163, 184, 0.15);
}

.cell--polaroid {
  background: #fff;
  padding: 8px;
  padding-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.cell--selected {
  outline: 2px solid #6366f1;
  outline-offset: -2px;
}

.cell__image-wrap {
  width: 100%;
  height: 100%;
  cursor: grab;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cell__image-wrap:active { cursor: grabbing; }

.cell__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
  transition: transform 75ms linear;
}

/* == Cell Actions Overlay == */
.cell__actions {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 6px 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, transparent 100%);
  opacity: 0;
  transition: opacity 0.25s;
  justify-content: flex-end;
}

.cell:hover .cell__actions {
  opacity: 1;
}

.cell__action-btn {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(8px);
  color: #fff;
  cursor: pointer;
  transition: all 0.15s;
}

.cell__action-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: scale(1.1);
}

.cell__action-btn--brand {
  background: rgba(99, 102, 241, 0.7);
}

.cell__action-btn--brand:hover {
  background: rgba(99, 102, 241, 0.9);
}

.cell__action-btn--danger {
  background: rgba(239, 68, 68, 0.6);
}

.cell__action-btn--danger:hover {
  background: rgba(239, 68, 68, 0.9);
}

.cell__action-divider {
  width: 1px;
  height: 16px;
  background: rgba(255, 255, 255, 0.2);
  margin: 0 2px;
}

/* == Cell Caption == */
.cell__caption {
  position: absolute;
  bottom: 2px;
  left: 8px;
  right: 8px;
  text-align: center;
}

.cell__caption-input {
  width: 100%;
  text-align: center;
  background: transparent;
  border: none;
  font-size: 0.7rem;
  font-weight: 600;
  color: #475569;
  outline: none;
}

.cell__caption-input::placeholder {
  color: #94a3b8;
}

/* == Empty Cell == */
.cell__empty {
  width: 100%;
  height: 100%;
  min-height: 160px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
  text-align: center;
  cursor: pointer;
  border: 2px dashed rgba(148, 163, 184, 0.25);
  border-radius: inherit;
  transition: border-color 0.2s, background 0.2s;
}

.cell__empty:hover {
  border-color: rgba(99, 102, 241, 0.5);
  background: rgba(99, 102, 241, 0.03);
}

.cell__empty-icon {
  color: #94a3b8;
  margin-bottom: 6px;
  opacity: 0.5;
}

.cell__empty-label {
  font-size: 0.7rem;
  font-weight: 800;
  color: #475569;
}

.dark .cell__empty-label { color: #cbd5e1; }

.cell__empty-hint {
  font-size: 0.6rem;
  color: #94a3b8;
  margin-top: 2px;
}

/* == Freeform Canvas == */
.freeform-canvas {
  position: relative;
  width: 100%;
  overflow: hidden;
}

/* == Freeform Image Item == */
.ff-item {
  position: absolute;
  cursor: move;
  user-select: none;
  touch-action: none;
  display: flex;
  flex-direction: column;
}

.ff-item--polaroid {
  background: #ffffff;
  padding: 8px 8px 24px 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.14);
}

.ff-item--plain {
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.16);
}

.ff-item--selected {
  outline: 2px solid #6366f1 !important;
  outline-offset: 1px;
  box-shadow: 0 8px 30px rgba(99, 102, 241, 0.35) !important;
}

.ff-item__img-wrap {
  width: 100%;
  height: 100%;
  flex: 1 1 0%;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

.ff-item__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
  display: block;
}

.ff-item__caption {
  padding-top: 6px;
  text-align: center;
}

.ff-item__caption-input {
  width: 100%;
  text-align: center;
  background: transparent;
  border: none;
  font-size: 0.65rem;
  font-weight: 700;
  color: #475569;
  outline: none;
}

/* == Draggable Border Edges (Adjust Length & Width) == */
.resize-edge {
  position: absolute;
  z-index: 55;
  background: transparent;
  transition: background-color 0.15s;
}

.resize-edge--top {
  top: -5px;
  left: 0;
  right: 0;
  height: 10px;
  cursor: ns-resize;
}

.resize-edge--bottom {
  bottom: -5px;
  left: 0;
  right: 0;
  height: 10px;
  cursor: ns-resize;
}

.resize-edge--left {
  top: 0;
  bottom: 0;
  left: -5px;
  width: 10px;
  cursor: ew-resize;
}

.resize-edge--right {
  top: 0;
  bottom: 0;
  right: -5px;
  width: 10px;
  cursor: ew-resize;
}

.resize-edge:hover {
  background: rgba(99, 102, 241, 0.45);
}

/* == 8 Resize Handles (Length & Width) == */
.resize-handle {
  position: absolute;
  width: 13px;
  height: 13px;
  background: #ffffff;
  border: 2px solid #6366f1;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
  z-index: 60;
  transition: transform 0.15s, background-color 0.15s;
}

.resize-handle:hover {
  background: #6366f1;
  transform: scale(1.25);
}

.resize-handle::after {
  content: '';
  position: absolute;
  top: -10px;
  left: -10px;
  right: -10px;
  bottom: -10px;
}

/* Corner handles (circles) */
.resize-handle--nw { top: -6px; left: -6px; border-radius: 50%; cursor: nwse-resize; }
.resize-handle--ne { top: -6px; right: -6px; border-radius: 50%; cursor: nesw-resize; }
.resize-handle--sw { bottom: -6px; left: -6px; border-radius: 50%; cursor: nesw-resize; }
.resize-handle--se { bottom: -6px; right: -6px; border-radius: 50%; cursor: nwse-resize; }

/* Side middle handles (bars for length & width) */
.resize-handle--n { top: -6px; left: 50%; transform: translateX(-50%); width: 22px; height: 8px; border-radius: 4px; cursor: ns-resize; }
.resize-handle--s { bottom: -6px; left: 50%; transform: translateX(-50%); width: 22px; height: 8px; border-radius: 4px; cursor: ns-resize; }
.resize-handle--w { left: -6px; top: 50%; transform: translateY(-50%); width: 8px; height: 22px; border-radius: 4px; cursor: ew-resize; }
.resize-handle--e { right: -6px; top: 50%; transform: translateY(-50%); width: 8px; height: 22px; border-radius: 4px; cursor: ew-resize; }

.resize-handle--n:hover,
.resize-handle--s:hover {
  transform: translateX(-50%) scale(1.18);
}
.resize-handle--w:hover,
.resize-handle--e:hover {
  transform: translateY(-50%) scale(1.18);
}

/* == Freeform Floating Toolbar: COPY, CUT, DUPLICATE, DELETE == */
.ff-toolbar {
  position: absolute;
  top: -46px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 4px 6px;
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.94);
  backdrop-filter: blur(16px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
  z-index: 70;
  white-space: nowrap;
  animation: toolbar-in 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes toolbar-in {
  from { opacity: 0; transform: translateX(-50%) translateY(8px) scale(0.9); }
  to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
}

.ff-toolbar__btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  height: 28px;
  font-size: 0.72rem;
  font-weight: 700;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #f1f5f9;
  cursor: pointer;
  transition: all 0.15s;
}

.ff-toolbar__btn:hover {
  background: rgba(255, 255, 255, 0.16);
  color: #ffffff;
}

.ff-toolbar__btn--icon {
  padding: 4px;
  width: 28px;
  justify-content: center;
}

.ff-toolbar__btn--danger {
  color: #fca5a5;
}

.ff-toolbar__btn--danger:hover {
  background: rgba(239, 68, 68, 0.35);
  color: #ffffff;
}

.ff-toolbar__divider {
  width: 1px;
  height: 18px;
  background: rgba(255, 255, 255, 0.15);
  margin: 0 3px;
}

.cell__action-text {
  font-size: 0.6rem;
  font-weight: 700;
  display: inline;
}

@media (max-width: 640px) {
  .cell__action-text {
    display: none;
  }
}

/* == Freeform Empty State == */
.freeform-empty {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  text-align: center;
  border: 2px dashed rgba(148, 163, 184, 0.2);
  border-radius: 16px;
}

.freeform-empty__icon {
  color: #94a3b8;
  opacity: 0.4;
  margin-bottom: 12px;
}

.freeform-empty__title {
  font-size: 0.85rem;
  font-weight: 800;
  color: #475569;
}

.dark .freeform-empty__title { color: #cbd5e1; }

.freeform-empty__sub {
  font-size: 0.7rem;
  color: #94a3b8;
  margin-top: 4px;
  max-width: 320px;
}

/* == Canvas Text Blocks == */
.canvas-text {
  position: absolute;
  z-index: 20;
  cursor: move;
  user-select: none;
  border-radius: 12px;
  padding: 8px 14px;
  max-width: 400px;
  transition: box-shadow 0.2s;
}

.canvas-text--dark {
  background: rgba(15, 23, 42, 0.85);
  color: #fff;
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.canvas-text--frosted {
  background: rgba(255, 255, 255, 0.9);
  color: #0f172a;
  backdrop-filter: blur(12px);
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.canvas-text--emerald {
  background: #059669;
  color: #fff;
  box-shadow: 0 2px 8px rgba(5, 150, 105, 0.3);
}

.canvas-text--amber {
  background: #d97706;
  color: #fff;
}

.canvas-text--rose {
  background: #e11d48;
  color: #fff;
}

.canvas-text--selected {
  outline: 2px solid #6366f1;
  outline-offset: 1px;
}

.canvas-text__inner {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.canvas-text__textarea {
  background: transparent;
  border: none;
  resize: none;
  font-weight: 700;
  outline: none;
  width: 100%;
  line-height: 1.4;
}

.canvas-text__actions {
  display: flex;
  align-items: center;
  gap: 3px;
  opacity: 0;
  transition: opacity 0.2s;
  flex-shrink: 0;
}

.canvas-text:hover .canvas-text__actions,
.canvas-text--selected .canvas-text__actions {
  opacity: 1;
}

.canvas-text__action-btn {
  padding: 3px;
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 5px;
  border: none;
  background: rgba(15, 23, 42, 0.15);
  color: inherit;
  cursor: pointer;
  transition: all 0.15s;
}

.canvas-text--dark .canvas-text__action-btn,
.canvas-text--emerald .canvas-text__action-btn,
.canvas-text--amber .canvas-text__action-btn,
.canvas-text--rose .canvas-text__action-btn {
  background: rgba(255, 255, 255, 0.2);
}

.canvas-text__action-btn:hover {
  background: rgba(255, 255, 255, 0.45);
  transform: scale(1.1);
}

.canvas-text__action-btn--danger {
  color: #f87171;
  background: rgba(239, 68, 68, 0.2);
}

.canvas-text__action-btn--danger:hover {
  background: rgba(239, 68, 68, 0.65);
  color: #fff;
}

/* == Canvas Stickers == */
.canvas-sticker {
  position: absolute;
  z-index: 20;
  cursor: move;
  padding: 5px 12px;
  border-radius: 100px;
  font-size: 0.65rem;
  font-weight: 800;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  user-select: none;
  display: flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}

.canvas-sticker__delete {
  opacity: 0;
  border: none;
  background: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  padding: 2px;
  transition: all 0.2s;
  margin-left: 2px;
}

.canvas-sticker:hover .canvas-sticker__delete { opacity: 1; }

.canvas-sticker__delete:hover { color: #fff; }

/* == Cell Editor Drawer == */
.cell-editor {
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 14px 16px;
  color: #e2e8f0;
}

.cell-editor__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.cell-editor__title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.7rem;
  font-weight: 800;
  color: #a5b4fc;
}

.cell-editor__close {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: rgba(255, 255, 255, 0.06);
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.15s;
}

.cell-editor__close:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.cell-editor__body {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 16px;
  align-items: end;
  font-size: 0.7rem;
}

@media (max-width: 640px) {
  .cell-editor__body { grid-template-columns: 1fr; }
}

.cell-editor__control { display: flex; flex-direction: column; gap: 4px; }

.cell-editor__control-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.65rem;
  color: #94a3b8;
}

.cell-editor__val {
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: #a5b4fc;
}

.cell-editor__slider {
  width: 100%;
  accent-color: #6366f1;
}

.cell-editor__select {
  width: 100%;
  padding: 5px 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #e2e8f0;
  font-size: 0.65rem;
  outline: none;
}

.cell-editor__actions {
  display: flex;
  gap: 6px;
}

.cell-editor__action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.06);
  color: #e2e8f0;
  font-size: 0.65rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}

.cell-editor__action-btn:hover {
  background: rgba(255, 255, 255, 0.12);
}

.cell-editor__action-btn--danger {
  color: #fca5a5;
  border-color: rgba(239, 68, 68, 0.15);
}

.cell-editor__action-btn--danger:hover {
  background: rgba(239, 68, 68, 0.2);
}

.cell-editor__empty {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.7rem;
  color: #94a3b8;
}

/* == Privacy Footer == */
.privacy-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(5, 150, 105, 0.06);
  border: 1px solid rgba(5, 150, 105, 0.12);
  font-size: 0.65rem;
  color: #059669;
}

.dark .privacy-footer {
  background: rgba(5, 150, 105, 0.08);
  color: #6ee7b7;
}

/* == Print Styles == */
@media print {
  header,
  nav,
  aside,
  button,
  input,
  .studio-header,
  .sidebar,
  .canvas-toolbar,
  .cell-editor,
  .privacy-footer,
  .cell__actions,
  .ff-toolbar,
  .resize-handle,
  .canvas-text__actions,
  .canvas-sticker__delete {
    display: none !important;
  }

  body {
    background: white !important;
    color: black !important;
  }

  #collage-export-artboard {
    border: none !important;
    box-shadow: none !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
  }
}
</style>
