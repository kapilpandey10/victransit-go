// ---------------------------------------------------------------------------
// Central place for AI instruction text used by the client tools.
// The Edge Functions hold the authoritative system prompt; these strings are
// the *user-facing* task instructions (they travel as normal chat messages and
// are therefore easy to audit and tweak by educators).
// ---------------------------------------------------------------------------

export const EYLF_REFERENCE = `EYLF v2.0 Learning Outcomes:
1. Children have a strong sense of identity (identity, autonomy, empathy)
2. Children are connected with and contribute to their world (belonging, diversity, fairness, sustainability)
3. Children have a strong sense of wellbeing (social/emotional, physical, health & safety)
4. Children are confident and involved learners (dispositions, thinking skills, transfer, resourcing learning)
5. Children are effective communicators (verbal/non-verbal, texts, media, symbols, digital technologies)`

export const PROMPTS = {
  learningOutcomes: (activity: string, ageGroup: string) => `You are an early childhood curriculum specialist in Australia.

${EYLF_REFERENCE}

Activity / experience:
"""
${activity}
"""

Age group: ${ageGroup || 'not specified'}

Return a JSON object with EXACTLY this shape and nothing else:
{
  "primaryOutcomes": [ { "id": 1, "subOutcomeIds": ["1.1"], "why": "…" } ],
  "learningIntentions": ["…"],
  "successCriteria": ["…"],
  "theories": [ { "id": "vygotsky", "note": "…" } ],
  "reggioLens": "one short paragraph",
  "extensionIdeas": ["…"],
  "environmentChanges": ["…"]
}

Rules:
- Use only EYLF outcome ids 1-5 and valid sub-outcome ids such as "4.2".
- Choose 1-3 primary outcomes.
- Theory ids must come from: vygotsky, piaget, reggio, montessori, dewey, bruner, bronfenbrenner, rogoff, dweck, kolb, gardner, froebel.
- Learning intentions must be written as "Children will…" statements.
- Keep every string concise and practical for a busy educator.`,

  learningStory: (input: { child: string; observation: string; ageGroup?: string }) => `You are an experienced Australian early childhood educator writing a Learning Story.

${EYLF_REFERENCE}

Child: ${input.child || 'the child'}
Age group: ${input.ageGroup || 'not specified'}

What I observed (raw notes):
"""
${input.observation}
"""

Write a warm, professional learning story. Return ONLY valid JSON in this shape:
{
  "title": "…",
  "narrative": "…",
  "analysis": "…",
  "educatorReflection": "…",
  "nextSteps": "…",
  "eylfOutcomeIds": [4],
  "theoryIds": ["vygotsky"]
}

Rules:
- Narrative: 2-4 short paragraphs, written as a story in the past tense, honouring the child's agency and voice.
- Analysis: name the specific learning, dispositions and skills you noticed, referencing EYLF sub-outcomes.
- EducatorReflection: first person ("I noticed…", "I wonder…").
- NextSteps: concrete, practical extensions (materials, environment, intentional teaching, family link).
- Avoid deficit language; focus on what the child CAN do.
- Do not use the child's surname.`,

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