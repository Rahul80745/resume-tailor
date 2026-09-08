import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  getSettings, saveSettings,
  getMaster, saveMaster, deleteMaster,
  insertTailoring, getTailoring, listTailorings, updateTailoring, deleteTailoring,
} from './db.js';
import { MODES, modeList, buildResumePrompt, buildCoverLetterPrompt, DEFAULT_DIRECTIVES } from './prompts.js';
import { resumePdf, coverLetterPdf } from './pdf.js';
import { testConnection, chatJSON } from './deepseek.js';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

app.use(cors());
app.use(express.json({ limit: '4mb' }));

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const mask = (k) => (k ? `${k.slice(0, 6)}${'•'.repeat(12)}${k.slice(-4)}` : '');

/* ------------------------------------------------------------------ */
/* meta                                                                */
/* ------------------------------------------------------------------ */
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/api/modes', (req, res) => res.json(modeList()));

/* the built-in prompt text, so Settings can show it and offer a reset */
app.get('/api/prompts/defaults', (req, res) => res.json(DEFAULT_DIRECTIVES));

/* ------------------------------------------------------------------ */
/* settings                                                            */
/* ------------------------------------------------------------------ */
app.get('/api/settings', (req, res) => {
  const s = getSettings();
  res.json({ ...s, api_key: mask(s.api_key), has_key: Boolean(s.api_key) });
});

app.put('/api/settings', wrap(async (req, res) => {
  const patch = { ...req.body };
  // an unchanged masked key must not overwrite the real one
  if (patch.api_key && patch.api_key.includes('•')) delete patch.api_key;
  const s = saveSettings(patch);
  res.json({ ...s, api_key: mask(s.api_key), has_key: Boolean(s.api_key) });
}));

app.post('/api/settings/test', wrap(async (req, res) => {
  const saved = getSettings();
  const apiKey = req.body?.api_key && !req.body.api_key.includes('•') ? req.body.api_key : saved.api_key;
  const result = await testConnection({
    apiKey,
    baseUrl: req.body?.base_url || saved.base_url,
    model: req.body?.model || saved.model,
  });
  res.json(result);
}));

/* ------------------------------------------------------------------ */
/* master resume                                                       */
/* ------------------------------------------------------------------ */
app.get('/api/master', (req, res) => res.json(getMaster()));

app.put('/api/master', wrap(async (req, res) => {
  const content = (req.body?.content || '').trim();
  if (content.length < 100) return res.status(400).json({ error: 'That resume looks too short to work from. Paste the full text.' });
  res.json(saveMaster({ name: req.body.name, sourceName: req.body.source_name, content }));
}));

app.delete('/api/master', (req, res) => { deleteMaster(); res.json({ ok: true }); });

/* ------------------------------------------------------------------ */
/* file -> text                                                        */
/* ------------------------------------------------------------------ */
app.post('/api/extract', upload.single('file'), wrap(async (req, res) => {
  const f = req.file;
  if (!f) return res.status(400).json({ error: 'No file received.' });
  const name = f.originalname || 'resume';
  let text = '';

  if (/pdf$/i.test(name) || f.mimetype === 'application/pdf') {
    const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');
    text = (await pdfParse(f.buffer)).text;
  } else if (/docx$/i.test(name)) {
    const mammoth = await import('mammoth');
    text = (await mammoth.extractRawText({ buffer: f.buffer })).value;
  } else if (/\.(txt|md|rtf)$/i.test(name) || /^text\//.test(f.mimetype)) {
    text = f.buffer.toString('utf8');
  } else {
    return res.status(415).json({ error: 'Upload a PDF, DOCX, or plain-text file.' });
  }

  text = text.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (text.length < 100) {
    return res.status(422).json({ error: 'Almost no text came out of that file — it may be a scan. Paste the text instead.' });
  }
  res.json({ name, characters: text.length, content: text });
}));

/* ------------------------------------------------------------------ */
/* tailor                                                              */
/* ------------------------------------------------------------------ */
app.post('/api/tailor', wrap(async (req, res) => {
  const { mode = 'normal', jd = '', instructions = '', use_master = false, resume_text = '', source_name = '' } = req.body || {};

  if (!MODES[mode]) return res.status(400).json({ error: 'Unknown tailoring mode.' });
  if (jd.trim().length < 60) return res.status(400).json({ error: 'Paste the full job description — there is not enough here to tailor against.' });

  let resumeText = resume_text.trim();
  if (use_master) {
    const m = getMaster();
    if (!m) return res.status(400).json({ error: 'No master resume saved yet. Save one first, or upload a resume.' });
    resumeText = m.content; // a copy is used; the stored master is never modified
  }
  if (resumeText.length < 100) return res.status(400).json({ error: 'Add your resume before tailoring.' });

  const settings = getSettings();
  const cfg = { apiKey: settings.api_key, baseUrl: settings.base_url, model: settings.model };
  const m = MODES[mode];

  const { parsed } = await chatJSON({
    ...cfg,
    prompt: buildResumePrompt({ mode, resumeText, jd, instructions, directives: settings[`prompt_${mode}`] }),
    temperature: m.temperature,
    maxTokens: 8000,
  });

  if (!parsed?.resume) {
    return res.status(502).json({ error: 'The model returned an unexpected shape. Try again.' });
  }

  let cover = null;
  try {
    const letter = await chatJSON({
      ...cfg,
      prompt: buildCoverLetterPrompt({ resume: parsed.resume, jd, instructions, mode, directives: settings.prompt_cover }),
      temperature: 0.6,
      maxTokens: 1500,
    });
    cover = letter.parsed;
  } catch {
    cover = null; // the resume still ships; the UI offers a retry
  }

  const saved = insertTailoring({
    title: parsed.job_title || null,
    company: parsed.company || null,
    mode,
    instructions: instructions || null,
    jd,
    source_name: use_master ? 'Master resume' : (source_name || null),
    source_text: resumeText,
    ats_score: Number.isFinite(parsed.ats_score) ? Math.round(parsed.ats_score) : null,
    analysis: JSON.stringify(parsed.analysis || {}),
    resume_json: JSON.stringify(parsed.resume),
    cover_letter: cover ? JSON.stringify(cover) : null,
  });

  res.json(hydrate(saved));
}));

app.post('/api/tailorings/:id/cover-letter', wrap(async (req, res) => {
  const row = getTailoring(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found.' });
  const s = getSettings();
  const { parsed } = await chatJSON({
    apiKey: s.api_key, baseUrl: s.base_url, model: s.model,
    prompt: buildCoverLetterPrompt({
      resume: JSON.parse(row.resume_json), jd: row.jd, instructions: row.instructions,
      mode: row.mode, directives: s.prompt_cover,
    }),
    temperature: 0.6,
    maxTokens: 1500,
  });
  res.json(hydrate(updateTailoring(row.id, { cover_letter: JSON.stringify(parsed) })));
}));

/* ------------------------------------------------------------------ */
/* pdf export                                                          */
/* ------------------------------------------------------------------ */
const safeName = (s) => (s || 'document').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

app.post('/api/export/pdf', wrap(async (req, res) => {
  const { kind = 'resume', resume, cover_letter, template, filename } = req.body || {};
  const tpl = template || getSettings().template;
  if (!resume && kind === 'resume') return res.status(400).json({ error: 'Nothing to export.' });

  const buffer = kind === 'cover_letter'
    ? await coverLetterPdf(cover_letter, resume, tpl)
    : await resumePdf(resume, tpl);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName(filename)}.pdf"`);
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
}));

/* ------------------------------------------------------------------ */
/* history                                                             */
/* ------------------------------------------------------------------ */
app.get('/api/history', (req, res) => res.json(listTailorings(Number(req.query.limit) || 50)));

app.get('/api/history/:id', (req, res) => {
  const row = getTailoring(req.params.id);
  return row ? res.json(hydrate(row)) : res.status(404).json({ error: 'Not found.' });
});

app.patch('/api/history/:id', wrap(async (req, res) => {
  const patch = {};
  if (req.body.resume) patch.resume_json = JSON.stringify(req.body.resume);
  if (req.body.cover_letter) patch.cover_letter = JSON.stringify(req.body.cover_letter);
  if (req.body.title !== undefined) patch.title = req.body.title;
  const row = updateTailoring(req.params.id, patch);
  return row ? res.json(hydrate(row)) : res.status(404).json({ error: 'Not found.' });
}));

app.delete('/api/history/:id', (req, res) => { deleteTailoring(req.params.id); res.json({ ok: true }); });

function hydrate(row) {
  return {
    ...row,
    analysis: row.analysis ? JSON.parse(row.analysis) : {},
    resume: row.resume_json ? JSON.parse(row.resume_json) : null,
    cover_letter: row.cover_letter ? JSON.parse(row.cover_letter) : null,
    resume_json: undefined,
    source_text: undefined,
  };
}

/* ------------------------------------------------------------------ */
/* static client (after `npm run build` in /client)                    */
/* ------------------------------------------------------------------ */
const thisDir = new URL('.', import.meta.url).pathname.replace(/\/$/, '');
const dist = resolve(thisDir, '../../client/dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(resolve(dist, 'index.html')));
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Unexpected server error.' });
});

const port = process.env.PORT || 5174;
app.listen(port, () => console.log(`Resume Tailor API on http://localhost:${port}`));
