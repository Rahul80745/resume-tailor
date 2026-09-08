import React, { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import Settings, { scoped } from './Settings.jsx';
import Editor, { CoverLetterEditor } from './Editor.jsx';
import {
  TEMPLATES, templateList, resumeToHtml, coverLetterToHtml,
  downloadWord, resumeToText,
} from './templates.js';

export default function App() {
  const [settings, setSettings] = useState(null);
  const [modes, setModes] = useState([]);
  const [master, setMaster] = useState(null);
  const [history, setHistory] = useState([]);

  const [useMaster, setUseMaster] = useState(false);
  const [resumeText, setResumeText] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [jd, setJd] = useState('');
  const [mode, setMode] = useState('skills');
  const [instructions, setInstructions] = useState('');

  const [result, setResult] = useState(null);
  const [draft, setDraft] = useState(null);        // edited resume, unsaved
  const [letterDraft, setLetterDraft] = useState(null);
  const [editing, setEditing] = useState(null);    // 'resume' | 'letter' | null

  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const fileRef = useRef();
  const shownRef = useRef({});
  const fileBaseRef = useRef('Resume');

  const template = TEMPLATES[settings?.template] || TEMPLATES.classic;
  const theme = settings?.theme === 'dark' ? 'dark' : 'light';

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;          // instant, no wait on the round trip
    setSettings((s) => ({ ...s, theme: next }));
    try { await api.saveSettings({ theme: next }); } catch { /* stays applied this session */ }
  };

  useEffect(() => {
    (async () => {
      try {
        const [s, m, ms, h] = await Promise.all([api.getSettings(), api.modes(), api.getMaster(), api.history()]);
        setSettings(s); setModes(m); setMaster(ms); setHistory(h);
        if (ms) setUseMaster(true);
        if (!s.has_key) setShowSettings(true);
      } catch (e) {
        setError('Cannot reach the server. Start it with `npm start` in /server.');
      }
    })();
  }, []);

  const say = (m) => { setFlash(m); setTimeout(() => setFlash(''), 2500); };

  const onFile = async (file) => {
    if (!file) return;
    setError(''); setBusy('Reading file');
    try {
      const r = await api.extract(file);
      setResumeText(r.content);
      setSourceName(r.name);
      setUseMaster(false);
    } catch (e) { setError(e.message); }
    finally { setBusy(''); }
  };

  const sourceReady = useMaster ? !!master : resumeText.trim().length >= 100;

  const tailor = async () => {
    setError('');
    if (!settings?.has_key) { setShowSettings(true); return setError('Add your DeepSeek API key in Settings first.'); }
    if (!sourceReady) return setError('Add your resume — upload a file, paste the text, or use your master resume.');
    if (jd.trim().length < 60) return setError('Paste the full job description.');

    setBusy('Tailoring your resume'); setResult(null); setDraft(null); setLetterDraft(null); setEditing(null);
    try {
      const r = await api.tailor({
        mode, jd, instructions,
        use_master: useMaster,
        resume_text: useMaster ? '' : resumeText,
        source_name: sourceName,
      });
      setResult(r); setDraft(r.resume); setLetterDraft(r.cover_letter);
      setHistory(await api.history());
    } catch (e) { setError(e.message); }
    finally { setBusy(''); }
  };

  const saveEdits = async () => {
    setBusy('Saving');
    try {
      const r = await api.updateTailoring(result.id, { resume: draft, cover_letter: letterDraft || undefined });
      setResult(r); setEditing(null); say('Changes saved.');
    } catch (e) { setError(e.message); }
    finally { setBusy(''); }
  };

  const openFromHistory = async (id) => {
    setBusy('Loading');
    try {
      const r = await api.getTailoring(id);
      setResult(r); setDraft(r.resume); setLetterDraft(r.cover_letter);
      setJd(r.jd); setMode(r.mode); setInstructions(r.instructions || '');
      setShowHistory(false); setEditing(null);
    } catch (e) { setError(e.message); }
    finally { setBusy(''); }
  };

  const makeLetter = async () => {
    setBusy('Writing cover letter');
    try {
      const r = await api.retryCoverLetter(result.id);
      setResult(r); setLetterDraft(r.cover_letter);
    } catch (e) { setError(e.message); }
    finally { setBusy(''); }
  };

  const savePdf = async (kind) => {
    setBusy('Building PDF');
    try {
      await api.downloadPdf({
        kind,
        resume: shownRef.current.resume,
        cover_letter: shownRef.current.letter,
        template: settings.template,
        filename: kind === 'cover_letter' ? `${fileBaseRef.current}-Cover-Letter` : `${fileBaseRef.current}-Resume`,
      });
    } catch (e) { setError(e.message); }
    finally { setBusy(''); }
  };

  const shown = draft || result?.resume;
  const shownLetter = letterDraft || result?.cover_letter;
  const fileBase = (shown?.name || 'Resume').replace(/\s+/g, '-');
  shownRef.current = { resume: shown, letter: shownLetter };
  fileBaseRef.current = fileBase;

  if (!settings) {
    return <div className="boot">{error || 'Starting…'}</div>;
  }

  return (
    <div className="app">
      <style>{scoped(template.id, template.css)}</style>

      <header className="topbar">
        <div className="brand">
          <span className="mark">RT</span>
          <div>
            <strong>Resume Tailor</strong>
            <span className="muted small"> One job, one version of you</span>
          </div>
        </div>
        <div className="topbar-actions">
          <span className={`dot ${settings.has_key ? 'ok' : 'bad'}`} />
          <span className="muted small">{settings.has_key ? `${settings.model} connected` : 'No API key'}</span>
          <button className="btn ghost" onClick={toggleTheme} title="Switch theme" aria-label="Switch theme">
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <button className="btn ghost" onClick={() => setShowHistory(true)}>History ({history.length})</button>
          <button className="btn" onClick={() => setShowSettings(true)}>Settings</button>
        </div>
      </header>

      <main className="layout">
        {/* ---------------- left: inputs ---------------- */}
        <aside className="panel-col">
          <section className="card">
            <div className="card-head"><h3>Your resume</h3></div>

            {master && (
              <label className="check">
                <input type="checkbox" checked={useMaster} onChange={(e) => setUseMaster(e.target.checked)} />
                <span>Use master resume<span className="muted small"> · {master.source_name || 'saved'}</span></span>
              </label>
            )}

            {!useMaster && (
              <>
                <button className="dropzone" onClick={() => fileRef.current.click()}>
                  {sourceName ? <><strong>{sourceName}</strong><span className="muted small">{resumeText.length.toLocaleString()} characters · click to replace</span></>
                    : <><strong>Upload resume</strong><span className="muted small">PDF, DOCX, TXT</span></>}
                </button>
                <input ref={fileRef} type="file" hidden accept=".pdf,.docx,.txt,.md"
                  onChange={(e) => onFile(e.target.files[0])} />
                <textarea className="input" rows={4} placeholder="…or paste your resume text"
                  value={resumeText} onChange={(e) => { setResumeText(e.target.value); setSourceName(''); }} />
                {resumeText.trim().length >= 100 && (
                  <button className="link" onClick={async () => {
                    const m = await api.saveMaster({ content: resumeText, source_name: sourceName || 'Pasted' });
                    setMaster(m); say('Saved as your master resume.');
                  }}>Save this as my master resume</button>
                )}
              </>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <h3>Job description</h3>
              <span className="muted small">{jd.length ? `${jd.length.toLocaleString()} characters` : ''}</span>
            </div>
            <textarea className="input" rows={8} placeholder="Paste the complete job description here…"
              value={jd} onChange={(e) => setJd(e.target.value)} />
            {jd && <button className="link" onClick={() => setJd('')}>Clear</button>}
          </section>

          <section className="card">
            <div className="card-head"><h3>How far should it go?</h3></div>
            <div className="modes">
              {modes.map((m) => (
                <button key={m.id} className={`mode ${mode === m.id ? 'on' : ''}`} onClick={() => setMode(m.id)}>
                  <div className="mode-head">
                    <strong>{m.name}</strong>
                    <span className="tag">{m.effectiveness}</span>
                  </div>
                  <p className="muted small">{m.blurb}</p>
                  {mode === m.id && (
                    <dl className="matrix">
                      {Object.entries(m.matrix).map(([k, v]) => (
                        <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
                      ))}
                    </dl>
                  )}
                </button>
              ))}
            </div>
            <p className="muted small">All three rewrite the summary and your experience. The difference is how aggressively the resume is reshaped around this job.</p>
          </section>

          <section className="card">
            <div className="card-head"><h3>Anything else?</h3><span className="muted small">optional</span></div>
            <textarea className="input" rows={3}
              placeholder="Keep it to one page. Lead with my leadership experience."
              value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          </section>

          <button className="btn primary big" onClick={tailor} disabled={!!busy}>
            {busy ? `${busy}…` : 'Tailor my resume'}
          </button>
          {error && <div className="notice bad">{error}</div>}
          {flash && <div className="notice ok">{flash}</div>}
        </aside>

        {/* ---------------- right: output ---------------- */}
        <section className="output-col">
          {!result && !busy && (
            <div className="empty">
              <h2>Your tailored resume appears here</h2>
              <p className="muted">
                Add a resume and the job description, choose how aggressive the rewrite should be, and a matching cover
                letter is written alongside it. Everything stays editable.
              </p>
            </div>
          )}

          {busy && !result && <div className="empty"><h2>{busy}…</h2><p className="muted">DeepSeek usually takes 20–40 seconds.</p></div>}

          {result && (
            <>
              <div className="card analysis">
                <div className="score">
                  <Ring value={result.ats_score} />
                  <div>
                    <strong>Estimated ATS match</strong>
                    <p className="muted small">Keyword and requirement coverage against this job description.</p>
                  </div>
                </div>
                <div className="chip-groups">
                  <Group title="Already in your resume" items={result.analysis?.existing} tone="have" />
                  <Group title="Added from the job description" items={result.analysis?.added} tone="add" />
                  <Group title="Reframed as transferable" items={result.analysis?.transferable} tone="add" />
                  <Group title="Verify before you send" items={result.analysis?.review} tone="review" />
                  <Group title="Requirements you do not meet" items={result.analysis?.missing} tone="miss" />
                </div>
                {result.analysis?.changes?.length > 0 && (
                  <details className="changes">
                    <summary>What changed ({result.analysis.changes.length})</summary>
                    <ul>{result.analysis.changes.map((c, i) => <li key={i}>{c}</li>)}</ul>
                  </details>
                )}
              </div>

              <DocCard
                title="Tailored resume"
                meta={`${modes.find((m) => m.id === result.mode)?.name || result.mode} · ${template.name}`}
                templateId={template.id}
                html={resumeToHtml(shown)}
                editing={editing === 'resume'}
                onToggleEdit={() => setEditing(editing === 'resume' ? null : 'resume')}
                onSave={saveEdits}
                onCopy={() => { navigator.clipboard.writeText(resumeToText(shown)); say('Plain text copied.'); }}
                onPdf={() => savePdf('resume')}
                onWord={() => downloadWord(resumeToHtml(shown), template.css, `${fileBase}-Resume`)}
                extra={
                  <select className="input inline" value={settings.template}
                    onChange={async (e) => setSettings(await api.saveSettings({ template: e.target.value }))}>
                    {templateList().map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                }
              >
                <Editor resume={draft || {}} onChange={setDraft} />
              </DocCard>

              {shownLetter ? (
                <DocCard
                  title="Cover letter"
                  meta="Generated from the tailored resume"
                  templateId={template.id}
                  html={coverLetterToHtml(shownLetter, shown)}
                  editing={editing === 'letter'}
                  onToggleEdit={() => setEditing(editing === 'letter' ? null : 'letter')}
                  onSave={saveEdits}
                  onCopy={() => {
                    const t = [shownLetter.greeting, ...(shownLetter.paragraphs || []), shownLetter.signoff, shownLetter.name].join('\n\n');
                    navigator.clipboard.writeText(t); say('Cover letter copied.');
                  }}
                  onPdf={() => savePdf('cover_letter')}
                  onWord={() => downloadWord(coverLetterToHtml(shownLetter, shown), template.css, `${fileBase}-Cover-Letter`)}
                >
                  <CoverLetterEditor letter={letterDraft || {}} onChange={setLetterDraft} />
                </DocCard>
              ) : (
                <div className="card">
                  <p>No cover letter yet.</p>
                  <button className="btn" onClick={makeLetter} disabled={!!busy}>Write the cover letter</button>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      {showSettings && (
        <Settings
          settings={settings}
          master={master}
          onSaved={(s) => setSettings(s)}
          onMasterChange={(m) => { setMaster(m); setUseMaster(!!m); }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showHistory && (
        <div className="modal-backdrop" onClick={() => setShowHistory(false)}>
          <div className="modal narrow" onClick={(e) => e.stopPropagation()}>
            <header className="modal-head"><h2>History</h2>
              <button className="btn ghost" onClick={() => setShowHistory(false)}>Close</button></header>
            <div className="modal-body">
              {history.length === 0 && <p className="muted">Nothing tailored yet.</p>}
              {history.map((h) => (
                <div className="history-row" key={h.id}>
                  <button className="history-open" onClick={() => openFromHistory(h.id)}>
                    <strong>{h.title || 'Untitled role'}</strong>
                    <span className="muted small">
                      {h.company ? `${h.company} · ` : ''}{h.mode} · {h.ats_score ?? '–'}% · {new Date(h.created_at + 'Z').toLocaleDateString()}
                    </span>
                  </button>
                  <button className="btn tiny ghost" onClick={async () => {
                    await api.deleteTailoring(h.id);
                    setHistory(await api.history());
                    if (result?.id === h.id) { setResult(null); setDraft(null); }
                  }}>Delete</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
function DocCard({ title, meta, html, templateId, editing, onToggleEdit, onSave, onCopy, onPdf, onWord, extra, children }) {
  return (
    <section className="card doc-card">
      <header className="doc-head">
        <div>
          <strong>{title}</strong>
          <div className="muted small">{meta}</div>
        </div>
        <div className="doc-actions">
          {extra}
          <button className="btn tiny" onClick={onToggleEdit}>{editing ? 'Preview' : 'Edit'}</button>
          {editing && <button className="btn tiny primary" onClick={onSave}>Save changes</button>}
          <button className="btn tiny" onClick={onCopy}>Copy</button>
          <button className="btn tiny" onClick={onWord}>Word</button>
          <button className="btn tiny dark" onClick={onPdf}>PDF</button>
        </div>
      </header>
      <div className="doc-body">
        {editing ? children : <div className={`sheet tpl-${templateId}`} dangerouslySetInnerHTML={{ __html: html }} />}
      </div>
    </section>
  );
}

function Group({ title, items, tone }) {
  if (!items?.length) return null;
  return (
    <div className="group">
      <div className="muted small">{title}</div>
      <div className="chips">{items.map((s, i) => <span key={i} className={`chip ${tone}`}>{s}</span>)}</div>
    </div>
  );
}

function Ring({ value }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const r = 30, c = 2 * Math.PI * r;
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" role="img" aria-label={`ATS match ${v}%`}>
      <circle cx="38" cy="38" r={r} fill="none" stroke="var(--line)" strokeWidth="7" />
      <circle cx="38" cy="38" r={r} fill="none" stroke="var(--accent)" strokeWidth="7" strokeLinecap="round"
        strokeDasharray={`${(c * v) / 100} ${c}`} transform="rotate(-90 38 38)" />
      <text x="38" y="44" textAnchor="middle" fontSize="19" fill="var(--ink)" fontFamily="Newsreader, serif">{v}</text>
    </svg>
  );
}
