import React from 'react';

/* Editing works on a copy held in App state; nothing is saved until the user
   presses Save, and the master resume is never touched by any of this. */

const clone = (o) => JSON.parse(JSON.stringify(o));

function Field({ label, value, onChange, area, placeholder }) {
  const Tag = area ? 'textarea' : 'input';
  return (
    <label className="field">
      <span>{label}</span>
      <Tag
        className="input"
        value={value || ''}
        placeholder={placeholder}
        rows={area ? 4 : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function BulletList({ bullets = [], onChange }) {
  return (
    <div className="bullets">
      {bullets.map((b, i) => (
        <div key={i} className="bullet-row">
          <textarea
            className="input"
            rows={2}
            value={b}
            onChange={(e) => {
              const next = [...bullets];
              next[i] = e.target.value;
              onChange(next);
            }}
          />
          <button className="btn tiny ghost" title="Remove bullet"
            onClick={() => onChange(bullets.filter((_, j) => j !== i))}>Remove</button>
        </div>
      ))}
      <button className="btn tiny" onClick={() => onChange([...bullets, ''])}>Add bullet</button>
    </div>
  );
}

export default function Editor({ resume, onChange }) {
  const r = resume;
  const set = (path, value) => {
    const next = clone(r);
    let node = next;
    for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
    node[path[path.length - 1]] = value;
    onChange(next);
  };
  const list = (key) => (Array.isArray(r[key]) ? r[key] : []);
  const setList = (key, arr) => onChange({ ...clone(r), [key]: arr });

  return (
    <div className="editor">
      <div className="grid2">
        <Field label="Name" value={r.name} onChange={(v) => set(['name'], v)} />
        <Field label="Headline" value={r.headline} onChange={(v) => set(['headline'], v)} />
      </div>
      <div className="grid2">
        <Field label="Email" value={r.contact?.email} onChange={(v) => set(['contact', 'email'], v)} />
        <Field label="Phone" value={r.contact?.phone} onChange={(v) => set(['contact', 'phone'], v)} />
        <Field label="Location" value={r.contact?.location} onChange={(v) => set(['contact', 'location'], v)} />
        <Field label="LinkedIn" value={r.contact?.linkedin} onChange={(v) => set(['contact', 'linkedin'], v)} />
      </div>

      <Field area label="Professional summary" value={r.summary} onChange={(v) => set(['summary'], v)} />

      <h4>Skills</h4>
      {list('skills').map((g, i) => (
        <div className="block" key={i}>
          <div className="block-head">
            <input className="input" placeholder="Category" value={g.category || ''}
              onChange={(e) => { const n = [...list('skills')]; n[i] = { ...g, category: e.target.value }; setList('skills', n); }} />
            <button className="btn tiny ghost" onClick={() => setList('skills', list('skills').filter((_, j) => j !== i))}>Remove</button>
          </div>
          <textarea className="input" rows={2} placeholder="Comma-separated skills"
            value={(g.items || []).join(', ')}
            onChange={(e) => {
              const n = [...list('skills')];
              n[i] = { ...g, items: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) };
              setList('skills', n);
            }} />
        </div>
      ))}
      <button className="btn tiny" onClick={() => setList('skills', [...list('skills'), { category: '', items: [] }])}>Add skill group</button>

      <h4>Experience</h4>
      {list('experience').map((j, i) => (
        <div className="block" key={i}>
          <div className="block-head">
            <strong>{j.role || 'Role'}{j.company ? ` — ${j.company}` : ''}</strong>
            <button className="btn tiny ghost" onClick={() => setList('experience', list('experience').filter((_, k) => k !== i))}>Remove role</button>
          </div>
          <div className="grid2">
            <Field label="Role" value={j.role} onChange={(v) => { const n = [...list('experience')]; n[i] = { ...j, role: v }; setList('experience', n); }} />
            <Field label="Company" value={j.company} onChange={(v) => { const n = [...list('experience')]; n[i] = { ...j, company: v }; setList('experience', n); }} />
            <Field label="Start" value={j.start} onChange={(v) => { const n = [...list('experience')]; n[i] = { ...j, start: v }; setList('experience', n); }} />
            <Field label="End" value={j.end} onChange={(v) => { const n = [...list('experience')]; n[i] = { ...j, end: v }; setList('experience', n); }} />
          </div>
          <BulletList bullets={j.bullets} onChange={(b) => { const n = [...list('experience')]; n[i] = { ...j, bullets: b }; setList('experience', n); }} />
        </div>
      ))}
      <button className="btn tiny" onClick={() => setList('experience', [...list('experience'), { role: '', company: '', start: '', end: '', bullets: [] }])}>Add role</button>

      {list('projects').length > 0 && <h4>Projects</h4>}
      {list('projects').map((p, i) => (
        <div className="block" key={i}>
          <div className="block-head">
            <input className="input" placeholder="Project name" value={p.name || ''}
              onChange={(e) => { const n = [...list('projects')]; n[i] = { ...p, name: e.target.value }; setList('projects', n); }} />
            <button className="btn tiny ghost" onClick={() => setList('projects', list('projects').filter((_, j) => j !== i))}>Remove</button>
          </div>
          <BulletList bullets={p.bullets} onChange={(b) => { const n = [...list('projects')]; n[i] = { ...p, bullets: b }; setList('projects', n); }} />
        </div>
      ))}

      <h4>Education</h4>
      {list('education').map((e, i) => (
        <div className="block" key={i}>
          <div className="grid2">
            <Field label="Degree" value={e.degree} onChange={(v) => { const n = [...list('education')]; n[i] = { ...e, degree: v }; setList('education', n); }} />
            <Field label="School" value={e.school} onChange={(v) => { const n = [...list('education')]; n[i] = { ...e, school: v }; setList('education', n); }} />
            <Field label="Year" value={e.year} onChange={(v) => { const n = [...list('education')]; n[i] = { ...e, year: v }; setList('education', n); }} />
            <Field label="Location" value={e.location} onChange={(v) => { const n = [...list('education')]; n[i] = { ...e, location: v }; setList('education', n); }} />
          </div>
          <button className="btn tiny ghost" onClick={() => setList('education', list('education').filter((_, j) => j !== i))}>Remove</button>
        </div>
      ))}
      <button className="btn tiny" onClick={() => setList('education', [...list('education'), { degree: '', school: '', year: '' }])}>Add education</button>

      <h4>Certifications</h4>
      <textarea className="input" rows={3} placeholder="One per line"
        value={list('certifications').join('\n')}
        onChange={(e) => setList('certifications', e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))} />
    </div>
  );
}

export function CoverLetterEditor({ letter, onChange }) {
  return (
    <div className="editor">
      <Field label="Greeting" value={letter.greeting} onChange={(v) => onChange({ ...letter, greeting: v })} />
      {(letter.paragraphs || []).map((p, i) => (
        <div className="bullet-row" key={i}>
          <textarea className="input" rows={4} value={p}
            onChange={(e) => {
              const n = [...letter.paragraphs];
              n[i] = e.target.value;
              onChange({ ...letter, paragraphs: n });
            }} />
          <button className="btn tiny ghost"
            onClick={() => onChange({ ...letter, paragraphs: letter.paragraphs.filter((_, j) => j !== i) })}>Remove</button>
        </div>
      ))}
      <button className="btn tiny" onClick={() => onChange({ ...letter, paragraphs: [...(letter.paragraphs || []), ''] })}>Add paragraph</button>
      <div className="grid2">
        <Field label="Sign-off" value={letter.signoff} onChange={(v) => onChange({ ...letter, signoff: v })} />
        <Field label="Name" value={letter.name} onChange={(v) => onChange({ ...letter, name: v })} />
      </div>
    </div>
  );
}
