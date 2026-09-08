# Resume Tailor

A local, full-stack resume tailoring app. Paste a job description, pick how aggressively you want your resume reshaped, and DeepSeek writes a tailored resume plus a matching cover letter. Everything is editable, exportable to PDF or Word, and stored locally.

No login. Nothing leaves your machine except the calls you make to DeepSeek.

## Stack

- **Frontend** — React + Vite (`/client`)
- **Backend** — Node + Express (`/server`)
- **Database** — SQLite via Node's built-in `node:sqlite`, file at `server/data/app.db` (nothing to compile)
- **LLM** — DeepSeek (`deepseek-chat` or `deepseek-reasoner`), key entered in Settings
- **PDF** — generated server-side with pdfkit (pure JS), so the download is a real file with selectable text

## Run it

You need Node 22.5 or newer — the database uses Node's built-in SQLite, so there is no native module to build and no Visual Studio or Xcode toolchain required.

On Node 22 the built-in SQLite is still behind a flag, so use `npm run start:node22` instead of `npm start`. On Node 23+ plain `npm start` works.

```bash
# terminal 1 — backend on :5174
cd server
npm install
npm start

# terminal 2 — frontend on :5173
cd client
npm install
npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api` to the backend, so there is no CORS setup to do.

First run opens Settings. Paste your DeepSeek API key (from platform.deepseek.com), press **Connect and test** to confirm it works, then **Save settings**.

### Single-process production build

```bash
cd client && npm run build
cd ../server && npm start      # serves the built client from the same port
```

## What each part does

### The three tailoring options

All three run a complete tailoring pass — the summary is rewritten, relevant experience is rewritten, job-description skills are added, keywords are aligned. They differ in how aggressively the resume is reshaped, which is enforced by three separate instruction blocks in `server/src/prompts.js` plus a different sampling temperature for each.

| | Normal | Skills-focused | Highly tailored |
|---|---|---|---|
| Rewrite summary | Yes | Yes | Extensively |
| Rewrite experience | Yes | Yes | Yes |
| Add JD skills | Some | Many | Maximum |
| Keyword optimization | Medium | High | Maximum |
| Transferable skills | Limited | Strong | Extensive |
| New JD-aligned content | Limited | Moderate | Maximum |
| Resume changes | Moderate | Strong | Extensive |
| ATS optimization | Moderate | High | Maximum |
| Similarity to original | High | Medium | Lower |
| Temperature | 0.3 | 0.5 | 0.65 |

Integrity rules apply in every mode: employers, titles, dates, degrees and certifications are never invented or altered. Anything the model adds that your source resume does not clearly support is listed back to you under **Verify before you send**, and requirements you genuinely do not meet are listed under **Requirements you do not meet** rather than papered over.

### Settings

- **Tailoring instructions** — the instruction block sent to the model for each of the three options, plus the cover letter, editable in a tabbed editor. "Load default into editor" copies the built-in wording in so you can adjust it; "Reset to default" clears your version. A dot on a tab means that option is customised. The integrity rules are appended separately and cannot be edited away, so a rewritten prompt still cannot invent an employer.
- **Appearance** — light or dark, saved to the database. The resume preview stays on white paper in both, since that is how it prints.
- **DeepSeek connection** — API key, model, base URL, and a Connect and test button that makes a real 8-token call and reports the model and round-trip latency.
- **Resume format** — four ATS-safe styles (Classic ATS, Compact one-page, Modern sans, Executive serif), each shown as a live thumbnail. All are single-column with no tables, columns or graphics, which is what resume parsers need. The choice applies to the on-screen preview, the PDF and the Word export.
- **Master resume** — upload a PDF, DOCX or text file, or paste it. Stored once and used as the source for any tailoring. Tailoring always works on a copy; the stored master is never modified.

### Database

Three tables in `server/src/db.js`:

- `settings` — key, model, base URL, chosen template
- `master_resume` — single row, your source resume
- `tailorings` — every run: job title, company, mode, instructions, the job description, ATS score, analysis, the resume JSON and the cover letter

History is browsable from the top bar; opening an entry restores it for further editing.

### Editing and export

The resume is stored as structured JSON, not free text, which is what lets one document render through four different formats. The editor gives you fields for the summary, skill groups, every role and bullet, education and certifications. Save writes back to SQLite.

**PDF** is built on the server with pdfkit and downloads straight to your machine — no print dialogue. The text stays real text rather than an image, which matters because an ATS cannot read a rasterised resume at all. Each template maps to its own typography config (fonts, sizes, rules, margins), and job titles are drawn before dates so extraction reads "Role — Company" in the right order. **Word** export produces a `.doc` that Word and Google Docs both open.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/modes` | The three tailoring options and their comparison matrix |
| GET/PUT | `/api/settings` | Read and save settings (the key is returned masked) |
| POST | `/api/settings/test` | Live DeepSeek connection test |
| GET/PUT/DELETE | `/api/master` | Master resume |
| POST | `/api/extract` | PDF/DOCX/TXT upload to plain text |
| GET | `/api/prompts/defaults` | The built-in instruction text, for the editor's reset |
| POST | `/api/export/pdf` | Renders resume or cover letter to a downloadable PDF |
| POST | `/api/tailor` | Run a tailoring, save it, return resume + analysis + cover letter |
| POST | `/api/tailorings/:id/cover-letter` | Regenerate the cover letter |
| GET/PATCH/DELETE | `/api/history/:id` | Read, save edits, delete |

## Notes

- Scanned PDFs have no text layer; the upload endpoint tells you to paste the text instead rather than sending an empty resume to the model.
- Every dependency is pure JavaScript. If `npm install` ever fails on a native build, you are running an old copy of `package.json` that still lists `better-sqlite3`.
- The key sits in plain text in the SQLite file. That is fine for a local tool on your own machine — do not deploy this to a shared server as-is.
- `deepseek-reasoner` produces better tailoring on complex resumes but is slower and costs more per run.
