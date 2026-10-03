import type { ReggioPrinciple } from '@/types'

/**
 * Core principles of the Reggio Emilia Approach (Reggio Children).
 * Used by the Reggio lens panel and available to the AI assistant.
 */
export const REGGIO_PRINCIPLES: ReggioPrinciple[] = [
  {
    id: 'image-of-child',
    title: 'The image of the child',
    description:
      'Every child is rich, strong, capable and full of potential — a citizen with rights, not an empty vessel to be filled.',
    inPractice: [
      'Ask "what is this child capable of?" rather than "what can’t they do yet?"',
      'Invite children into real decisions about the room and the program.',
      'Record children’s own theories in their words.',
    ],
  },
  {
    id: 'hundred-languages',
    title: 'The hundred languages',
    description:
      'Children have many ways of expressing thinking — words, drawing, clay, wire, light, shadow, movement, music, digital media.',
    inPractice: [
      'Offer at least three symbolic media for any one idea.',
      'Keep a well-stocked atelier with clay, wire, light table and natural materials.',
      'Display the process, not only the finished product.',
    ],
  },
  {
    id: 'environment-third-teacher',
    title: 'The environment as third teacher',
    description:
      'Alongside educators and families, the physical environment teaches through light, order, beauty, provocation and documentation.',
    inPractice: [
      'Audit light, mirrors, natural materials, plants and softness.',
      'Create inviting, clearly defined areas with visible materials.',
      'Show children’s work at child height, beautifully framed.',
    ],
  },
  {
    id: 'documentation',
    title: 'Pedagogical documentation',
    description:
      'Photos, transcripts, work samples and educator notes make learning visible and become a shared object of interpretation with children, families and colleagues.',
    inPractice: [
      'Photograph the process and transcribe children’s words verbatim.',
      'Write short interpretive notes next to the evidence.',
      'Revisit documentation with children and families to plan next steps.',
    ],
  },
  {
    id: 'emergent-curriculum',
    title: 'Emergent curriculum & progettazione',
    description:
      'Projects emerge from children’s own questions and hypotheses. Planning is a flexible hypothesis, not a fixed timetable.',
    inPractice: [
      'Begin from a documented interest or a surprising question.',
      'Write a "project hypothesis" you are willing to change.',
      'Follow the children rather than a theme calendar.',
    ],
  },
  {
    id: 'relationships',
    title: 'Relationships and collegiality',
    description:
      'Learning is built in relationship — between children, educators, families and the wider community. Educators work collegially, not alone.',
    inPractice: [
      'Co-plan and debrief as a team; keep a shared planning notebook.',
      'Use "co-teaching" and shared observation when possible.',
      'Build a genuine, two-way partnership with each family.',
    ],
  },
  {
    id: 'participation',
    title: 'Family and community participation',
    description:
      'Families are essential, not peripheral. Their knowledge of their child shapes the program.',
    inPractice: [
      'Invite families to share skills, stories, languages and recipes.',
      'Share documentation regularly, and invite written responses.',
      'Hold celebratory events that families help design.',
    ],
  },
  {
    id: 'teacher-researcher',
    title: 'The teacher as researcher',
    description:
      'Educators research alongside children — observing closely, forming hypotheses, testing and reflecting with colleagues.',
    inPractice: [
      'Keep a reflective journal of "wonderings".',
      'Meet weekly to analyse a piece of documentation together.',
      'Treat surprises in the room as data, not interruptions.',
    ],
  },
]

export const REGGIO_QUOTE = {
  text: `No way. The hundred is there.
The child is made of one hundred.
The child has a hundred languages,
a hundred hands, a hundred thoughts,
a hundred ways of thinking, of playing, of speaking.`,
  author: 'Loris Malaguzzi',
  source: '"No way. The hundred is there." (1993)',
}

/** Practical "today" checklist for strengthening a Reggio-inspired room. */
export const REGGIO_ROOM_AUDIT = [
  'Is there natural light, and can children see outside?',
  'Are mirrors placed where children can see themselves and their work?',
  'Are natural and open-ended materials available and beautiful?',
  'Is children’s work displayed at child height, with their words?',
  'Is there a dedicated "atelier" or studio space for symbolic work?',
  'Do the areas invite sustained, uninterrupted play?',
  'Can children find and return materials independently?',
  'Is there evidence of documentation being revisited with children?',
]