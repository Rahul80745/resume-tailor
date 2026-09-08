import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import { templateList, resumeToHtml } from './templates.js';

const SAMPLE = {
  name: 'Sample Candidate',
  headline: 'Senior Data Analyst',
  contact: { email: 'sample@email.com', phone: '+91 90000 00000', location: 'Hyderabad, IN' },
  summary: 'Analyst with six years turning messy operational data into decisions leadership actually uses.',
  skills: [{ category: 'Analytics', items: ['SQL', 'Python', 'Power BI'] }],
  experience: [{
    role: 'Senior Data Analyst', company: 'Northwind', start: '2021', end: 'Present',
    bullets: ['Rebuilt the weekly revenue model, cutting reporting time from two days to under an hour.'],
  }],
  education: [{ degree: 'B.Tech, Computer Science', school: 'JNTU', year: '2018' }],
};

const PROMPT_TABS = [
  { key: 'prompt_normal', field: 'normal', label: 'Normal' },
  { key: 'prompt_skills', field: 'skills', label: 'Skills-focused' },
  { key: 'prompt_high', field: 'high', label: 'Highly tailored' },
  { key: 'prompt_cover', field: 'cover', label: 'Cover letter' },
];

export default function Settings({ settings, onSaved, master, onMasterChange, onClose }) {
  const [form, setForm] = useState({
    api_key: settings.api_key || '',
    base_url: settings.base_url,
    model: settings.model,
    template: settings.template,
    theme: settings.theme || 'light',
    prompt_normal: settings.prompt_normal || '',
    prompt_skills: settings.prompt_skills || '',
    prompt_high: settings.prompt_high || '',
    prompt_cover: settings.prompt_cover || '',
  });
  const [defaults, setDefaults] = useState(null);
  const [tab, setTab] = useState('prompt_normal');

  useEffect(() => {
    api.promptDefaults().then(setDefaults).catch(() => setDefaults(null));
  }, []);
  const [test, setTest] = useState(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [masterText, setMasterText] = useState(master?.content || '');
  const [busyMaster, setBusyMaster] = useState('');

  const patch = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const runTest = async () => {
    setTesting(true); setTest(null);
    try {
      const r = await api.testConnection(form);
      setTest({ ok: true, text: `Connected to ${r.model} in ${r.latencyMs} ms.` });
    } catch (e) {
      setTest({ ok: false, text: e.message });
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      const s = await api.saveSettings(form);
      onSaved(s);
      setForm((f) => ({ ...f, api_key: s.api_key }));
      setMsg('Settings saved.');
    } catch (e) {
      setMsg(e.message);
    } finally {
      setSaving(false);
    }
  };

  const saveMaster = async () => {
    setBusyMaster('saving');
    try {
      const m = await api.saveMaster({ content: masterText, name: 'Master resume', source_name: master?.source_name });
      onMasterChange(m);
      setMsg('Master resume saved.');
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusyMaster('');
    }
  };

  const uploadMaster = async (file) => {
    if (!file) return;
    setBusyMaster('uploading'); setMsg('');
    try {
      const r = await api.extract(file);
      setMasterText(r.content);
      const m = await api.saveMaster({ content: r.content, name: 'Master resume', source_name: r.name });
      onMasterChange(m);
      setMsg(`Loaded ${r.name} (${r.characters.toLocaleString()} characters).`);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusyMaster('');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>Settings</h2>
          <button className="btn ghost" onClick={onClose}>Close</button>
        </header>

        <div className="modal-body">
          <section className="settings-section">
            <h3>DeepSeek connection</h3>
            <p className="muted">
              Your key is stored in the local database on this machine and only ever leaves it to call DeepSeek.
            </p>
            <label className="field">
              <span>API key</span>
              <input className="input" type="password" autoComplete="off"
                placeholder="sk-…"
                value={form.api_key}
                onFocus={(e) => { if (e.target.value.includes('•')) patch('api_key', ''); }}
                onChange={(e) => patch('api_key', e.target.value)} />
            </label>
            <div className="grid2">
              <label className="field">
                <span>Model</span>
                <select className="input" value={form.model} onChange={(e) => patch('model', e.target.value)}>
                  <option value="deepseek-chat">deepseek-chat</option>
                  <option value="deepseek-reasoner">deepseek-reasoner</option>
                </select>
              </label>
              <label className="field">
                <span>Base URL</span>
                <input className="input" value={form.base_url} onChange={(e) => patch('base_url', e.target.value)} />
              </label>
            </div>
            <div className="row-actions">
              <button className="btn" onClick={runTest} disabled={testing}>
                {testing ? 'Testing…' : 'Connect and test'}
              </button>
              <button className="btn primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save settings'}
              </button>
            </div>
            {test && <div className={`notice ${test.ok ? 'ok' : 'bad'}`}>{test.text}</div>}
          </section>

          <section className="settings-section">
            <h3>Resume format</h3>
            <p className="muted">All four are single-column and parser-safe. Pick the one that suits the role you are applying for.</p>
            <div className="template-grid">
              {templateList().map((t) => (
                <button key={t.id}
                  className={`template-card ${form.template === t.id ? 'on' : ''}`}
                  onClick={() => patch('template', t.id)}>
                  <div className="template-preview">
                    <style>{scoped(t.id, t.css)}</style>
                    <div className={`tpl-${t.id}`} dangerouslySetInnerHTML={{ __html: resumeToHtml(SAMPLE) }} />
                  </div>
                  <div className="template-meta">
                    <strong>{t.name}</strong>
                    <span className="muted">{t.note}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="settings-section">
            <h3>Tailoring instructions</h3>
            <p className="muted">
              This is the instruction block sent to the model for each option. Edit it to change how that option behaves —
              leave a tab untouched to use the built-in wording. The integrity rules (never invent employers, titles, dates
              or degrees) are added separately and always apply.
            </p>
            <div className="tabs">
              {PROMPT_TABS.map((t) => (
                <button key={t.key}
                  className={`tab ${tab === t.key ? 'on' : ''}`}
                  onClick={() => setTab(t.key)}>
                  {t.label}
                  {form[t.key]?.trim() ? <span className="tab-dot" title="Customised" /> : null}
                </button>
              ))}
            </div>
            {PROMPT_TABS.filter((t) => t.key === tab).map((t) => {
              const fallback = defaults?.[t.field] || '';
              const custom = Boolean(form[t.key]?.trim());
              return (
                <div key={t.key}>
                  <div className="row-actions">
                    <span className="muted small">{custom ? 'Using your edited version.' : 'Using the built-in default.'}</span>
                    <button className="btn tiny" disabled={!fallback}
                      onClick={() => patch(t.key, fallback)}>Load default into editor</button>
                    <button className="btn tiny ghost" disabled={!custom}
                      onClick={() => patch(t.key, '')}>Reset to default</button>
                  </div>
                  <textarea className="input mono" rows={16}
                    placeholder={fallback || 'Loading the default wording…'}
                    value={form[t.key]}
                    onChange={(e) => patch(t.key, e.target.value)} />
                </div>
              );
            })}
            <div className="row-actions">
              <button className="btn primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save instructions'}
              </button>
            </div>
          </section>

          <section className="settings-section">
            <h3>Appearance</h3>
            <div className="row-actions">
              {['light', 'dark'].map((t) => (
                <button key={t} className={`btn ${form.theme === t ? 'primary' : ''}`}
                  onClick={() => { patch('theme', t); document.documentElement.dataset.theme = t; }}>
                  {t === 'light' ? 'Light' : 'Dark'}
                </button>
              ))}
            </div>
            <p className="muted small">The resume preview stays on white paper in both themes, since that is how it prints.</p>
          </section>

          <section className="settings-section">
            <h3>Master resume</h3>
            <p className="muted">
              Kept as your source of truth. Every tailoring works on a copy — this text is never overwritten by a tailoring run.
            </p>
            <div className="row-actions">
              <label className="btn">
                Upload file
                <input type="file" accept=".pdf,.docx,.txt,.md" hidden
                  onChange={(e) => uploadMaster(e.target.files[0])} />
              </label>
              <button className="btn primary" onClick={saveMaster} disabled={busyMaster === 'saving' || masterText.trim().length < 100}>
                {busyMaster === 'saving' ? 'Saving…' : 'Save master resume'}
              </button>
              {master && (
                <button className="btn ghost" onClick={async () => { await api.deleteMaster(); onMasterChange(null); setMasterText(''); }}>
                  Delete
                </button>
              )}
            </div>
            <textarea className="input mono" rows={12}
              placeholder={busyMaster === 'uploading' ? 'Reading file…' : 'Paste your full, untailored resume here. Longer is better — the tailoring picks what each job needs.'}
              value={masterText}
              onChange={(e) => setMasterText(e.target.value)} />
            {master && <p className="muted small">Last updated {new Date(master.updated_at + 'Z').toLocaleString()}</p>}
          </section>

          {msg && <div className="notice">{msg}</div>}
        </div>
      </div>
    </div>
  );
}

export function scoped(id, css) {
  return css.replace(/\.r\b/g, `.tpl-${id}`);
}
