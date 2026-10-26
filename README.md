# ResumeForge

**Build it. Tailor it. Land it.**

A free resume and cover letter builder with a live preview, clean PDF and Word export, and a
job match checker that compares your resume against a pasted job description.

Everything you type stays in your browser. No accounts, no database, no AI service, no tracking.

**Live demo:** https://resumeforge-teal.vercel.app

---

## Purpose

Most resume builders either charge for export, require an account, or upload your employment
history to a server. ResumeForge does none of those things. It runs as a static SvelteKit app
with exactly two server routes (PDF and Word generation), both stateless. Your resumes, cover
letters and applications live in this browser's `localStorage` and are never uploaded.

## Features

### Resume editor
- Section list and editor on the left, live preview on the right; stacked with a Preview toggle on mobile.
- Autosave with a visible "Saved" indicator, plus undo and redo (`Cmd/Ctrl+Z`, `Cmd/Ctrl+Shift+Z`).
  A pending save is flushed when the tab is hidden or closed, so an edit is never lost mid-debounce.
- Sections: personal details, summary, experience, education, skills (grouped), projects,
  certifications, languages, awards, and custom sections you name yourself.
- Add, remove, hide and reorder sections and the items inside them — by drag handle **and** by
  Move up / Move down buttons, so reordering works with a keyboard and on touch screens.
- Month/year pickers with a "Present" option, shown consistently as "Jan 2022 – Present", with a
  warning when an end date precedes its start date.
- Bullets: add, remove, reorder, a live character guide, and inline flags for weak phrases and
  missing action verbs. A list of strong action verbs is one click away.
- Optional photo (off by default), compressed under 100 KB, with a note that photos are common in
  some regions but not recommended where automated screening is used.
- Page setup: A4 or US Letter, margins, font size, line spacing, section spacing, and a
  **Fit to one page** helper that reduces spacing before font size and tells you plainly when the
  content still does not fit.
- The preview renders as real paper pages with a soft shadow, zoom controls and a page count.

### Templates and style
Five templates — Classic, Modern, Compact, Minimal and Executive. Classic and Minimal are
single-column and deliberately plain. Executive is two-column and is labelled
*"Less suited to automated screening"* in the UI.

Choose an accent colour, a heading style, and one of four self-hosted open-licensed fonts
(Inter, Source Serif 4, Lato, IBM Plex Sans). Switching templates never loses content, and you can
save a favourite style as the default for new resumes.

### Export
- **PDF** via a SvelteKit server route using `pdf-lib`, with fonts embedded as real glyph outlines.
  The text is selectable (not an image), links are real PDF link annotations, and the page count
  matches the preview.
- **Print or save as PDF** using a print stylesheet, always available as a backup.
- **DOCX** via `docx` with real `Heading` styles and real bullet lists — no tables or text boxes
  used for layout, so it opens cleanly in Word and Google Docs.
- **Plain text** and **JSON** export of a single resume.
- File names like `Resume_Ravi_Anand_Junior_Software_Developer.pdf`.

### Job match checker
Paste a job description, pick a resume, and everything is analysed in your browser:

- Tokenise the text, strip stop words, and detect one-to-three word phrases.
- Match against a bundled dictionary of **343 skills, tools and role terms** (**784 surface forms**
  once aliases and abbreviations are counted) across technology, business, design and operations.
- Handle plurals, variants and abbreviations — `JS` → JavaScript, `ML` → machine learning,
  `k8s` → Kubernetes, `GCP` → Google Cloud.
- Results: a 0–100 score, matched keyword chips, missing keywords each with a suggested section to
  add it to, and matched keywords highlighted directly in the preview.
- **Resume health checks** in plain language: missing contact details, no summary, bullets that do
  not start with an action verb, weak phrases ("responsible for", "worked on"), bullets with no
  numbers, over-long bullets, resumes longer than two pages, very thin sections, inconsistent date
  formats, and over-repeated words.
- **Tailor a copy** duplicates the resume, links it to the job, and keeps a score history for that
  version so you can watch it improve.

ResumeForge never invents achievements and never writes content for you. It points at problems and
offers verbs; the words stay yours.

### Versions and applications
A resume library with name, tag, last-edited date, page count, duplicate, rename, delete (with
confirmation), and a simple line-level text compare of two versions. A light applications list
tracks job title, company, link, date applied, status (Saved / Applied / Interview / Offer /
Rejected), the resume version used, and notes, with counts by status.

### Cover letters
Recipient, company, role, how you heard of the job, and three prompts for your own key points.
Tone choice (Formal, Friendly, Concise). Template text fills `{company}` and `{role}`
automatically and stays fully editable. Live preview, word count, a "keep it under one page"
indicator, and export to PDF, DOCX and plain text in a style matching the resume.

---

## How the match score works, and its limits

The score is the **weighted share of job-description keywords that also appear in your resume**:

```
score = round( matched_weight / total_weight * 100 )
```

Each keyword found in the job description is weighted by how the ad frames it:

| Importance | Weight | How it is detected |
| --- | --- | --- |
| Required | 2 | Under a "Requirements" heading, or near words like *required*, *must have*, *essential*, *proficiency* |
| Nice to have | 1 | Under a "Nice to have" heading, or near *bonus*, *preferred*, *desirable*, *ideally*, *a plus* |

A short line such as `Nice to have:` acts as a heading for the bullets beneath it, so those are
weighted as optional unless a bullet explicitly says *required* or *must have*.

### What the score is not

> **This is an estimate based on keyword matching. It is not how any specific company's screening
> software scores resumes.**

That sentence appears next to every score in the app. Specifically:

- It only measures **keyword overlap** against a bundled dictionary. It does not read meaning,
  judge seniority, weigh your experience, or assess writing quality.
- A term the dictionary does not contain cannot be matched, so a niche stack may score low while
  being a perfect fit.
- Real screening systems differ wildly, are usually configured per employer, and are not public.
  No score here predicts or guarantees an interview.
- Only add a missing keyword if it is **genuinely true of you**. The tool suggests where a term
  would go; it never suggests claiming a skill you do not have.

---

## Storage and backup limits

| | |
| --- | --- |
| Where data lives | This browser's `localStorage`, on this device only |
| What is uploaded | Nothing. PDF/DOCX routes receive a document, return a file, and store nothing |
| Accounts / database | None |
| Practical size limit | ~5 MB of browser storage; photos are compressed under 100 KB |

- Clearing your browser data **deletes everything**. Export a JSON backup.
- Data does not follow you to another browser, device or private window.
- Every storage access is wrapped in `try/catch`, with a size check before saving. If storage is
  full or blocked (some private-browsing modes), the app keeps working for the session, says so
  clearly, and asks you to export a backup before closing the tab.
- A persistent "Your data stays in this browser" badge is shown on every screen, a
  **Privacy and backup** page explains the details, and a **Last backup** date with a reminder
  appears when there has been no backup for 14 days.
- JSON backup export and import is validated: malformed JSON, non-backup files, backups from a
  newer version, and out-of-range values all produce clear errors and change nothing. Dangling
  references (a cover letter pointing at a deleted resume) are repaired with a warning.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | SvelteKit 3 + Svelte 5 (runes) + TypeScript |
| Styling | Tailwind CSS 4 |
| PDF | `pdf-lib` + `@pdf-lib/fontkit` (fonts embedded, real selectable text) |
| DOCX | `docx` (real headings and bullet lists) |
| Charts | Hand-written SVG — the score ring is ~20 lines, no chart library |
| Hosting | Vercel, free Hobby plan, `@sveltejs/adapter-vercel` (`nodejs22.x`) |
| Storage | `localStorage` behind a `ResumeStore` interface |
| Tests | Vitest (unit) + Playwright (end to end) |

All dependencies are pinned to exact versions at least two weeks old.

### Why layout lives in one module

`src/lib/logic/layout.ts` is the single layout engine. It converts a resume into positioned
text runs and paginates them, and **three** consumers read that same output: the on-screen
preview, the page counter / fit helper, and the `pdf-lib` writer. The PDF matches the preview by
construction rather than by coincidence.

Text measurement comes from real font metrics: `scripts/build-metrics.mjs` parses the `cmap`,
`hmtx`, `head` and `hhea` tables of the shipped TTFs into `src/lib/logic/font-metrics.json`, so the
browser and the server wrap lines identically.

Page-break rules enforced by the engine:
- a section heading is never left alone at the bottom of a page;
- an entry heading is never split from its first bullet.

### Architecture

```
src/
  lib/
    logic/          pure, unit-tested modules (no DOM, no framework)
      keywords.ts     tokenising, phrase detection, synonyms/abbreviations
      dictionary.ts   343 skills, 271 action verbs, weak phrases
      score.ts        weighted match score
      health.ts       bullet and resume quality checks
      layout.ts       layout + pagination engine (shared with the PDF writer)
      measure.ts      text measurement from real font metrics
      fit.ts          "fit to one page" search
      dates.ts        month/year formatting, local-date handling
      validate.ts     JSON backup import validation
      docx-structure.ts  semantic DOCX block structure
    server/         PDF and DOCX generation (server only)
    store/
      resume-store.ts    the ResumeStore interface + localStorage implementation
      app-state.svelte.ts  app state, autosave, undo/redo
  routes/
    api/export/pdf    the only two server routes
    api/export/docx
```

### A note on dates

Local dates (such as "date applied") are stored as plain `yyyy-mm-dd` strings and parsed into
local components — never through `new Date(string)`, which parses as UTC and can shift the day
backwards in negative-offset time zones. Day arithmetic uses midday anchors so DST transitions
cannot round a day away. There are unit tests for both cases.

---

## Testing

```bash
npm test          # 146 unit tests
npm run check     # svelte-check: 0 errors, 0 warnings
npm run build     # production build
```

**146 unit tests** across the logic modules: date formatting and validation, tokenising, plurals
and abbreviations, phrase detection, required vs nice-to-have weighting, score calculation,
bullet-quality checks, resume health, text measurement, word wrapping, layout and pagination
(including both page-break rules), fit-to-one-page, JSON import validation with malformed files,
DOCX structure, cover letter templates, file names, sample-data integrity, and robustness cases
(very long and very short resumes, special characters, non-English names, a 3,000-word job
description).

**17 end-to-end browser checks** (`probes/`, run against a live server) cover the full flow: open
the sample resume → edit a section and confirm autosave survives a reload → reorder by keyboard
→ reorder by drag and drop → switch all five templates, four colours and four fonts → fit to one
page → download PDF, Word, text and JSON → run the match checker → tailor a copy → write and
export a cover letter → add an application → JSON backup and import including a deliberately
broken file → non-English names → 360px mobile layout → dark mode (verifying resume pages stay
white) → a 3,795-word job description → and a sweep for console errors on every page.

The generated PDF is additionally verified by extracting its text with `pdfjs-dist` and asserting
the **reading order** (name → summary → experience → education), and the DOCX is unzipped to
confirm 0 layout tables, 0 text boxes, real heading styles and real bullet lists.

To run the end-to-end probes:

```bash
npm run build && npx vite preview --port 4179 &
RF_BASE=http://localhost:4179 npx vitest run --config probes/vitest.probe.config.ts
```

---

## Setup

Requires Node 20+.

```bash
git clone https://github.com/DIVYAPRIYADHARSHINI-GIT/resumeforge.git
cd resumeforge
npm install
npm run dev
```

Open http://localhost:5173. Sample data loads automatically on first visit.

```bash
npm run dev       # dev server
npm run build     # production build
npm run preview   # preview the production build
npm test          # unit tests
npm run check     # type checking
npm run metrics   # regenerate font metrics after changing the shipped fonts
```

### Deployment

The app is hosted on **Vercel's free Hobby plan**, which is for non-commercial use only. The
hosting project is the **only** Vercel resource used — no Blob, KV, Postgres, Edge Config or any
other Marketplace product, because the app has no server-side state to store. Pushes to `main`
auto-deploy.

## Sample data

Two fictional resumes (a junior software developer and a marketing coordinator), one job
description written for a fictional company, one finished cover letter, and six applications
covering every status. Every person, company, email address, phone number and domain is invented:
emails use `@example.com`, phone numbers use the reserved `555` range, and company links use
`.example` domains that cannot resolve. **Load sample data** and **Start fresh** are in Settings,
each behind a confirmation dialog.

## Accessibility

WCAG AA contrast, 44px minimum tap targets, full keyboard navigation including reordering,
visible focus states, aria labels on controls, and status meaning never conveyed by colour alone
(badges and score bands are always labelled in words). Motion is subtle and
`prefers-reduced-motion` is respected. The interface is responsive from 360px upward, and dark
mode applies to the interface while resume pages stay white like paper.

## Licence

Source released for personal use. The bundled fonts are under the SIL Open Font License:
Inter, Lato and IBM Plex Sans (OFL-1.1) and Source Serif 4 (OFL-1.1).
