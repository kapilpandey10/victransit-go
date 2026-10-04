// ---------------------------------------------------------------------------
// Weekly Wrap-Up style guide + few-shot anchors.
//
// The three excerpts below are condensed from real Hadfield weekly wrap-ups
// (Chamomiles, Blossoms, ButterBeans). They act as few-shot style training
// so every generated wrap-up matches the voice families already know.
// ---------------------------------------------------------------------------

export const WRAPUP_STYLE = `You write ONE warm, parent-facing Weekly Wrap-Up newsletter for an Australian early childhood room. Match this house style exactly:

CRITICAL FORMATTING RULE:
- Write in PLAIN TEXT ONLY.
- NEVER use markdown bold syntax (**text**) or asterisks anywhere.
- Headings and labels must be plain text (e.g. "Reminders:", "Lost & Found:", "• Sun Protection:").

GROUNDING & INTEGRITY:
- NEVER invent experiences, food, inquiries, projects, family taste-tests, invitations, or events that are NOT explicitly mentioned in the educator's notes.
- If the educator wrote about 3 activities, only cover those 3 activities. Do NOT pad with fake future projects or made-up family events.

AI ELABORATIONS TAGGING:
- Whenever you add pedagogical reflections, developmental links (e.g. fine-motor skills, coordination, spatial reasoning, cause-and-effect, social confidence), or explanatory phrasing beyond what the educator wrote, you MUST wrap that specific sentence or phrase inside <extra>...</extra> tags.
- Educators will see these in a special highlight color so they can review, edit, get suggestions, or delete them before sharing.
- Factual accounts of what happened, greetings, reminders, and sign-offs should NOT be wrapped in <extra>.

STRUCTURE:
1. Title on the first line: <Room> Room – Weekly Wrap-Up
2. Greeting:
   Hello <Room> Families,
   Wominjeka!
3. One enthusiastic opening sentence: "It has been another wonderful week of exploring, creating and learning together in the <Room> Room!"
4. Flowing narrative paragraphs covering the actual experiences from the notes. Describe what the children did warmly, followed by the developmental learning in <extra>...</extra> tags.
5. Heartfelt thank-you to families: "We would like to say a heartfelt thank you to all our <Room> families for your continued support, involvement and collaboration."
6. Reminders (clean plain text):
   Expand the educator's notes into warm, informative, helpful reminders for families (e.g. explaining UV protection, spare clothes for water play, closure dates clearly). Correct typos naturally.
   Format with clean bullet points:
   Reminders:
   • <Topic>: <Helpful, parent-friendly explanation>
7. Lost & Found (if items or notes provided):
   Warm, polite notice inviting families to check the lost property basket or bag near the room entrance.
   Lost & Found:
   • <Warm, clear notice>
8. Any special message or announcement (if provided).
9. Warm weekend sign-off:
   "Thank you again for a wonderful week. We hope you all have a relaxing weekend!

The <Room> Team"

VOICE:
- Professional, warm, respectful — like a teacher chatting with parents at the gate.
- Strengths-based and celebratory.
- Plain English without academic jargon.`

export const WRAPUP_EXCERPTS = `STYLE EXCERPTS (plain text, no bold asterisks, with <extra> tags around developmental elaborations):

Example:
Chamomiles Room – Weekly Wrap-Up

Hello Chamomiles Families,
Wominjeka!

It has been another wonderful week of exploring, creating and learning together in the Chamomiles Room!

This week, the children revisited our clay mark-making experience, using natural seed pods and leaves to create different patterns and impressions. <extra>This hands-on exploration encouraged sensory awareness, curiosity, and early problem-solving as children noticed the different textures they could form.</extra>

To continue the children's interest in transport, they shaped playdough vehicles using car and truck cutters. <extra>Manipulating the cutters and rolling the dough supported fine-motor strength, hand-eye coordination, and joyful peer conversations.</extra>

We would like to say a heartfelt thank you to all our Chamomiles families for your continued support, involvement and collaboration.

Reminders:
• Sun Protection & Outdoor Play: As the weather is warming up, please ensure children arrive with sunscreen applied and bring a labelled sun-safe hat each day.
• Bush Kinder: Bush Kinder will be held every Friday.

Thank you again for a lovely week. We hope you have a relaxing weekend!

The Chamomiles Team`

// The Edge Functions hold the authoritative system prompt; these strings are
// the *user-facing* task instructions (they travel as normal chat messages and
// are therefore easy to audit and tweak by educators).
// ---------------------------------------------------------------------------

export const EYLF_REFERENCE = `EYLF v2.0 Learning Outcomes:
1. Children have a strong sense of identity(identity, autonomy, empathy)
2. Children are connected with and contribute to their world(belonging, diversity, fairness, sustainability)
3. Children have a strong sense of wellbeing(social / emotional, physical, health & safety)
4. Children are confident and involved learners(dispositions, thinking skills, transfer, resourcing learning)
5. Children are effective communicators(verbal / non - verbal, texts, media, symbols, digital technologies)`

export const PROMPTS = {
  learningOutcomes: (activity: string, ageGroup: string) => `You are an early childhood curriculum specialist in Australia.

  ${ EYLF_REFERENCE }

Activity / experience:
"""
${ activity }
"""

Age group: ${ ageGroup || 'not specified' }

Return a JSON object with EXACTLY this shape and nothing else:
{
  "primaryOutcomes": [{ "id": 1, "subOutcomeIds": ["1.1"], "why": "…" }],
    "learningIntentions": ["…"],
      "successCriteria": ["…"],
        "theories": [{ "id": "vygotsky", "note": "…" }],
          "reggioLens": "one short paragraph",
            "extensionIdeas": ["…"],
              "environmentChanges": ["…"]
}

Rules:
- Use only EYLF outcome ids 1 - 5 and valid sub - outcome ids such as "4.2".
- Choose 1 - 3 primary outcomes.
- Theory ids must come from: vygotsky, piaget, reggio, montessori, dewey, bruner, bronfenbrenner, rogoff, dweck, kolb, gardner, froebel.
- Learning intentions must be written as "Children will…" statements.
- Keep every string concise and practical for a busy educator.`,

  learningStory: (input: { child: string; observation: string; ageGroup?: string; setting?: string }) => `You are an experienced Australian early childhood educator writing an individual child's Learning Story (portfolio document).

Follow the renowned Australian early childhood Learning Story model (as championed by Kelly Goodsir, Tom Drummond, and Margie Carter):
- Structure:
  1. Title: An evocative, insightful topic (e.g. "The satisfaction of 'experimenting' with objects", "Curiosity in motion").
  2. The Story: Written in first/second person, speaking directly and warmly to the child ("${input.child || 'Child'}, your curiosity with... was so evident... you really caught my attention..."). Describe the sequence of actions, focus, concentration, problem-solving, and joy.
  3. "What ${input.child || 'the child'} is learning here?": A dedicated pedagogical analysis naming schemas (e.g. posting, trajectory, enclosing, transporting, connecting, rotation), dispositions (persistence, curiosity, concentration), brain connections ("building blocks for the brain"), and EYLF concepts.
  4. "Ways to support continued engagement in [schema/interest] for ${input.child || 'the child'}": Practical environmental provocations, materials, and intentional teaching.
  5. Family Link: A warm, personalized question or note inviting the family to share what they observe at home (e.g. "Gabrielle - I wonder if you have ever noticed Lacey 'posting' things at home?").

${EYLF_REFERENCE}

Child: ${input.child || 'the child'}
Setting: ${input.setting || 'early learning centre'}
Age group: ${input.ageGroup || 'not specified'}

Observation notes:
"""
${input.observation}
"""

Return ONLY valid JSON with EXACTLY this structure:
{
  "title": "…",
  "narrative": "…",
  "analysis": "…",
  "nextSteps": "…",
  "familyLink": "…",
  "educatorReflection": "…",
  "eylfOutcomeIds": [4],
  "theoryIds": ["piaget", "vygotsky"]
}

Rules:
- Write in warm, celebratory, respectful language honouring the child's agency.
- Do NOT use the child's surname.
- Narrative must speak directly to the child ("You...").
- Keep strings rich, meaningful, and professional.`,

  learningStoryTopics: (input: { child?: string; observation: string }) => `You are an Australian early childhood pedagogical coach.
Based on the educator's observation notes, suggest 4 compelling, thoughtful, professional Learning Story topics/titles for an individual child's portfolio.

Child: ${input.child || 'Child'}
Observation notes:
"""
${input.observation}
"""

Return ONLY valid JSON in this shape:
{
  "topics": [
    { "title": "…", "angle": "Schema & Inquiry" },
    { "title": "…", "angle": "Dispositions & Concentration" },
    { "title": "…", "angle": "Spatial & Physical Exploration" },
    { "title": "…", "angle": "Creative & Warm" }
  ]
}`,

  programExperience: (input: {
    topicOrNotes: string
    room?: string
    type?: 'group' | 'inquiry' | 'intentional' | 'spontaneous'
    ageGroup?: string
  }) => `You are an experienced Australian early childhood curriculum specialist writing an entry for a room's Programming Book (Curriculum Book).

A Programming Book documents group experiences, emergent inquiries, or intentional learning moments happening in the room (unlike an individual learning story, this is for the group curriculum and room planning).

${EYLF_REFERENCE}

Room: ${input.room || 'General Room'}
Experience Type: ${input.type || 'group'}
Age Group: ${input.ageGroup || 'not specified'}

Educator's notes / idea:
"""
${input.topicOrNotes}
"""

Return ONLY valid JSON in this shape:
{
  "title": "…",
  "experienceType": "${input.type || 'group'}",
  "narrative": "…",
  "learningIntentions": ["Children will…", "Children will…"],
  "teachingStrategies": "…",
  "environmentResources": "…",
  "nextSteps": "…",
  "eylfOutcomeIds": [2, 4],
  "theoryIds": ["reggio", "vygotsky"]
}

Rules:
- Title must be engaging and reflect the inquiry or experience.
- Narrative describes the group interaction, shared curiosity, children's voices, and collective exploration.
- Learning intentions must be clear "Children will..." statements.
- Teaching strategies detail the educator's intentional role (questions, provocations, scaffolding).
- Environment/resources details loose parts, natural materials, and spatial setup.
- Next steps explain how this extends into ongoing group inquiries.`,

  programExperienceTopics: (input: { notes: string; room?: string; ageGroup?: string }) => `You are an early childhood curriculum coach.
Suggest 4 creative, inquiry-driven topics for an Australian early learning Programming Book based on the educator's notes or current room interest.

Room: ${input.room || 'General Room'}
Notes:
"""
${input.notes}
"""

Return ONLY valid JSON in this shape:
{
  "topics": [
    { "title": "…", "type": "inquiry", "description": "Longer-term emergent inquiry project" },
    { "title": "…", "type": "group", "description": "Hands-on collaborative group experience" },
    { "title": "…", "type": "intentional", "description": "Intentional teaching provocation" },
    { "title": "…", "type": "spontaneous", "description": "Following children's spontaneous curiosity" }
  ]
}`,

newsletter: (input: {
  term?: string
  audience?: string
  highlights: string
  outcomes?: string
}) => `You are writing a friendly, warm newsletter to families of an Australian early childhood service.

Term / period: ${input.term || 'this term'}
Audience: ${input.audience || 'families'}
Learning highlights provided by educators:
"""
${input.highlights}
"""
EYLF outcomes to reference: ${input.outcomes || 'the most relevant outcomes'}

Write a newsletter. Return ONLY valid JSON:
{
  "title": "…",
  "content": "…",
  "highlights": ["short bullet for each key highlight"],
  "eylfOutcomeIds": [1,4]
}

Rules:
- Warm, plain-English tone — no jargon, no acronyms without explaining them.
- Include a short "What we noticed" and "How you can help at home" section.
- Reference EYLF outcomes in family-friendly language (e.g. "growing confidence as a learner").
- Keep it under 450 words. Use short paragraphs suitable for email.`,

  programAnalysis: (input: { programText: string }) => `You are an experienced educational leader performing a critical reflection on a service's program documentation in Australia.

${EYLF_REFERENCE}

Program documentation to analyse:
"""
${input.programText}
"""

Return ONLY valid JSON:
{
  "summary": "…",
  "strengths": ["…"],
  "gaps": ["…"],
  "recommendations": ["…"],
  "coverage": { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
  "eylfOutcomeIds": [1,2,3,4,5]
}

Rules:
- "coverage" values must be integers 0-5 indicating how strongly each outcome is evidenced.
- Gaps must be specific and evidence-based, not generic.
- Recommendations must be immediately actionable for educators.
- Be constructive and strengths-based, consistent with critical reflection requirements of the NQF.`,

    mindmapSuggest: (input: { topic: string; ageGroup?: string }) => `You are an inquiry-planning partner for an Australian early childhood educator using a Reggio-inspired, emergent curriculum approach.

Inquiry topic: ${input.topic}
Age group: ${input.ageGroup || 'not specified'}

Return ONLY valid JSON:
{
  "questions": ["provocative, open questions children might ask"],
  "themes": ["possible lines of inquiry"],
  "activities": ["hands-on experience ideas"],
  "resources": ["materials, books, loose parts, community links"],
  "outcomeIds": [4],
  "theories": ["vygotsky"],
  "reggioLens": "how the environment could act as third teacher"
}

Rules:
- Questions must be genuinely open ("What would happen if…"), not closed recall questions.
- 4-6 items per array, concise.
- Activities must be feasible in a typical long day care room.`,

      improveWriting: (input: { text: string; purpose: string }) => `You are an early childhood writing coach.

${EYLF_REFERENCE}

Purpose: ${input.purpose}

Draft:
"""
${input.text}
"""

Return ONLY valid JSON:
{
  "improved": "the improved version, same meaning, stronger educator voice",
  "notes": ["what you changed and why"],
  "eylfOutcomeIds": [4]
}

Rules:
- Preserve the educator's authentic voice — do not over-formalise.
- Remove jargon, clichés and deficit language.
- Keep it concise.`,

        /**
         * Weekly Wrap-Up — the Friday compilation. Daily notes written through the
         * week are merged into one parent-facing wrap-up in the house style.
         */
        weeklyWrapUp: (input: {
          room: string
          weekLabel: string
          /** e.g. "Saturday 10 October & Sunday 11 October — centre closed" */
          closed: string
          days: { label: string; date: string; notes: string }[]
          reminders?: string
          lostFound?: string
          message?: string
        }) => {
          const notes = input.days
            .filter(d => d.notes.trim())
            .map(d => `${d.label} (${d.date}):\n${d.notes.trim()}`)
            .join('\n\n')

          return `${WRAPUP_STYLE}

${WRAPUP_EXCERPTS}

ROOM: ${input.room}
WEEK: ${input.weekLabel}
CENTRE CLOSED: ${input.closed}

DAILY NOTES FROM EDUCATORS:
${notes || '(no notes were provided this week — write a gentle note acknowledging a quiet week and remind families of the notices below.)'}

REMINDERS TO POLISH PROFESSIONALLY:
${input.reminders?.trim() || '(none provided — omit the Reminders section)'}

LOST & FOUND TO POLISH RESPECTFULLY:
${input.lostFound?.trim() || '(none provided — omit the Lost & Found section)'}

ANNOUNCEMENT / MESSAGE:
${input.message?.trim() || '(none provided — omit)'}

REMINDERS ON STRICT REQUIREMENTS:
1. ONLY cover the activities and experiences in the daily notes. DO NOT invent food projects, inquiry topics, family taste-tests, invitations, or future events that were not documented.
2. PLAIN TEXT ONLY. DO NOT use markdown bold asterisks (**) anywhere.
3. Wrap any added pedagogical/developmental reflections (e.g. motor skills, problem-solving, social connections) inside <extra>...</extra> tags.
4. Expand reminders and lost & found into informative, parent-friendly notices rather than dry fragments. Correct any typos naturally.
5. Use "Wominjeka!" for the Indigenous greeting.

Write the complete Weekly Wrap-Up now, ready to copy straight to families.`
        },

        suggestAlternativeExtra: (input: {
          activity: string
          currentSnippet: string
          room?: string
        }) => `You are an Australian early childhood pedagogical coach working with the EYLF v2.0 framework.
An educator wants 3 alternative, professional developmental reflections for a Weekly Wrap-Up newsletter to families.

Activity context:
"""
${input.activity || 'Early childhood learning experience'}
"""

Current reflection:
"""
${input.currentSnippet}
"""

Requirements:
- Provide 3 distinct, professional alternatives (1-2 sentences each).
- Write in PLAIN TEXT ONLY (no bold markdown, no asterisks).
- Tone: warm, celebratory, respectful, parent-friendly.

Return ONLY valid JSON in this exact shape:
{
  "suggestions": [
    { "title": "Dispositions & Curiosity", "text": "…" },
    { "title": "Social & Communication", "text": "…" },
    { "title": "Simple & Concise", "text": "…" }
  ]
}`,

  eylfProvocation: (input: {
    outcomeId: number
    subOutcomeId: string
    subOutcomeText: string
    room?: string
    ageGroup?: string
    interest?: string
  }) => `You are an expert Australian Early Childhood Educational Leader and Reggio Emilia mentor.
An educator at Hadfield Early Learning Centre wants an inquiry provocation and learning experience aligned to:
EYLF V2.0 Outcome ${input.outcomeId}: Sub-Outcome ${input.subOutcomeId} — "${input.subOutcomeText}".
Room: ${input.room || 'General Early Learning Room'}
Age Group: ${input.ageGroup || 'Toddler / Kindergarten (2-5 years)'}
Current Children's Interest / Provocation Context: ${input.interest || 'Emergent child-led exploration'}

${EYLF_REFERENCE}

Return ONLY valid JSON in this exact shape:
{
  "provocationTitle": "Engaging, poetic provocation title",
  "ageFocus": "${input.ageGroup || '2-5 years'}",
  "reggioEnvironmentSetup": "Describe physical environment as 3rd teacher, loose parts, lighting, natural textures, and open-ended presentation",
  "openEndedQuestions": [
    "Provocative question 1 that prompts wonder without simple yes/no",
    "Provocative question 2 inviting hypotheses",
    "Provocative question 3 encouraging peer sharing"
  ],
  "intentionalTeachingRole": "Specific scaffolding techniques, modeling, and shared sustained thinking for educators",
  "theoristLink": {
    "name": "e.g. Lev Vygotsky / Loris Malaguzzi / Jean Piaget",
    "concept": "e.g. Zone of Proximal Development / Hundred Languages of Children / Schemas",
    "explanation": "Why this experience exemplifies this theoretical perspective"
  },
  "learningStorySnippet": "1-2 sentences of high quality strengths-based pedagogical analysis ready to include in a Learning Story observation"
}`,

  eylfAnalyseObservation: (input: {
    observation: string
    room?: string
    ageGroup?: string
  }) => `You are an expert Early Childhood Pedagogical Leader evaluating an observation from an Australian early learning centre against the Early Years Learning Framework V2.0 (EYLF V2.0).

${EYLF_REFERENCE}

Room: ${input.room || 'Hadfield Early Learning Centre'}
Age Group: ${input.ageGroup || '0-5 years'}
Observation:
"""
${input.observation}
"""

Return ONLY valid JSON in this exact shape:
{
  "primaryOutcome": {
    "outcomeId": 4,
    "outcomeTitle": "Children are confident and involved learners",
    "subOutcomeId": "4.2",
    "subOutcomeText": "Children develop a range of learning and thinking skills and processes such as problem-solving, inquiry, experimentation, hypothesising, researching and investigating",
    "confidenceScore": 95,
    "pedagogicalReasoning": "Concise explanation of how the child's actions demonstrate this sub-outcome"
  },
  "secondaryOutcomes": [
    {
      "outcomeId": 1,
      "subOutcomeId": "1.2",
      "subOutcomeText": "Children develop their emerging autonomy, inter-dependence, resilience and agency",
      "pedagogicalReasoning": "Why this secondary outcome is also evident"
    }
  ],
  "learningDispositions": ["Curiosity", "Persistence", "Spatial Reasoning"],
  "theoristPerspective": {
    "theorist": "Jean Piaget & Lev Vygotsky",
    "concept": "Enclosure / Connection Schemas & Social Scaffolding",
    "note": "How this theorist lens illuminates the child's thinking"
  },
  "intentionalTeachingExtension": "A practical, high-value invitation or provocation to extend this child's inquiry tomorrow",
  "learningStoryAnalysisExcerpt": "A beautiful 2-3 sentence analysis paragraph written in strengths-based, NQF-compliant prose suitable for sharing with families"
}`,

  eylfReflectivePracticePrompt: (input: {
    type: 'principle' | 'practice'
    title: string
    description: string
  }) => `You are an Australian Early Childhood Educational Leader preparing a critical reflection provocation for a team room meeting at Hadfield Early Learning Centre.

Topic: EYLF V2.0 ${input.type === 'principle' ? 'Principle' : 'Practice'}: "${input.title}"
Framework Summary: "${input.description}"

Return ONLY valid JSON in this exact shape:
{
  "title": "${input.title}",
  "nqsLink": "Quality Area 1 (Educational Program and Practice) & Quality Area 7 (Governance and Leadership)",
  "criticalReflectionQuestions": [
    "Deep reflective question 1 challenging assumptions about our everyday routines",
    "Deep reflective question 2 regarding children's agency, cultural safety, or family voice",
    "Deep reflective question 3 examining our indoor/outdoor environment as third teacher"
  ],
  "roomActionIdeas": [
    "Practical change 1 the room team can implement this week",
    "Practical change 2 to visibly evidence this in our curriculum"
  ],
  "leadershipTip": "A concise leadership gem for mentoring educators and pedagogical documentation"
}`,
} as const

/** Seed prompts used by the chat quick-start buttons. */
export const CHAT_STARTERS = [
  {
    label: 'Plan an inquiry',
    prompt:
      'Help me plan a 4-week inquiry project with 3-4 year olds about a local interest. Give me an inquiry question, lines of inquiry, and EYLF outcome links.',
  },
  {
    label: 'Reggio lens',
    prompt:
      'How can I make my room act as the "third teacher"? Give me 6 practical changes I can make this week, with the EYLF outcomes they support.',
  },
  {
    label: 'Learning story help',
    prompt:
      'Give me a template and 3 example phrases for writing the "analysis of learning" section of a learning story for a toddler.',
  },
  {
    label: 'Theory fit',
    prompt:
      'I am planning water play for 2-3 year olds. Which learning theories best explain the learning happening, and how do I reference them in my program?',
  },
  {
    label: 'Sustainability',
    prompt:
      'Suggest a sustainability-focused inquiry for 3-5 year olds linked to EYLF Outcome 2.4, including Reggio-inspired provocations.',
  },
  {
    label: 'Family partnership',
    prompt:
      'Write a short, warm message inviting families to contribute their skills and stories to our current inquiry project.',
  },
]