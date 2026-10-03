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
| ✨ AI chatbot | Floating dock on every page; **temporary** sessions (device-local, never in the DB); streaming replies; iPad **voice input** (mic) and spoken replies; context-aware (“Ask AI about this”) |
| 📲 PWA | Installable, offline-capable, safe-area aware, dark mode, 44px touch targets |

## 🧱 Tech stack

Vue 3 · Vite 6 · TypeScript · Pinia · Vue Router · Tailwind CSS 3 ·
Supabase (Auth + Postgres + Edge Functions) · Groq (`openai/gpt-oss-20b`) ·
jsMind · `vite-plugin-pwa` · Vitest · Playwright (verification)

## 🚀 Quick start (demo mode, no keys needed)

```bash
npm install
npm run dev        # → http://localhost:5173
```

The app runs fully in **demo mode**: all data is stored in the browser, every
screen is explorable, and the AI surfaces a helpful setup message.

```bash
npm test           # 20 unit tests
npm run build      # typecheck + production build + service worker
```

## 🔌 Connecting Supabase + Groq (enables cloud sync and AI)

1. Create a free project at <https://supabase.com/dashboard>.
2. Run the schema in the SQL editor:
   `supabase/migrations/0001_init.sql`
3. Deploy the secure AI proxy and set the key (find yours at
   <https://console.groq.com/keys>):
   ```bash
   supabase functions deploy chat
   supabase secrets set GROQ_API_KEY=gsk_...
   ```
4. Copy the environment file and fill in your values:
   ```bash
   cp .env.example .env.local
   # VITE_SUPABASE_URL=https://<ref>.supabase.co
   # VITE_SUPABASE_ANON_KEY=<anon key>
   ```
5. `npm run build` and host `dist/` anywhere static (Netlify, Vercel,
   Cloudflare Pages, Supabase hosting…).

> 🔐 The Groq key **never** reaches the browser. All AI calls go through the
> `chat` Edge Function, which holds `GROQ_API_KEY` as a server-side secret.
> VITE_ variables are public — never put a real API key in one.

## 🗄️ Data model

`profiles` · `projects` · `mindmap_nodes` · `learning_stories` · `activities` ·
`newsletters` · `program_book_analyses` — all scoped to the owning educator by
Row Level Security (`own rows` policies). Chat history is deliberately **not**
a table.

## 🧪 Verification performed

- `vue-tsc --noEmit` — clean
- `vitest` — 20/20 pass (JSON parsing, demo-mode CRUD + mind-map replace,
  EYLF/theory data integrity, prompt builders)
- `vite build` — clean incl. service worker precache
- Headless Chromium (desktop + iPad viewport): dashboard, navigation, theories,
  EYLF, project CRUD, story CRUD, chat dock with Temporary badge, bottom nav —
  **zero console errors**

## 📁 Layout

```
src/
  components/   AppShell, AppSidebar, ChatDock, MindMapEditor,
                EylfOutcomePicker, TheoryPicker, MarkdownView, ToastHost
  views/        Dashboard, Projects, ProjectWorkspace, LearningOutcomes,
                LearningStories, Newsletter, ProgramBook,
                TheoryLibrary, Eylf, Settings
  stores/       auth, project, content, chat (temporary), ui
  services/     supabase, ai (Edge Function client), repo (Supabase↔local),
                localStore
  data/         eylf, theories, reggio, prompts
supabase/
  migrations/0001_init.sql   tables + RLS + triggers + signup hook
  functions/chat/index.ts    Groq proxy (streaming, JSON mode, CORS)
```

## ⚠️ Notes & limitations

- AI features require the deployed `chat` function; in demo mode they explain
  exactly how to set it up.
- Speech recognition depends on the browser (Safari/iPadOS and Chrome are best).
- Mind-map images export is not included in v1 — JSON autosave is.
- Keep children’s surnames and sensitive details out of AI prompts.

Built for **Hadfield Early Learning Centre** 🌏 — Belonging, Being & Becoming.
