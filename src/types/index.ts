// ---------------------------------------------------------------------------
// Shared domain types for the Hadfield Inquiry Planner
// ---------------------------------------------------------------------------

export type EylfOutcomeId = 1 | 2 | 3 | 4 | 5

export interface EylfSubOutcome {
  id: string
  text: string
  /** Observation prompts — what an educator might look for. */
  lookFor: string[]
}

export interface EylfOutcome {
  id: EylfOutcomeId
  title: string
  shortTitle: string
  summary: string
  /** Tailwind colour token used for chips/cards. */
  color: string
  emoji: string
  subOutcomes: EylfSubOutcome[]
}

export interface TheoryLink {
  theoryId: string
  note?: string
}

export interface Theory {
  id: string
  name: string
  years: string
  tradition: string
  summary: string
  keyConcepts: { term: string; definition: string }[]
  inPractice: string[]
  eylfLinks: EylfOutcomeId[]
  references: string[]
}

export interface ReggioPrinciple {
  id: string
  title: string
  description: string
  inPractice: string[]
}

export type NodeType = 'theme' | 'question' | 'activity' | 'resource' | 'theory' | 'outcome'

/** Fields every persisted row carries. */
export interface Persisted {
  id: string
  user_id: string
  centre_name?: string
  created_at: string
  updated_at: string
  /** Loose access used by the repository's generic filters/sorts. */
  [key: string]: unknown
}

export interface MindMapNode extends Persisted {
  project_id: string
  parent_id: string | null
  text: string
  note: string | null
  node_type: NodeType
  color: string | null
  sort_order: number
}

export interface Project extends Persisted {
  title: string
  description: string | null
  inquiry_question: string | null
  age_group: string | null
  room: string | null
  status: 'planning' | 'active' | 'reflecting' | 'archived'
  eylf_outcome_ids: EylfOutcomeId[]
  theory_ids: string[]
}

export interface LearningStory extends Persisted {
  project_id: string | null
  child_name: string
  title: string
  setting: string | null
  narrative: string
  analysis: string | null
  educator_reflection: string | null
  next_steps: string | null
  family_link?: string | null
  educator_name?: string | null
  eylf_outcome_ids: EylfOutcomeId[]
  theory_ids: string[]
  photo_urls: string[]
  story_date: string
}

export interface Activity extends Persisted {
  project_id: string | null
  title: string
  description: string | null
  learning_intentions: string | null
  success_criteria: string | null
  extension_ideas: string | null
  eylf_outcome_ids: EylfOutcomeId[]
  theory_ids: string[]
  resources: string | null
  room?: string | null
  experience_type?: 'group' | 'inquiry' | 'intentional' | 'spontaneous'
  date?: string | null
  photo_urls?: string[]
  educator_name?: string | null
}

export interface Newsletter extends Persisted {
  title: string
  content: string
  term: string | null
  date_from: string | null
  date_to: string | null
  eylf_outcome_ids: EylfOutcomeId[]
  highlights: string[] | null
}

/** One room's Weekly Wrap-Up draft (Mon–Fri notes + compiled result). */
export interface WeeklyWrapUp extends Persisted {
  room: string
  /** YYYY-MM-DD of the Monday (storage key). */
  week_start: string
  /** Raw daily jot notes, keyed mon…fri. */
  days: Record<string, string>
  /** Reminders, one per line. */
  reminders: string
  /** Lost & found items, one per line. */
  lost_found: string
  /** Extra message / announcement. */
  extra_message: string
  /** The AI-compiled wrap-up text (markdown). */
  result: string
  status: 'draft' | 'generated'
}

export interface ProgramBookAnalysis extends Persisted {
  title: string
  source_text: string
  summary: string | null
  strengths: string[] | null
  gaps: string[] | null
  recommendations: string[] | null
  coverage: Record<string, number> | null
  eylf_outcome_ids: EylfOutcomeId[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: number
  error?: boolean
}

export interface ChatContext {
  /** Short label describing where the chat was opened from. */
  label: string
  /** Raw context passed to the model (truncated server-side). */
  body: string
}

export interface Profile {
  id: string
  full_name: string | null
  centre_name: string | null
  room: string | null
  role: string | null
  created_at: string
  updated_at: string
}

export type TeacherRole =
  | 'Centre Director'
  | 'Educational Leader'
  | 'Early Childhood Teacher'
  | 'Room Leader'
  | 'Educator'
  | 'Relief Educator'

export type TeacherAccessStatus = 'active' | 'invited' | 'suspended'

export interface TeacherAccess extends Persisted {
  email: string
  name: string
  role: TeacherRole
  room: string
  status: TeacherAccessStatus
  centre_name?: string
  password?: string
  is_admin?: boolean
  notes?: string
  invited_at?: string
  last_active_at?: string
}

export type TopicStatus = 'active' | 'under_development' | 'beta' | 'disabled'

export interface TopicModuleStatus extends Persisted {
  topic_key: string
  title: string
  icon: string
  route_path: string
  status: TopicStatus
  leadership_notes: string
  target_release_date?: string
  affected_rooms?: string[]
}

export interface RoomRecord extends Persisted {
  name: string
  description?: string
  sort_order?: number
  is_active?: boolean
}

export type SessionStatus = 'loading' | 'authenticated' | 'unauthorized' | 'unauthenticated'


