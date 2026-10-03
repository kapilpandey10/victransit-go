# 🌱 Hadfield Inquiry Planner

An AI-assisted, installable (PWA) dashboard for early childhood educators —
plan inquiry-based learning, map activities to **EYLF v2.0** outcomes, write
**learning stories**, draft **newsletters**, reflect on the **program book**,
and chat with a specialist **AI assistant** — all from one responsive app that
works on **iPad and computer**.

> Status: complete, tested end-to-end in demo mode. Add Supabase credentials +
> a Groq key to enable cloud sync and the AI.

## ✨ Features

| Area | What it does |
|------|--------------|
| 🏠 Dashboard | Welcome hero, stats, tool cards, tip of the day, planning cycle, recent projects, quick AI asks |
| 🗺️ Inquiry mind map | jsMind canvas — lines of inquiry, questions, experiences, resources, theories, outcomes; autosaves; **AI brainstorm** button with Reggio lens |
| 🎯 Learning outcomes | Describe any experience → AI maps it to EYLF outcomes + sub-outcomes, learning intentions, success criteria, theories, environment changes |
| 📖 Learning stories | 6-step writer (raw notes → AI draft → edit → save), linked to projects, outcomes and theories |
| 📰 Newsletters | Highlights → warm, family-friendly Markdown newsletter with preview |
| 🔍 Program book analysis | Paste documentation → strengths, gaps, next steps and an EYLF coverage chart |
| 📚 Theories & literature | 10 theorists (Vygotsky, Piaget, Malaguzzi/Reggio, Montessori, Dewey, Bruner, Bronfenbrenner, Rogoff, Dweck, Kolb, Gardner, Froebel) with search, EYLF filter, references; plus a **Reggio Emilia** band (principles, hundred-languages quote, room audit) |
| 🇦🇺 EYLF reference | All 5 outcomes + sub-outcomes with “look for” prompts, 8 principles, 7 practices |
| ✨ AI chatbot | Floating dock on every page; **temporary** sessions (device-local, never in the DB); streaming replies; context-aware (“Ask AI about this”) |
| 🎙️ Voice input | **Transcribe icon flow**: tap 🎙️ to record (works on iPad Safari) → tap ✍️ to transcribe with **Groq `whisper-large-v3-turbo`** → text lands in the composer. Plus a free on-device option (`🎤 Free`, zero credits) and a voice-source switcher right in the chat |
| 🆓 Puter.js | Optional **Settings toggle**: routes chat replies *and* transcription through Puter’s free user-pays models — **zero Groq credit**. Script loads lazily only when enabled |
| 📲 PWA | Installable, offline-capable, safe-area aware, dark mode, 44px touch targets |

## 🤖 AI models (pinned for lowest credit usage)

Verified against your key (`GET /openai/v1/models`), then hard-pinned so a typo
can never trigger a 400 or a pricier model:

| Purpose | Model | Why |
|---------|-------|-----|
| Chat | `openai/gpt-oss-20b` | Lowest text price ($0.075/$0.30 per 1M), ~1000 t/s, 131K context |
| Transcription | `whisper-large-v3-turbo` | **Cheapest Whisper** ($0.04/hr — vs `whisper-large-v3`) |
| Chat fallback (Edge Function only) | `openai/gpt-oss-120b` | Allow-listed, used only if ever requested |

Credit-saving measures built in:

- `reasoning_effort: "low"` on all gpt-oss calls (these are reasoning models —
  this cuts wasted reasoning tokens dramatically; `low` is Groq’s cheapest
  accepted value).
- Chat history capped at **20 turns**, messages truncated to 6K chars,
  `max_tokens` ≤ 1400.
- The Edge Function **allow-lists** chat models — the client can only ever ask
  for the two above.
- Puter.js toggle = free AI entirely, bypassing Groq.

### AI routing (in priority order)

1. **Supabase Edge Function** — key stored server-side as a secret, never
   reaches the browser (recommended for production).
2. **Direct Groq** — `VITE_GROQ_API_KEY` in `.env.local` (git-ignored). Used
   while Supabase isn’t configured; Groq’s CORS permits it. Kept out of git and
   ignored again as soon as Supabase is set.
3. **Friendly setup error** explaining exactly what to add.

The same `chat` Edge Function handles both routes by inspecting the body:
`application/json` → streamed chat (SSE); `multipart/form-data` → Whisper
transcription (25 MB cap, audio never stored).

## 🧱 Tech stack

Vue 3 · Vite 6 · TypeScript · Pinia · Vue Router · Tailwind CSS 3 ·
Supabase (Auth + Postgres + Edge Functions) · Groq (`openai/gpt-oss-20b`) ·
jsMind · `vite-plugin-pwa` · Vitest · Playwright (verification)

## 🚀 Quick start

```bash
npm install
npm run dev        # → http://localhost:5173
```

A key is already configured in this workspace’s git-ignored `.env.local`, so on
first launch you get **live AI chat + Whisper voice transcription** in
**direct-Groq mode** while all data stays on-device. To start from scratch,
copy `.env.example` → `.env.local` and add your own key.

```bash
npm test           # 25 unit tests
npm run build      # typecheck + production build + service worker
```

## 🔌 Connecting Supabase (adds cloud sync + server-side key)

1. Create a free project at <https://supabase.com/dashboard>.
2. Run the schema in the SQL editor:
   `supabase/migrations/0001_init.sql`
3. Deploy the secure AI proxy and set the key (find yours at
   <https://console.groq.com/keys>):
   ```bash
   supabase functions deploy chat --no-verify-jwt
   supabase secrets set GROQ_API_KEY=gsk_...
   ```
4. Add the URL + anon key to `.env.local`:
   ```bash
   # VITE_SUPABASE_URL=https://<ref>.supabase.co
   # VITE_SUPABASE_ANON_KEY=<anon key>
   ```
   (Optional) remove `VITE_GROQ_API_KEY` — the Edge Function path takes
   priority and the key no longer needs to be in the bundle.
5. `npm run build` and host `dist/` anywhere static (Netlify, Vercel,
   Cloudflare Pages, Supabase hosting…).

> 🔐 Production: the Groq key **never** reaches the browser — it lives in the
> Edge Function’s secret store. The `VITE_GROQ_API_KEY` direct path exists only
> for single-machine/local use and is git-ignored; `VITE_` variables are public,
> so rotate the key before any public deployment.

## 🗄️ Data model

`profiles` · `projects` · `mindmap_nodes` · `learning_stories` · `activities` ·
`newsletters` · `program_book_analyses` — all scoped to the owning educator by
Row Level Security (`own rows` policies). Chat history is deliberately **not**
a table.

## 🧪 Verification performed

- `vue-tsc --noEmit` — clean
- `vitest` — 25/25 pass (JSON parsing, demo-mode CRUD + mind-map replace,
  EYLF/theory data integrity, prompt builders, voice-settings persistence)
- `vite build` — clean incl. service worker precache
- Headless Chromium (desktop + iPad viewport): dashboard, navigation, theories,
  EYLF, project CRUD, story CRUD, chat dock with Temporary badge, bottom nav,
  Settings voice/Puter section — **zero console errors**
- **Live end-to-end**: real Groq `chat/completions` streamed a reply (HTTP 200),
  and a fake-mic recording was transcribed by real `whisper-large-v3-turbo`
  (HTTP 200) with the text inserted into the composer
- Groq API verified directly: model list, `reasoning_effort: low`, and
  transcription output (`"Where does the water go when it rains?"`)

## 📁 Layout

```
src/
  components/   AppShell, AppSidebar, ChatDock (voice + chips),
                MindMapEditor, EylfOutcomePicker, TheoryPicker,
                MarkdownView, ToastHost
  views/        Dashboard, Projects, ProjectWorkspace, LearningOutcomes,
                LearningStories, Newsletter, ProgramBook,
                TheoryLibrary, Eylf, Settings (voice + Puter toggle)
  composables/  useVoice (record → transcribe), useSpeech, useAiTask
  stores/       auth, project, content, chat (temporary), ui
  services/     supabase, ai (Edge Function + direct Groq + Whisper),
                voice (MediaRecorder, Puter.js), repo (Supabase↔local),
                localStore
  data/         eylf, theories, reggio, prompts
supabase/
  migrations/0001_init.sql   tables + RLS + triggers + signup hook
  functions/chat/index.ts    Groq proxy (streaming chat + multipart Whisper)
```

## ⚠️ Notes & limitations

- AI features require the deployed `chat` function; in demo mode they explain
  exactly how to set it up.
- Speech recognition depends on the browser (Safari/iPadOS and Chrome are best).
- Mind-map images export is not included in v1 — JSON autosave is.
- Keep children’s surnames and sensitive details out of AI prompts.

Built for **Hadfield Early Learning Centre** 🌏 — Belonging, Being & Becoming.
