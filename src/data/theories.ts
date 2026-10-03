import type { Theory } from '@/types'

/**
 * Learning theory & literature library for early childhood educators.
 * Each entry links back to EYLF v2.0 Learning Outcomes and gives practical,
 * room-ready application notes.
 */
export const THEORIES: Theory[] = [
  {
    id: 'vygotsky',
    name: 'Lev Vygotsky — Sociocultural Theory',
    years: '1896–1934',
    tradition: 'Social constructivism',
    summary:
      'Learning is a social process. Children learn first through interaction with others, then internalise that learning. Thought is shaped by language and culture.',
    keyConcepts: [
      {
        term: 'Zone of Proximal Development (ZPD)',
        definition:
          'The gap between what a child can do alone and what they can do with support. Growth happens in that "sweet spot".',
      },
      {
        term: 'Scaffolding',
        definition:
          'Temporary, responsive support (prompts, modelling, resources) that is gradually withdrawn as competence grows.',
      },
      {
        term: 'More Knowledgeable Other (MKO)',
        definition:
          'Anyone who knows more about the task — a teacher, peer, older sibling, or even a tool/technology.',
      },
      {
        term: 'Private speech',
        definition:
          'Children’s self-talk, which later becomes inner speech and guides planning and problem-solving.',
      },
    ],
    inPractice: [
      'Plan experiences that sit just beyond current independence — ask "what can they nearly do?"',
      'Use open-ended questioning and think-alouds rather than giving answers.',
      'Pair children for peer tutoring and collaborative problem-solving.',
      'Notice and value children’s self-talk as a thinking strategy.',
      'Reduce scaffolds visibly over days/weeks as mastery develops.',
    ],
    eylfLinks: [1, 4, 5],
    references: [
      'Vygotsky, L. S. (1978). Mind in Society: The Development of Higher Psychological Processes. Harvard University Press.',
      'Vygotsky, L. S. (1934/1986). Thought and Language. MIT Press.',
      'Wood, D., Bruner, J. S., & Ross, G. (1976). The role of tutoring in problem solving. Journal of Child Psychology and Psychiatry, 17(2), 89–100.',
    ],
  },
  {
    id: 'piaget',
    name: 'Jean Piaget — Cognitive Constructivism',
    years: '1896–1980',
    tradition: 'Cognitive developmental theory',
    summary:
      'Children actively construct knowledge by acting on the world. Thinking develops through four stages: sensorimotor (0–2), preoperational (2–7), concrete operational (7–11), formal operational (11+).',
    keyConcepts: [
      {
        term: 'Schema',
        definition:
          'A mental framework or pattern of repeated action (e.g. transporting, enclosing, rotating, trajectory).',
      },
      {
        term: 'Assimilation',
        definition: 'Fitting new information into an existing schema.',
      },
      {
        term: 'Accommodation',
        definition: 'Changing a schema when new information does not fit.',
      },
      {
        term: 'Equilibration',
        definition:
          'The drive to resolve disequilibrium — the engine of cognitive growth.',
      },
      {
        term: 'Object permanence',
        definition: 'Knowing objects exist when out of sight (sensorimotor stage).',
      },
    ],
    inPractice: [
      'Provide abundant hands-on, sensory and loose-parts play.',
      'Watch for repeated schemas (e.g. wrapping, dropping, stacking) and resource them deliberately.',
      'Introduce "disequilibrium" provocations — a puzzle that does not quite work.',
      'Avoid teaching abstract concepts beyond the preoperational stage; make it concrete.',
      'Use open questioning: "How did you work that out?"',
    ],
    eylfLinks: [3, 4],
    references: [
      'Piaget, J. (1952). The Origins of Intelligence in Children. International Universities Press.',
      'Piaget, J. (1962). Play, Dreams and Imitation in Childhood. Norton.',
      'Athey, C. (2007). Extending Thought in Young Children: A Parent–Teacher Partnership (2nd ed.). Paul Chapman.',
    ],
  },
  {
    id: 'reggio',
    name: 'Loris Malaguzzi — The Reggio Emilia Approach',
    years: '1920–1994',
    tradition: 'Social constructivism / post-structuralist',
    summary:
      'A philosophy, not a method. The child is rich, capable and full of potential — a citizen with rights who learns through a hundred languages in relationship with others.',
    keyConcepts: [
      {
        term: 'The hundred languages of children',
        definition:
          'Children express and construct thinking through many symbolic modes — drawing, clay, light, wire, movement, music, words.',
      },
      {
        term: 'Environment as third teacher',
        definition:
          'The physical space, light, materials and aesthetics teach. Spaces are intentional, beautiful and documented.',
      },
      {
        term: 'Emergent curriculum',
        definition:
          'Projects develop from children’s interests, hypotheses and questions rather than a pre-set topic.',
      },
      {
        term: 'Pedagogical documentation',
        definition:
          'Systematic documentation (photos, transcripts, work samples, educator notes) that makes learning visible and open to interpretation.',
      },
      {
        term: 'The atelier and atelierista',
        definition:
          'A workshop-like studio and an artist-educator who supports symbolic, expressive work.',
      },
      {
        term: 'Progettazione',
        definition:
          'Flexible, hypothesis-driven planning — a direction of travel, not a fixed plan.',
      },
    ],
    inPractice: [
      'Start projects from a documented interest or question, not a theme calendar.',
      'Keep a visible "documentation wall" with transcripts, photos and children’s work.',
      'Offer multiple symbolic languages for the same idea (draw it, build it, move it, narrate it).',
      'Treat the room as a co-teacher — review light, mirrors, natural materials, texture and display.',
      'Leave plans loose so children’s hypotheses can redirect them.',
    ],
    eylfLinks: [1, 2, 4, 5],
    references: [
      'Edwards, C., Gandini, L., & Forman, G. (Eds.). (2012). The Hundred Languages of Children: The Reggio Emilia Experience in Transformation (3rd ed.). Praeger.',
      'Malaguzzi, L. (1993). "No way. The hundred is there." In The Hundred Languages of Children.',
      'Rinaldi, C. (2006). In Dialogue with Reggio Emilia: Listening, Researching and Learning. Routledge.',
      'Dahlberg, G., Moss, P., & Pence, A. (2013). Beyond Quality in Early Childhood Education and Care (3rd ed.). Routledge.',
    ],
  },
  {
    id: 'montessori',
    name: 'Maria Montessori — Prepared Environment',
    years: '1870–1952',
    tradition: 'Developmental / self-directed learning',
    summary:
      'Children have an innate drive to learn. With a carefully prepared environment and freedom within limits, they self-educate through purposeful activity.',
    keyConcepts: [
      {
        term: 'Prepared environment',
        definition:
          'A calm, ordered, accessible space where everything has a place and a purpose.',
      },
      {
        term: 'Sensitive periods',
        definition:
          'Windows of intense readiness for particular learning (order, language, movement, small objects).',
      },
      {
        term: 'Work, not play',
        definition:
          'Children’s self-chosen activity is purposeful "work" that builds concentration.',
      },
      {
        term: 'Practical life',
        definition:
          'Real, meaningful tasks (pouring, sweeping, food preparation) that build independence.',
      },
      {
        term: 'Freedom within limits',
        definition: 'Choice of activity and pace, within clear expectations of care and respect.',
      },
    ],
    inPractice: [
      'Set up open shelves at child height with complete, self-correcting activities.',
      'Use real, child-sized tools for practical life experiences.',
      'Protect long, uninterrupted work cycles rather than hurrying children along.',
      'Observe sensitively for sensitive periods and feed them with matched resources.',
      'Model gentle care of materials and a calm, ordered tone.',
    ],
    eylfLinks: [1, 3, 4],
    references: [
      'Montessori, M. (1949/1995). The Absorbent Mind. Henry Holt.',
      'Montessori, M. (1912). The Montessori Method. Frederick A. Stokes.',
      'Lillard, A. S. (2017). Montessori: The Science Behind the Genius (3rd ed.). Oxford University Press.',
    ],
  },
  {
    id: 'dewey',
    name: 'John Dewey — Experiential Learning',
    years: '1859–1952',
    tradition: 'Pragmatism / progressivism',
    summary:
      'Education is life itself, not preparation for it. Children learn by doing, through purposeful experience connected to their social world and democratic community.',
    keyConcepts: [
      {
        term: 'Learning by doing',
        definition: 'Knowledge grows from active, purposeful experience rather than transmission.',
      },
      {
        term: 'Continuity of experience',
        definition: 'Each experience builds on and reshapes earlier ones.',
      },
      {
        term: 'Interaction',
        definition: 'Learning arises from the interaction between the child and their environment.',
      },
      {
        term: 'Occupations',
        definition:
          'Real-life, meaningful projects (cooking, gardening, building) that connect to community life.',
      },
      {
        term: 'Reflective inquiry',
        definition:
          'A cycle of wondering, investigating, testing and reflecting — the roots of inquiry learning.',
      },
    ],
    inPractice: [
      'Build learning around authentic, real-world projects rather than isolated activities.',
      'Let children cook, garden, repair, build and care for the setting.',
      'Document the "before, during, after" of an experience to show growth over time.',
      'Create a democratic classroom — children help set agreements and routines.',
      'Follow an experience with reflection: "What did we find out?"',
    ],
    eylfLinks: [2, 4],
    references: [
      'Dewey, J. (1916). Democracy and Education. Macmillan.',
      'Dewey, J. (1938). Experience and Education. Kappa Delta Pi.',
    ],
  },
  {
    id: 'bruner',
    name: 'Jerome Bruner — Spiral Curriculum & Scaffolding',
    years: '1915–2016',
    tradition: 'Cognitive constructivism',
    summary:
      'Any subject can be taught in an intellectually honest way to any child. Learning is a spiral — concepts are revisited with growing complexity in three modes of representation.',
    keyConcepts: [
      {
        term: 'Enactive representation',
        definition: 'Learning through action and physical manipulation (0–1 years).',
      },
      {
        term: 'Iconic representation',
        definition: 'Learning through images, pictures and visual models (1–6 years).',
      },
      {
        term: 'Symbolic representation',
        definition: 'Learning through language, symbols and abstract codes (7+ years).',
      },
      {
        term: 'Spiral curriculum',
        definition: 'Revisiting big ideas at increasing levels of depth over time.',
      },
      {
        term: 'Scaffolding',
        definition:
          'Adult support that enables a child to accomplish a task beyond independent capability.',
      },
    ],
    inPractice: [
      'Represent the same idea in action, image and symbol across a project.',
      'Revisit a favourite concept weeks later with a new layer of complexity.',
      'Use visual models, diagrams and story-maps alongside hands-on work.',
      'Gradually hand over control — from modelling, to guided practice, to independence.',
      'Frame learning around big, transferable ideas rather than facts.',
    ],
    eylfLinks: [4, 5],
    references: [
      'Bruner, J. (1960). The Process of Education. Harvard University Press.',
      'Bruner, J. (1966). Toward a Theory of Instruction. Harvard University Press.',
      'Wood, D., Bruner, J. S., & Ross, G. (1976). The role of tutoring in problem solving. Journal of Child Psychology and Psychiatry, 17(2), 89–100.',
    ],
  },
  {
    id: 'bronfenbrenner',
    name: 'Urie Bronfenbrenner — Ecological Systems Theory',
    years: '1917–2005',
    tradition: 'Developmental psychology',
    summary:
      'A child develops within nested systems: microsystem (family, room), mesosystem (links between them), exosystem (community, workplace), macrosystem (culture, policy) and chronosystem (time).',
    keyConcepts: [
      {
        term: 'Microsystem',
        definition: 'Immediate settings the child is part of — family, education setting, peers.',
      },
      {
        term: 'Mesosystem',
        definition: 'The connections between microsystems, e.g. educator–family partnership.',
      },
      {
        term: 'Exosystem',
        definition: 'Indirect influences — parent workplace, community services, funding.',
      },
      {
        term: 'Macrosystem',
        definition: 'Cultural values, laws and frameworks such as the EYLF and NQF.',
      },
      {
        term: 'Proximal processes',
        definition:
          'The regular, reciprocal interactions that actually drive development — the engine of the model.',
      },
    ],
    inPractice: [
      'Strengthen the mesosystem: build genuine, two-way partnerships with families.',
      'Record children’s key relationships and community connections in their documentation.',
      'Consider exosystem pressures (work shifts, housing, access) when interpreting behaviour.',
      'Use each family’s cultural values (macrosystem) as a resource, not a barrier.',
      'Protect and enrich frequent, warm proximal interactions above all else.',
    ],
    eylfLinks: [1, 2, 3],
    references: [
      'Bronfenbrenner, U. (1979). The Ecology of Human Development. Harvard University Press.',
      'Bronfenbrenner, U. (2005). Making Human Beings Human: Bioecological Perspectives on Human Development. Sage.',
    ],
  },
  {
    id: 'rogoff',
    name: 'Barbara Rogoff — Guided Participation & Sociocultural Activity',
    years: '1950–',
    tradition: 'Sociocultural / cultural psychology',
    summary:
      'Learning happens through guided participation in culturally organised activity. Children learn by observing and pitching in as members of a community.',
    keyConcepts: [
      {
        term: 'Guided participation',
        definition:
          'The process by which children and others coordinate involvement in shared activity.',
      },
      {
        term: 'Intent community participation',
        definition:
          'Learning by observing and pitching in — common in many Indigenous and non-Western communities.',
      },
      {
        term: 'Apprenticeship',
        definition: 'Learning a skill as a legitimate participant in real, valued work.',
      },
      {
        term: 'Three planes',
        definition:
          'Learning can be analysed at personal, interpersonal and community/institutional planes.',
      },
    ],
    inPractice: [
      'Invite children to genuinely contribute to real routines and jobs in the setting.',
      'Value observation as a legitimate form of learning (not just "not participating yet").',
      'Design tasks where children work alongside more capable peers and adults.',
      'Make community events and Elders/visitors part of the program.',
      'Analyse a learning moment at all three planes, not just the individual child.',
    ],
    eylfLinks: [1, 2, 4],
    references: [
      'Rogoff, B. (2003). The Cultural Nature of Human Development. Oxford University Press.',
      'Rogoff, B. (1990). Apprenticeship in Thinking: Cognitive Development in Social Context. Oxford University Press.',
      'Rogoff, B., et al. (2014). Learning by observing and pitching in to family and community endeavours. Human Development, 57, 69–81.',
    ],
  },
  {
    id: 'dweck',
    name: 'Carol Dweck — Growth Mindset',
    years: '1946–',
    tradition: 'Motivation & self-theories',
    summary:
      'Beliefs about ability shape learning. A "growth" mindset — ability grows with effort and strategy — predicts persistence and resilience; a "fixed" mindset does not.',
    keyConcepts: [
      {
        term: 'Growth mindset',
        definition: 'The belief that ability can be developed through effort, strategies and help.',
      },
      {
        term: 'Fixed mindset',
        definition: 'The belief that ability is static and close to unchangeable.',
      },
      {
        term: 'Process praise',
        definition:
          'Praising effort, strategy and learning rather than "being clever" or "being good at it".',
      },
      {
        term: 'Productive struggle',
        definition: 'Valuing difficulty as the place where learning happens.',
      },
      {
        term: 'Yet',
        definition: 'Reframing "I can’t do it" as "I can’t do it yet".',
      },
    ],
    inPractice: [
      'Use process praise: "You tried three different ways — tell me about that."',
      'Model your own productive struggle and mistake-making aloud.',
      'Display the word "yet" and normalise unfinished learning.',
      'Give feedback on strategy, not on the child as a person.',
      'Avoid labelling children as "the clever one" or "the sporty one".',
    ],
    eylfLinks: [1, 3, 4],
    references: [
      'Dweck, C. S. (2006). Mindset: The New Psychology of Success. Random House.',
      'Dweck, C. S. (2017). The Journey to Children’s Mindsets — and Beyond. Child Development Perspectives, 11(2), 139–144.',
    ],
  },
  {
    id: 'kolb',
    name: 'David Kolb — Experiential Learning Cycle',
    years: '1939–',
    tradition: 'Experiential learning',
    summary:
      'Learning is a four-stage cycle: concrete experience, reflective observation, abstract conceptualisation and active experimentation. Effective learners move through all four.',
    keyConcepts: [
      {
        term: 'Concrete experience',
        definition: 'Doing something — a hands-on, felt experience.',
      },
      {
        term: 'Reflective observation',
        definition: 'Reviewing and describing what happened.',
      },
      {
        term: 'Abstract conceptualisation',
        definition: 'Making a generalisation or theory from the experience.',
      },
      {
        term: 'Active experimentation',
        definition: 'Testing the new idea in a fresh situation.',
      },
      {
        term: 'Learning styles',
        definition:
          'Individuals tend to prefer different entry points into the cycle (a contested but useful heuristic).',
      },
    ],
    inPractice: [
      'Structure projects so children do, reflect, theorise and re-test.',
      'Use "What happened? What did you notice? What will we try next?" as a reflection routine.',
      'Give time for reflective talk and drawing immediately after a rich experience.',
      'Let children re-test ideas in a new setting to grow transfer (EYLF 4.3).',
      'Use documentation as the "reflective observation" stage of the cycle.',
    ],
    eylfLinks: [4, 5],
    references: [
      'Kolb, D. A. (1984). Experiential Learning: Experience as the Source of Learning and Development. Prentice Hall.',
      'Kolb, A. Y., & Kolb, D. A. (2009). Experiential learning theory: A dynamic, holistic approach to management learning, education and development. In The SAGE Handbook of Management Learning.',
    ],
  },
  {
    id: 'gardner',
    name: 'Howard Gardner — Multiple Intelligences',
    years: '1943–',
    tradition: 'Cognitive psychology',
    summary:
      'Intelligence is plural, not singular. Gardner proposed several relatively independent intelligences, arguing that children show different strengths and learn in different ways.',
    keyConcepts: [
      {
        term: 'Linguistic & logical-mathematical',
        definition: 'The two intelligences most valued by traditional schooling.',
      },
      {
        term: 'Spatial & bodily-kinaesthetic',
        definition: 'Thinking through images, space, movement and touch.',
      },
      {
        term: 'Musical & naturalistic',
        definition: 'Sensitivity to rhythm, sound and the natural world.',
      },
      {
        term: 'Interpersonal & intrapersonal',
        definition: 'Understanding others and understanding oneself.',
      },
      {
        term: 'Personalised pathways',
        definition:
          'Offer multiple entry points to the same concept so each child can use their strengths.',
      },
    ],
    inPractice: [
      'Offer the same idea through many entry points — song, movement, building, story, nature.',
      'Notice and name a wide range of strengths in documentation.',
      'Avoid using MI as a labelling system ("you’re a kinaesthetic learner").',
      'Use children’s strong channels to scaffold weaker ones.',
      'Plan environments that resource all intelligences, not just literacy and numeracy.',
    ],
    eylfLinks: [1, 4, 5],
    references: [
      'Gardner, H. (1983). Frames of Mind: The Theory of Multiple Intelligences. Basic Books.',
      'Gardner, H. (2006). Multiple Intelligences: New Horizons in Theory and Practice. Basic Books.',
    ],
  },
  {
    id: 'froebel',
    name: 'Friedrich Froebel — Play, Gifts & Occupations',
    years: '1782–1852',
    tradition: 'Romantic / idealist pedagogy',
    summary:
      'The founder of the kindergarten. Froebel saw play as the highest expression of child development and designed "gifts" (structured materials) and "occupations" (craft activities) to support it.',
    keyConcepts: [
      {
        term: 'Play as the highest form of learning',
        definition: 'Play is the child’s natural, full expression of inner life and development.',
      },
      {
        term: 'Gifts',
        definition:
          'Carefully designed open-ended materials (the sphere, cube, cylinder, blocks) that reveal form, pattern and unity.',
      },
      {
        term: 'Occupations',
        definition: 'Handcrafts such as weaving, paper-folding, clay and drawing.',
      },
      {
        term: 'Unity and connectedness',
        definition: 'Everything is interconnected; education seeks to reveal that unity.',
      },
      {
        term: 'The kindergarten',
        definition: 'A literal "garden of children" — a nurturing, nature-filled environment.',
      },
    ],
    inPractice: [
      'Use open-ended, progressive material sets (blocks, loose parts) to reveal structure.',
      'Keep a strong daily rhythm of play, story, song, craft and outdoor time.',
      'Value gardening, nature observation and care for living things.',
      'Include handcrafts along the "occupations": weaving, folding, clay, threading.',
      'Emphasise connections between the child, the natural world and community.',
    ],
    eylfLinks: [2, 3, 5],
    references: [
      'Froebel, F. (1826/1887). The Education of Man. Appleton.',
      'Brosterman, N. (1997). Inventing Kindergarten. Harry N. Abrams.',
      'Tovey, H. (2013). Bringing the Froebel Approach to Your Early Years Practice. Routledge.',
    ],
  },
]

export const theoryById = (id: string): Theory | undefined =>
  THEORIES.find(t => t.id === id)

export const THEORY_BY_ID: Record<string, Theory> = Object.fromEntries(
  THEORIES.map(t => [t.id, t]),
)

/** Compact list used for select menus and AI prompts. */
export const THEORY_INDEX = THEORIES.map(t => ({
  id: t.id,
  name: t.name,
  tradition: t.tradition,
  eylfLinks: t.eylfLinks,
}))

export function theoriesForOutcome(outcomeId: number): Theory[] {
  return THEORIES.filter(t => t.eylfLinks.includes(outcomeId as 1))
}