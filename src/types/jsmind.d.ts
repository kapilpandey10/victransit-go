// Minimal type declarations for the `jsmind` package (ships without types).
declare module 'jsmind' {
  export interface MindNode {
    id: string
    topic: string
    expanded?: boolean
    direction?: number
    background_color?: string
    foreground_color?: string
    children?: MindNode[]
    [key: string]: unknown
  }

  export interface MindData {
    meta?: { name?: string; author?: string; version?: string }
    format?: 'node_tree' | 'node_array' | 'freemind'
    data: MindNode | MindNode[]
  }

  export interface JsMindOptions {
    container: string | HTMLElement
    editable?: boolean
    theme?: string | null
    mode?: 'full' | 'side'
    support_html?: boolean
    view?: {
      engine?: 'canvas' | 'svg'
      hmargin?: number
      vmargin?: number
      line_width?: number
      line_color?: string
      draggable?: boolean
      hide_scrollbar?: boolean
      zoom?: number
    }
    layout?: { hspace?: number; vspace?: number; pspace?: number }
    shortcut?: { enable?: boolean }
  }

  export interface JsMindNode {
    id: string
    topic: string
    parent: JsMindNode | null
    children: JsMindNode[]
    isroot: boolean
    [key: string]: unknown
  }

  export default class jsMind {
    constructor(options: JsMindOptions)
    show(mind: MindData): void
    get_data(format?: 'node_tree' | 'node_array'): MindData
    add_node(
      parentNode: JsMindNode,
      nodeId: string,
      topic: string,
      data?: Record<string, unknown>,
    ): JsMindNode | null
    remove_node(node: JsMindNode): void
    get_node(nodeId: string): JsMindNode | null
    get_selected_node(): JsMindNode | null
    select_node(node: JsMindNode | null): void
    update_node(node: JsMindNode): void
    expand_all(): void
    expand_node(node: JsMindNode): void
    set_theme(theme: string): void
    add_event_listener(fn: (node?: JsMindNode) => void, type: string): void
    remove_event_listener(fn: (node?: JsMindNode) => void, type: string): void
    enable_edit(): void
    disable_edit(): void
    destroy?(): void
  }
}
