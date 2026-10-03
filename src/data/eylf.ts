import type { EylfOutcome } from '@/types'

/**
 * EYLF v2.0 (2022, released 2023) — Belonging, Being and Becoming.
 * Five Learning Outcomes with their sub-outcomes and observation prompts.
 *
 * Source: ACECQA — Belonging, Being and Becoming: The Early Years Learning
 * Framework for Australia (V2.0). Outcome wording reproduced for educator
 * reference/planning purposes.
 */
export const EYLF_OUTCOMES: EylfOutcome[] = [
  {
    id: 1,
    title: 'Children have a strong sense of identity',
    shortTitle: 'Identity',
    summary:
      'Children feel safe, secure and supported, and develop autonomy, confidence and respectful relationships.',
    color: 'rose',
    emoji: '🫶',
    subOutcomes: [
      {
        id: '1.1',
        text: 'Children feel safe, secure, and supported',
        lookFor: [
          'Seeks comfort and reassurance from familiar educators',
          'Settles into play after separation from family',
          'Confidently explores the environment when a trusted adult is near',
        ],
      },
      {
        id: '1.2',
        text: 'Children develop their emerging autonomy, inter-dependence, resilience and agency',
        lookFor: [
          'Makes choices and expresses preferences',
          'Attempts a task again after difficulty',
          'Asks for help when needed and offers help to others',
        ],
      },
      {
        id: '1.3',
        text: 'Children develop knowledgeable, confident self-identities and a positive sense of self-worth',
        lookFor: [
          'Talks about own family, culture and interests',
          'Shows pride in own achievements and creations',
          'Recognises own strengths and names them',
        ],
      },
      {
        id: '1.4',
        text: 'Children learn to interact in relation to others with care, empathy and respect',
        lookFor: [
          'Comforts a distressed peer',
          'Takes turns and negotiates fairly',
          'Notices and respects differences in others',
        ],
      },
    ],
  },
  {
    id: 2,
    title: 'Children are connected with and contribute to their world',
    shortTitle: 'Connectedness',
    summary:
      'Children develop a sense of belonging to groups and communities and understand their rights and responsibilities.',
    color: 'sky',
    emoji: '🌏',
    subOutcomes: [
      {
        id: '2.1',
        text: 'Children develop a sense of connectedness to groups and communities and an understanding of their reciprocal rights and responsibilities as active and informed citizens',
        lookFor: [
          'Participates in group routines and rituals',
          'Talks about roles within the family and community',
          'Follows agreed rules and helps shape them',
        ],
      },
      {
        id: '2.2',
        text: 'Children respond to diversity with respect',
        lookFor: [
          'Shows curiosity about languages, foods and traditions',
          'Uses inclusive language about families and abilities',
          'Asks respectful questions about difference',
        ],
      },
      {
        id: '2.3',
        text: 'Children become aware of fairness',
        lookFor: [
          'Names unfairness and offers solutions',
          'Includes others in play',
          'Shares resources equitably',
        ],
      },
      {
        id: '2.4',
        text: 'Children become socially responsible and show respect for the environment',
        lookFor: [
          'Cares for plants, animals and materials',
          'Sorts waste and reuses resources',
          'Notices and acts on environmental problems',
        ],
      },
    ],
  },
  {
    id: 3,
    title: 'Children have a strong sense of wellbeing',
    shortTitle: 'Wellbeing',
    summary:
      'Children become strong in their social, emotional, physical and mental wellbeing.',
    color: 'amber',
    emoji: '🌱',
    subOutcomes: [
      {
        id: '3.1',
        text: 'Children become strong in their social, emotional and mental wellbeing',
        lookFor: [
          'Names a range of feelings',
          'Uses calming strategies independently',
          'Builds and maintains friendships',
        ],
      },
      {
        id: '3.2',
        text: 'Children become strong in their physical learning and wellbeing',
        lookFor: [
          'Takes calculated physical risks in play',
          'Develops fine and gross motor control',
          'Enjoys movement, dance and outdoor challenge',
        ],
      },
      {
        id: '3.3',
        text: 'Children are aware of and develop strategies to support their own mental and physical health and personal safety',
        lookFor: [
          'Talks about healthy food, rest and activity',
          'Names safe/unsafe situations and seeks help',
          'Understands body autonomy and consent',
        ],
      },
    ],
  },
  {
    id: 4,
    title: 'Children are confident and involved learners',
    shortTitle: 'Learning',
    summary:
      'Children develop dispositions for learning such as curiosity, cooperation, confidence, creativity, commitment, enthusiasm, persistence, imagination and reflexivity.',
    color: 'violet',
    emoji: '💡',
    subOutcomes: [
      {
        id: '4.1',
        text: 'Children develop a growth mindset and learning dispositions such as curiosity, cooperation, confidence, creativity, commitment, enthusiasm, persistence, imagination and reflexivity',
        lookFor: [
          'Persists with a challenge over time',
          'Tries a new strategy after failure',
          'Invites others into an investigation',
        ],
      },
      {
        id: '4.2',
        text: 'Children develop a range of learning and thinking skills and processes such as problem-solving, inquiry, experimentation, hypothesising, researching and investigating',
        lookFor: [
          'Asks investigable questions',
          'Uses trial and error to test an idea',
          'Represents thinking through drawing, writing, building',
        ],
      },
      {
        id: '4.3',
        text: 'Children transfer and adapt what they have learned from one context to another',
        lookFor: [
          'Applies a known strategy in a new setting',
          'Connects a previous project to a new interest',
          'Teaches a peer a skill learned elsewhere',
        ],
      },
      {
        id: '4.4',
        text: 'Children resource their own learning through connecting with people, places, technologies and natural and processed materials',
        lookFor: [
          'Chooses appropriate tools and materials',
          'Asks an expert or uses a book/device to find out',
          'Repurposes loose parts inventively',
        ],
      },
    ],
  },
  {
    id: 5,
    title: 'Children are effective communicators',
    shortTitle: 'Communication',
    summary:
      'Children interact verbally and non-verbally, engage with texts and express ideas using a range of media.',
    color: 'emerald',
    emoji: '💬',
    subOutcomes: [
      {
        id: '5.1',
        text: 'Children interact verbally and non-verbally with others for a range of purposes',
        lookFor: [
          'Initiates and sustains conversation',
          'Uses gesture, sign or AAC to communicate',
          'Adjusts language for different listeners',
        ],
      },
      {
        id: '5.2',
        text: 'Children engage with a range of texts and gain meaning from these texts',
        lookFor: [
          'Retells a story in sequence',
          'Asks questions about a text',
          'Chooses books and information sources purposefully',
        ],
      },
      {
        id: '5.3',
        text: 'Children express ideas and make meaning using a range of media',
        lookFor: [
          'Uses paint, clay, movement, music or drama to express an idea',
          'Combines media in a representation',
          'Explains own artwork to others',
        ],
      },
      {
        id: '5.4',
        text: 'Children begin to understand how symbols and pattern systems work',
        lookFor: [
          'Recognises own name and familiar logos',
          'Explores pattern, rhythm and mathematical symbols',
          'Uses marks and letters with intent',
        ],
      },
      {
        id: '5.5',
        text: 'Children use digital technologies and media to access information, investigate ideas and represent their thinking',
        lookFor: [
          'Uses a device to research a question',
          'Captures photos to document an investigation',
          'Creates digital art or recordings',
        ],
      },
    ],
  },
]

export const EYLF_PRINCIPLES: { title: string; description: string }[] = [
  {
    title: 'Secure, respectful and reciprocal relationships',
    description:
      'Educators build trusting relationships with children, families and each other.',
  },
  {
    title: 'Partnerships',
    description:
      'Educators work in partnership with families and communities, valuing their knowledge.',
  },
  {
    title: 'Respect for diversity',
    description:
      'Educators value and reflect the diversity of children, families and communities.',
  },
  {
    title: 'Aboriginal and Torres Strait Islander perspectives',
    description:
      'Educators embed Aboriginal and Torres Strait Islander ways of knowing, being and doing.',
  },
  {
    title: 'Equity, inclusion and high expectations',
    description:
      'Educators hold high expectations for all children and remove barriers to learning.',
  },
  {
    title: 'Sustainability',
    description:
      'Educators support children to understand and act on environmental and social sustainability.',
  },
  {
    title: 'Critical reflection and ongoing professional learning',
    description:
      'Educators critically reflect on practice and engage in ongoing professional learning.',
  },
  {
    title: 'Collaborative leadership and teamwork',
    description:
      'Educators work collaboratively, sharing leadership and decision-making.',
  },
]

export const EYLF_PRACTICES: { title: string; description: string }[] = [
  {
    title: 'Holistic, integrated and interconnected approaches',
    description:
      'Planning that connects children’s physical, social, emotional, personal, spiritual, creative, cognitive and linguistic learning.',
  },
  {
    title: 'Responsiveness to children',
    description:
      'Being attuned to children’s interests, strengths, cues and ideas, and responding intentionally.',
  },
  {
    title: 'Play-based learning and intentionality',
    description:
      'Play is the context for learning; educators act with intentionality within and around play.',
  },
  {
    title: 'Learning environments',
    description:
      'Indoor and outdoor environments and resources that are welcoming, flexible and sustainable.',
  },
  {
    title: 'Cultural responsiveness',
    description:
      'Responsive to the cultural contexts of children, families and communities.',
  },
  {
    title: 'Continuity of learning and transitions',
    description:
      'Supporting children across everyday, routine and significant transitions.',
  },
  {
    title: 'Assessment and evaluation for learning, development and wellbeing',
    description:
      'Gathering, interpreting and using evidence of learning to inform planning.',
  },
]

export const eylfById = (id: number): EylfOutcome | undefined =>
  EYLF_OUTCOMES.find(o => o.id === id)

/** The planning cycle prompts used by the planner dashboard. */
export const PLANNING_CYCLE = [
  {
    step: 'Observe & notice',
    description: 'Notice children’s interests, questions and strengths.',
    outcomeHint: 'Use the Observation quick-capture on the dashboard.',
  },
  {
    step: 'Analyse & make meaning',
    description: 'Connect observations to EYLF outcomes and learning theories.',
    outcomeHint: 'Use the Learning Outcomes tool to map outcomes.',
  },
  {
    step: 'Plan & respond',
    description: 'Design experiences, environments and intentional teaching.',
    outcomeHint: 'Use the Mind Map and Activities planners.',
  },
  {
    step: 'Document & assess',
    description: 'Write learning stories and gather evidence of learning.',
    outcomeHint: 'Use the Learning Story builder.',
  },
  {
    step: 'Reflect & evaluate',
    description: 'Critically reflect on the program and plan next steps.',
    outcomeHint: 'Use the Program Book analysis tool.',
  },
  {
    step: 'Communicate',
    description: 'Share learning with families and the community.',
    outcomeHint: 'Use the Newsletter builder.',
  },
]