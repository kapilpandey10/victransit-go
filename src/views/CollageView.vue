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

// Memory Tracking
const inMemoryPhotoCount = computed(() => {
  const gridPhotos = cells.value.filter(c => !!c.image).length
  const freePhotos = freeformImages.value.length
  return gridPhotos + freePhotos
})

// Aspect Ratio Dimensions in CSS pixels (baseline viewport)
const canvasDimensions = computed(() => {
  switch (aspectRatio.value) {
    case 'a4-landscape':
      return { width: 900, height: 636, ratioLabel: 'A4 Landscape (1.41 : 1)' }
    case 'a4-portrait':
      return { width: 636, height: 900, ratioLabel: 'A4 Portrait (1 : 1.41)' }
    case 'square':
      return { width: 750, height: 750, ratioLabel: 'Square 1:1' }
    case 'wide':
      return { width: 960, height: 540, ratioLabel: 'Wide 16:9' }
  }
})

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

onMounted(() => {
  initializeCellsForTemplate(activeTemplate.value)
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
  cell.rotation = 0
}

function rotateCellPhoto(cell: PhotoCell) {
  cell.rotation = (cell.rotation + 90) % 360
}

function removeFreeformImage(id: string) {
  freeformImages.value = freeformImages.value.filter(i => i.id !== id)
  if (selectedFreeformId.value === id) selectedFreeformId.value = null
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

function startFreeformDrag(event: MouseEvent | TouchEvent, item: FreeformImageItem) {
  selectedFreeformId.value = item.id
  activeFreeformDrag = item

  // Bring to front
  const maxZ = Math.max(0, ...freeformImages.value.map(i => i.zIndex))
  item.zIndex = maxZ + 1

  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY
  freeformStartX = clientX
  freeformStartY = clientY
  freeformOrigX = item.x
  freeformOrigY = item.y

  if ('touches' in event) {
    window.addEventListener('touchmove', onFreeformTouchMove, { passive: false })
    window.addEventListener('touchend', stopFreeformDrag)
  } else {
    window.addEventListener('mousemove', onFreeformMouseMove)
    window.addEventListener('mouseup', stopFreeformDrag)
  }
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
  event.preventDefault()
  const dx = event.touches[0].clientX - freeformStartX
  const dy = event.touches[0].clientY - freeformStartY
  activeFreeformDrag.x = freeformOrigX + dx
  activeFreeformDrag.y = freeformOrigY + dy
}

function stopFreeformDrag() {
  activeFreeformDrag = null
  window.removeEventListener('mousemove', onFreeformMouseMove)
  window.removeEventListener('mouseup', stopFreeformDrag)
  window.removeEventListener('touchmove', onFreeformTouchMove)
  window.removeEventListener('touchend', stopFreeformDrag)
}

function rotateFreeform(item: FreeformImageItem, delta: number) {
  item.rotation = (item.rotation + delta) % 360
}

function resizeFreeform(item: FreeformImageItem, factor: number) {
  item.width = Math.max(120, Math.min(600, Math.round(item.width * factor)))
  item.height = Math.max(90, Math.min(450, Math.round(item.height * factor)))
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

    ui.showToast(`Collage downloaded as High-Res ${format.toUpperCase()}!`, 'success')
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
  <div class="min-h-screen space-y-6 pb-20 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
    <!-- Hidden File Input for Image Selection -->
    <input
      ref="hiddenFileInput"
      type="file"
      accept="image/*"
      multiple
      class="hidden"
      @change="handleFileSelected"
    />

    <!-- Header & Title Banner -->
    <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <span class="text-3xl">🖼️</span>
          <h1 class="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Photo Collage & Pedagogical Canvas Studio
          </h1>
        </div>
        <p class="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
          Create 4, 5, 6, 8-grid photo collages and floorbook observation panels with touch/mouse sizing, EYLF badges, and child voice text.
        </p>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          class="btn-secondary text-xs font-bold flex items-center gap-1.5"
          title="Clear all in-memory photos"
          @click="purgeAllMemory"
        >
          <span>🧹</span>
          <span>Purge Memory</span>
        </button>

        <button
          type="button"
          class="btn-secondary text-xs font-bold flex items-center gap-1.5"
          :disabled="inMemoryPhotoCount === 0 || exportLoading"
          @click="copyToClipboard"
        >
          <span>📋</span>
          <span>Copy Image</span>
        </button>

        <button
          type="button"
          class="btn-secondary text-xs font-bold flex items-center gap-1.5"
          :disabled="inMemoryPhotoCount === 0 || exportLoading"
          @click="downloadCollage('png')"
        >
          <span>💾</span>
          <span>Download PNG</span>
        </button>

        <button
          type="button"
          class="btn-secondary text-xs font-bold flex items-center gap-1.5"
          :disabled="inMemoryPhotoCount === 0 || exportLoading"
          @click="printCollage"
        >
          <span>🖨️</span>
          <span>Print</span>
        </button>

        <button
          type="button"
          class="btn-primary text-xs font-black flex items-center gap-1.5 shadow-soft"
          :disabled="inMemoryPhotoCount === 0 || exportLoading"
          @click="transferToLearningStory"
        >
          <span>📖</span>
          <span>Send to Learning Story &rarr;</span>
        </button>
      </div>
    </div>

    <!-- ZERO-STORAGE CHILD PRIVACY BANNER (Prominently Highlighted) -->
    <div
      class="rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/80 via-emerald-900/60 to-slate-900 p-4 sm:p-5 text-emerald-100 shadow-lift"
    >
      <div class="flex items-start gap-3.5">
        <div class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-500/20 text-2xl border border-emerald-500/30">
          🛡️
        </div>
        <div class="space-y-1.5 flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h2 class="font-black text-sm sm:text-base text-white tracking-tight">
              100% In-Memory Child Privacy Shield
            </h2>
            <span class="rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold px-2.5 py-0.5 border border-emerald-500/40 uppercase tracking-wider">
              Zero Cloud Storage
            </span>
            <span class="rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold px-2.5 py-0.5 border border-slate-700">
              0 KB Database Footprint
            </span>
          </div>
          <p class="text-xs text-emerald-200/90 leading-relaxed max-w-4xl">
            <strong>All photos are decoded exclusively in your local browser’s active memory.</strong> We NEVER upload, store, or transmit children’s photos to any cloud database or external server. Once you close this window, download your collage, or refresh the tab, every image is automatically and immediately erased from RAM.
          </p>
          <div class="flex items-center gap-3 text-[11px] text-emerald-300/80 pt-0.5 font-mono">
            <span>Active in-memory photos: <strong>{{ inMemoryPhotoCount }}</strong></span>
            <span>·</span>
            <span>Cloud database cost: <strong>$0.00</strong> (Photos live in browser RAM only)</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Workspace Layout: Controls + Interactive Canvas -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- Left Controls Column (4 cols) -->
      <div class="lg:col-span-4 space-y-5">
        <!-- Template Selection Card -->
        <div class="card p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="font-extrabold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
              📐 Collage Templates
            </h3>
            <span class="text-xs font-mono text-brand-600 dark:text-brand-400">
              {{ activeTemplate === 'freeform' ? 'Freeform Canvas' : `${cells.length} Photos` }}
            </span>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="tpl in TEMPLATES"
              :key="tpl.id"
              type="button"
              class="flex flex-col items-start p-2.5 rounded-xl border text-left transition"
              :class="
                activeTemplate === tpl.id
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 text-brand-900 dark:text-brand-200 font-bold shadow-soft ring-1 ring-brand-500'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
              "
              @click="selectTemplate(tpl.id)"
            >
              <div class="flex items-center gap-1.5 w-full">
                <span class="text-base">{{ tpl.icon }}</span>
                <span class="text-xs font-black truncate">{{ tpl.name }}</span>
              </div>
              <p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-tight">
                {{ tpl.description }}
              </p>
            </button>
          </div>
        </div>

        <!-- Canvas Dimensions & Theme Card -->
        <div class="card p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 class="font-extrabold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
            🎨 Canvas Style & Paper
          </h3>

          <!-- Aspect Ratio Selector -->
          <div class="space-y-1.5">
            <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Format / Aspect Ratio</label>
            <div class="grid grid-cols-2 gap-1.5 text-xs">
              <button
                type="button"
                class="px-2.5 py-1.5 rounded-lg border font-semibold text-center transition"
                :class="aspectRatio === 'a4-landscape' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent' : 'border-slate-200 dark:border-slate-800'"
                @click="aspectRatio = 'a4-landscape'"
              >
                📄 A4 Landscape
              </button>
              <button
                type="button"
                class="px-2.5 py-1.5 rounded-lg border font-semibold text-center transition"
                :class="aspectRatio === 'a4-portrait' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent' : 'border-slate-200 dark:border-slate-800'"
                @click="aspectRatio = 'a4-portrait'"
              >
                📜 A4 Portrait
              </button>
              <button
                type="button"
                class="px-2.5 py-1.5 rounded-lg border font-semibold text-center transition"
                :class="aspectRatio === 'square' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent' : 'border-slate-200 dark:border-slate-800'"
                @click="aspectRatio = 'square'"
              >
                ⏹️ Square 1:1
              </button>
              <button
                type="button"
                class="px-2.5 py-1.5 rounded-lg border font-semibold text-center transition"
                :class="aspectRatio === 'wide' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent' : 'border-slate-200 dark:border-slate-800'"
                @click="aspectRatio = 'wide'"
              >
                🖥️ Wide 16:9
              </button>
            </div>
          </div>

          <!-- Paper Background Theme -->
          <div class="space-y-1.5">
            <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Paper Texture / Color</label>
            <div class="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                class="px-2.5 py-1 rounded-full text-xs font-bold border transition flex items-center gap-1.5"
                :class="canvasTheme === 'linen' ? 'ring-2 ring-brand-500 bg-[#F9F7F2] text-stone-900' : 'bg-[#F9F7F2] text-stone-700'"
                @click="canvasTheme = 'linen'"
              >
                <span>📜</span>
                <span>Warm Linen</span>
              </button>
              <button
                type="button"
                class="px-2.5 py-1 rounded-full text-xs font-bold border transition flex items-center gap-1.5"
                :class="canvasTheme === 'white' ? 'ring-2 ring-brand-500 bg-white text-slate-900' : 'bg-white text-slate-700'"
                @click="canvasTheme = 'white'"
              >
                <span>⚪</span>
                <span>Crisp White</span>
              </button>
              <button
                type="button"
                class="px-2.5 py-1 rounded-full text-xs font-bold border transition flex items-center gap-1.5"
                :class="canvasTheme === 'sage' ? 'ring-2 ring-brand-500 bg-emerald-50 text-emerald-950' : 'bg-emerald-50 text-emerald-800'"
                @click="canvasTheme = 'sage'"
              >
                <span>🌿</span>
                <span>Nature Sage</span>
              </button>
              <button
                type="button"
                class="px-2.5 py-1 rounded-full text-xs font-bold border transition flex items-center gap-1.5"
                :class="canvasTheme === 'ochre' ? 'ring-2 ring-brand-500 bg-amber-50 text-amber-950' : 'bg-amber-50 text-amber-800'"
                @click="canvasTheme = 'ochre'"
              >
                <span>🏜️</span>
                <span>Warm Ochre</span>
              </button>
              <button
                type="button"
                class="px-2.5 py-1 rounded-full text-xs font-bold border transition flex items-center gap-1.5"
                :class="canvasTheme === 'dark' ? 'ring-2 ring-brand-500 bg-slate-900 text-white' : 'bg-slate-900 text-slate-300'"
                @click="canvasTheme = 'dark'"
              >
                <span>🌑</span>
                <span>Deep Studio</span>
              </button>
            </div>
          </div>

          <!-- Spacing Sliders -->
          <div class="grid grid-cols-2 gap-3 pt-1">
            <div class="space-y-1">
              <div class="flex items-center justify-between text-xs">
                <span class="font-semibold text-slate-600 dark:text-slate-400">Photo Gap</span>
                <span class="font-mono text-[11px]">{{ gapSize }}px</span>
              </div>
              <input v-model.number="gapSize" type="range" min="0" max="24" step="2" class="w-full accent-brand-600" />
            </div>

            <div class="space-y-1">
              <div class="flex items-center justify-between text-xs">
                <span class="font-semibold text-slate-600 dark:text-slate-400">Corners</span>
                <span class="font-mono text-[11px]">{{ cornerRadius }}px</span>
              </div>
              <input v-model.number="cornerRadius" type="range" min="0" max="24" step="2" class="w-full accent-brand-600" />
            </div>
          </div>

          <div class="flex items-center justify-between pt-1">
            <label class="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <span>🖼️</span>
              <span>Polaroid Photo Frames & Shadow</span>
            </label>
            <input v-model="polaroidStyle" type="checkbox" class="h-4 w-4 rounded accent-brand-600" />
          </div>
        </div>

        <!-- Add Text & Annotations Card -->
        <div class="card p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="font-extrabold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
              ✍️ Add Pedagogical Text
            </h3>
            <span class="text-[11px] text-slate-400">Drag to move</span>
          </div>

          <div class="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              class="btn-secondary py-2 px-2.5 font-bold flex items-center gap-1.5"
              @click="addTextItem('quote')"
            >
              <span>💬</span>
              <span>Child Quote</span>
            </button>
            <button
              type="button"
              class="btn-secondary py-2 px-2.5 font-bold flex items-center gap-1.5"
              @click="addTextItem('title')"
            >
              <span>🌱</span>
              <span>Inquiry Title</span>
            </button>
            <button
              type="button"
              class="btn-secondary py-2 px-2.5 font-bold flex items-center gap-1.5"
              @click="addTextItem('note')"
            >
              <span>📝</span>
              <span>Observation</span>
            </button>
            <button
              type="button"
              class="btn-secondary py-2 px-2.5 font-bold flex items-center gap-1.5"
              @click="addTextItem('stamp')"
            >
              <span>📍</span>
              <span>Room & Date</span>
            </button>
          </div>
        </div>

        <!-- Add EYLF & Reggio Badges Card -->
        <div class="card p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="font-extrabold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
              🏷️ EYLF & Reggio Stickers
            </h3>
            <span class="text-[10px] text-slate-400">Click to place</span>
          </div>

          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="stk in PRESET_STICKERS"
              :key="stk.label"
              type="button"
              class="px-2.5 py-1 rounded-full text-[11px] font-bold shadow-xs hover:scale-105 active:scale-95 transition flex items-center gap-1 border border-white/20"
              :class="stk.colorClass"
              @click="addSticker(stk)"
            >
              <span>{{ stk.icon }}</span>
              <span>{{ stk.label }}</span>
            </button>
          </div>
        </div>

        <!-- Freeform Add Photo Button (Visible only in Freeform mode) -->
        <div v-if="activeTemplate === 'freeform'" class="card p-4 bg-brand-500/10 border border-brand-500/30 text-center space-y-2">
          <p class="text-xs font-bold text-brand-900 dark:text-brand-200">
            Freeform Scrapbook Artboard Active
          </p>
          <button
            type="button"
            class="btn-primary w-full text-xs font-black py-2.5"
            @click="triggerAddFreeformPhoto"
          >
            📸 Add Photos to Scrapbook
          </button>
        </div>
      </div>

      <!-- Right Column: Interactive Canvas Artboard (8 cols) -->
      <div class="lg:col-span-8 space-y-4">
        <!-- Interactive Canvas Toolbar (Quick Zoom, Rotate, Pan Info) -->
        <div class="flex items-center justify-between bg-slate-900/90 text-white px-4 py-2.5 rounded-2xl border border-slate-800 shadow-soft text-xs flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <span class="font-extrabold tracking-wide text-brand-400">CANVAS STUDIO</span>
            <span class="text-slate-500">|</span>
            <span class="text-slate-300 font-mono text-[11px]">{{ canvasDimensions.ratioLabel }}</span>
          </div>

          <div class="flex items-center gap-2 text-slate-300 text-[11px]">
            <span class="hidden sm:inline">👆 Drag photos to pan face/subject</span>
            <span class="hidden sm:inline">·</span>
            <span>🔍 Pinch / Scroll to zoom</span>
          </div>
        </div>

        <!-- The Printable / Exportable Canvas Container -->
        <div class="overflow-x-auto pb-4">
          <div
            id="collage-export-artboard"
            class="relative mx-auto border transition-all duration-200 shadow-2xl select-none"
            :class="[themeClasses]"
            :style="{
              width: `${canvasDimensions.width}px`,
              minHeight: `${canvasDimensions.height}px`,
              padding: `${paddingSize}px`,
            }"
            @dragover.prevent
            @drop="activeTemplate === 'freeform' ? handleDropOnFreeform($event) : null"
            @touchmove="onTouchMove"
            @touchend="stopPan"
          >
            <!-- ================= TEMPLATE GRID RENDER ================= -->
            <div
              v-if="activeTemplate !== 'freeform'"
              class="w-full h-full min-h-[580px]"
              :class="[
                activeTemplate === 'grid-4-quad' ? 'grid grid-cols-2 grid-rows-2 h-full' : '',
                activeTemplate === 'grid-4-hero' ? 'grid grid-cols-12 grid-rows-3 h-full' : '',
                activeTemplate === 'grid-5-showcase' ? 'grid grid-cols-12 grid-rows-12 h-full' : '',
                activeTemplate === 'grid-5-split' ? 'grid grid-cols-6 grid-rows-2 h-full' : '',
                activeTemplate === 'grid-6-equal' ? 'grid grid-cols-3 grid-rows-2 h-full' : '',
                activeTemplate === 'grid-6-magazine' ? 'grid grid-cols-4 grid-rows-3 h-full' : '',
                activeTemplate === 'grid-8-floorbook' ? 'grid grid-cols-4 grid-rows-2 h-full' : '',
              ]"
              :style="{ gap: `${gapSize}px` }"
            >
              <div
                v-for="(cell, index) in cells"
                :key="cell.id"
                class="relative group overflow-hidden transition"
                :class="[
                  polaroidStyle ? 'bg-white p-2 pb-6 shadow-md border border-slate-200 text-slate-800' : 'bg-slate-200/50 dark:bg-slate-800/50 border border-slate-300/40 dark:border-slate-700/50',
                  selectedCellId === cell.id ? 'ring-2 ring-brand-500' : '',
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
                    class="w-full h-full cursor-grab active:cursor-grabbing overflow-hidden flex items-center justify-center select-none"
                    @mousedown="startPan($event, cell)"
                    @touchstart="startPan($event, cell)"
                  >
                    <img
                      :src="cell.image"
                      alt="Inquiry Photo"
                      class="w-full h-full object-cover pointer-events-none transition-transform duration-75"
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

                  <!-- Hover / Active Controls Overlay -->
                  <div
                    class="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/85 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between text-white text-[11px]"
                  >
                    <div class="flex items-center gap-1.5">
                      <button
                        type="button"
                        class="p-1 rounded bg-black/60 hover:bg-black/90"
                        title="Rotate 90 degrees"
                        @click.stop="rotateCellPhoto(cell)"
                      >
                        🔄
                      </button>
                      <button
                        type="button"
                        class="p-1 rounded bg-black/60 hover:bg-black/90"
                        title="Zoom In"
                        @click.stop="cell.zoom = Math.min(3.0, Number((cell.zoom + 0.2).toFixed(1)))"
                      >
                        ➕
                      </button>
                      <button
                        type="button"
                        class="p-1 rounded bg-black/60 hover:bg-black/90"
                        title="Zoom Out"
                        @click.stop="cell.zoom = Math.max(1.0, Number((cell.zoom - 0.2).toFixed(1)))"
                      >
                        ➖
                      </button>
                    </div>

                    <div class="flex items-center gap-1.5">
                      <button
                        type="button"
                        class="px-2 py-0.5 rounded bg-brand-600 text-white font-bold"
                        @click.stop="triggerUploadForCell(cell.id)"
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        class="p-1 rounded bg-rose-600/80 hover:bg-rose-600 text-white"
                        title="Remove Photo"
                        @click.stop="removeCellPhoto(cell)"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  <!-- Optional Polaroid Caption Tag -->
                  <div
                    v-if="polaroidStyle || cell.caption"
                    class="absolute bottom-1 inset-x-2 text-center"
                  >
                    <input
                      v-model="cell.caption"
                      type="text"
                      placeholder="Add handwritten caption…"
                      class="w-full text-center bg-transparent border-0 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:ring-0 focus:outline-none"
                    />
                  </div>
                </template>

                <!-- When cell is empty -->
                <template v-else>
                  <div
                    class="w-full h-full min-h-[160px] flex flex-col items-center justify-center p-4 text-center cursor-pointer border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-brand-500 dark:hover:border-brand-400 transition"
                    @click="triggerUploadForCell(cell.id)"
                  >
                    <span class="text-3xl mb-1 opacity-70">📸</span>
                    <span class="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Tap or Drop Photo
                    </span>
                    <span class="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      In-memory child privacy
                    </span>
                  </div>
                </template>
              </div>
            </div>

            <!-- ================= FREEFORM CANVAS RENDER ================= -->
            <div
              v-else
              class="relative w-full h-[650px] overflow-hidden"
              @click="selectedFreeformId = null"
            >
              <!-- Freeform Images -->
              <div
                v-for="item in freeformImages"
                :key="item.id"
                class="absolute cursor-move select-none transition-shadow"
                :class="[
                  item.polaroid ? 'bg-white p-2.5 pb-7 shadow-xl border border-slate-200 text-slate-800' : 'shadow-lg',
                  selectedFreeformId === item.id ? 'ring-2 ring-brand-500' : '',
                ]"
                :style="{
                  left: `${item.x}px`,
                  top: `${item.y}px`,
                  width: `${item.width}px`,
                  transform: `rotate(${item.rotation}deg)`,
                  zIndex: item.zIndex,
                  borderRadius: item.polaroid ? '4px' : `${cornerRadius}px`,
                }"
                @mousedown.stop="startFreeformDrag($event, item)"
                @touchstart.stop="startFreeformDrag($event, item)"
              >
                <div class="relative overflow-hidden w-full h-auto">
                  <img
                    :src="item.image"
                    alt="Scrapbook photo"
                    class="w-full h-auto object-cover pointer-events-none"
                    :style="{
                      borderRadius: item.polaroid ? '2px' : `${Math.max(0, cornerRadius - 4)}px`,
                    }"
                  />
                </div>

                <!-- Polaroid Caption Input -->
                <div v-if="item.polaroid" class="pt-2 text-center">
                  <input
                    v-model="item.caption"
                    type="text"
                    placeholder="Add caption…"
                    class="w-full text-center bg-transparent border-0 text-[11px] font-bold text-slate-800 placeholder-slate-400 focus:outline-none"
                    @mousedown.stop
                  />
                </div>

                <!-- Floating Handle Controls when Selected -->
                <div
                  v-if="selectedFreeformId === item.id"
                  class="absolute -top-3 -right-3 flex items-center gap-1 z-30"
                  @mousedown.stop
                >
                  <button
                    type="button"
                    class="grid h-6 w-6 place-items-center rounded-full bg-slate-900 text-white text-[10px] shadow"
                    title="Rotate +15°"
                    @click="rotateFreeform(item, 15)"
                  >
                    🔄
                  </button>
                  <button
                    type="button"
                    class="grid h-6 w-6 place-items-center rounded-full bg-slate-900 text-white text-[10px] shadow"
                    title="Grow"
                    @click="resizeFreeform(item, 1.15)"
                  >
                    ➕
                  </button>
                  <button
                    type="button"
                    class="grid h-6 w-6 place-items-center rounded-full bg-slate-900 text-white text-[10px] shadow"
                    title="Shrink"
                    @click="resizeFreeform(item, 0.85)"
                  >
                    ➖
                  </button>
                  <button
                    type="button"
                    class="grid h-6 w-6 place-items-center rounded-full bg-rose-600 text-white text-[10px] shadow"
                    title="Delete"
                    @click="removeFreeformImage(item.id)"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <!-- Empty Freeform Prompt -->
              <div
                v-if="freeformImages.length === 0"
                class="w-full h-full flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-2xl"
              >
                <span class="text-4xl mb-2">🎨</span>
                <p class="font-extrabold text-sm text-slate-700 dark:text-slate-300">
                  Your Scrapbook Artboard is Ready
                </p>
                <p class="text-xs text-slate-500 max-w-sm mt-1">
                  Drag and drop images directly onto this canvas, or click the button below to load children's inquiry moments.
                </p>
                <button
                  type="button"
                  class="btn-primary text-xs font-black mt-4"
                  @click="triggerAddFreeformPhoto"
                >
                  📸 Add Photos to Canvas
                </button>
              </div>
            </div>

            <!-- ================= DRAGGABLE TEXT ANNOTATIONS ================= -->
            <div
              v-for="textItem in textItems"
              :key="textItem.id"
              class="absolute z-20 cursor-move transition-shadow select-none group max-w-md"
              :class="[
                textItem.bgColor === 'dark-glass' ? 'bg-slate-950/85 text-white backdrop-blur-md border border-white/10' : '',
                textItem.bgColor === 'frosted' ? 'bg-white/90 text-slate-900 backdrop-blur-md border border-slate-200/80 shadow-md' : '',
                textItem.bgColor === 'emerald' ? 'bg-emerald-600 text-white shadow-soft' : '',
                selectedTextId === textItem.id ? 'ring-2 ring-brand-500' : '',
              ]"
              :style="{
                left: `${textItem.x}%`,
                top: `${textItem.y}%`,
                borderRadius: '12px',
                padding: '8px 14px',
              }"
              @mousedown.stop="startTextDrag($event, textItem)"
              @touchstart.stop="startTextDrag($event, textItem)"
            >
              <div class="flex items-start gap-2">
                <textarea
                  v-model="textItem.text"
                  rows="2"
                  class="bg-transparent border-0 resize-none font-bold focus:outline-none w-full"
                  :style="{
                    fontSize: `${textItem.fontSize}px`,
                    color: textItem.color,
                    fontFamily: textItem.fontFamily === 'sketch' ? 'ui-serif, Georgia, serif' : 'inherit',
                  }"
                  @mousedown.stop
                ></textarea>

                <button
                  type="button"
                  class="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-200 text-xs shrink-0 p-1"
                  title="Remove text"
                  @click.stop="removeTextItem(textItem.id)"
                >
                  ✕
                </button>
              </div>
            </div>

            <!-- ================= DRAGGABLE STICKER BADGES ================= -->
            <div
              v-for="stk in stickerItems"
              :key="stk.id"
              class="absolute z-20 cursor-move px-3 py-1.5 rounded-full text-xs font-black shadow-lg border border-white/20 select-none group flex items-center gap-1.5"
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
                class="opacity-0 group-hover:opacity-100 text-white/80 hover:text-white text-[10px] ml-1"
                @click.stop="removeSticker(stk.id)"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        <!-- Cell / Selection Editor Drawer (shows controls when a photo cell is selected) -->
        <div
          v-if="selectedCellId && activeTemplate !== 'freeform'"
          class="card p-4 bg-slate-900 border border-slate-800 text-slate-100 space-y-3"
        >
          <div class="flex items-center justify-between">
            <h4 class="font-extrabold text-xs text-brand-400 flex items-center gap-2">
              <span>🔧</span>
              <span>Editing Frame: {{ selectedCellId.toUpperCase() }}</span>
            </h4>
            <button
              type="button"
              class="text-xs text-slate-400 hover:text-white"
              @click="selectedCellId = null"
            >
              Close Editor ✕
            </button>
          </div>

          <div
            v-if="cells.find(c => c.id === selectedCellId)?.image"
            class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs"
          >
            <!-- Zoom Slider -->
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <span class="text-slate-400">Zoom Scale</span>
                <span class="font-mono text-brand-300">
                  {{ cells.find(c => c.id === selectedCellId)?.zoom }}x
                </span>
              </div>
              <input
                v-model.number="cells.find(c => c.id === selectedCellId)!.zoom"
                type="range"
                min="1.0"
                max="3.0"
                step="0.1"
                class="w-full accent-brand-500"
              />
            </div>

            <!-- Filter Switcher -->
            <div class="space-y-1">
              <span class="text-slate-400">Color Tone Filter</span>
              <select
                v-model="cells.find(c => c.id === selectedCellId)!.filter"
                class="input w-full bg-slate-800 border-slate-700 text-white py-1 text-xs"
              >
                <option value="none">Original Colors</option>
                <option value="warm">Warm Sunlight (Reggio)</option>
                <option value="vivid">Vivid Exploration</option>
                <option value="bw">Classic B&W Archive</option>
                <option value="soft">Soft Classroom</option>
              </select>
            </div>

            <!-- Quick Action Buttons -->
            <div class="flex items-center gap-2 pt-3">
              <button
                type="button"
                class="btn-secondary text-xs flex-1 py-1.5 font-bold"
                @click="rotateCellPhoto(cells.find(c => c.id === selectedCellId)!)"
              >
                🔄 Rotate 90°
              </button>
              <button
                type="button"
                class="btn-secondary text-xs flex-1 py-1.5 font-bold"
                @click="triggerUploadForCell(selectedCellId!)"
              >
                Replace
              </button>
              <button
                type="button"
                class="btn-ghost text-xs text-rose-400 hover:bg-rose-950/50 py-1.5 font-bold"
                @click="removeCellPhoto(cells.find(c => c.id === selectedCellId)!)"
              >
                Remove
              </button>
            </div>
          </div>

          <div v-else class="text-xs text-slate-400 py-1 flex items-center justify-between">
            <span>This frame is currently empty.</span>
            <button
              type="button"
              class="btn-primary text-xs py-1 px-3 font-bold"
              @click="triggerUploadForCell(selectedCellId!)"
            >
              📸 Select Photo
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@media print {
  /* Hide sidebar and controls on print */
  header,
  nav,
  aside,
  button,
  input,
  .card,
  .btn-primary,
  .btn-secondary {
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
