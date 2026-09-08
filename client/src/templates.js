/**
 * Four ATS formatting styles. All are deliberately single-column, text-only and
 * free of tables, graphics and columns — the things resume parsers choke on.
 * They differ in typeface, density and how section headings are drawn.
 */

const shared = `
  .r { color: #111; }
  .r h1 { margin: 0; }
  .r ul { margin: 4px 0 0; padding-left: 16px; }
  .r li { margin: 0 0 3px; }
  .r p { margin: 0 0 6px; }
  .r .contact { margin-top: 4px; }
  .r .sec { break-inside: avoid; }
  .r .row { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
  .r .meta { white-space: nowrap; }
`;

export const TEMPLATES = {
  classic: {
    id: 'classic',
    name: 'Classic ATS',
    note: 'Serif, centred header, ruled section headings. The safest option for older parsers and traditional industries.',
    css: `${shared}
      .r { font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.38; }
      .r header { text-align: center; margin-bottom: 12px; }
      .r h1 { font-size: 20pt; letter-spacing: .5px; }
      .r .headline { font-size: 11pt; margin-top: 2px; }
      .r .contact { font-size: 10pt; }
      .r h2 { font-size: 11pt; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #000;
              padding-bottom: 2px; margin: 14px 0 6px; }
      .r .role { font-weight: bold; }
      .r .company { font-style: italic; }
    `,
  },

  compact: {
    id: 'compact',
    name: 'Compact one-page',
    note: 'Tight sans-serif set at high density. Use it when you need a long history to fit on a single page.',
    css: `${shared}
      .r { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; line-height: 1.28; }
      .r header { margin-bottom: 8px; }
      .r h1 { font-size: 16pt; }
      .r .headline { font-size: 10pt; font-weight: bold; margin-top: 1px; }
      .r .contact { font-size: 9pt; color: #333; }
      .r h2 { font-size: 9.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: .8px;
              border-bottom: 1px solid #bbb; padding-bottom: 1px; margin: 10px 0 4px; }
      .r ul { padding-left: 14px; }
      .r li { margin: 0 0 1.5px; }
      .r .role { font-weight: bold; }
      .r .company { }
    `,
  },

  modern: {
    id: 'modern',
    name: 'Modern sans',
    note: 'Clean sans-serif with generous spacing and a left-aligned header. Reads well on screen and parses cleanly.',
    css: `${shared}
      .r { font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.45; }
      .r header { margin-bottom: 14px; padding-bottom: 10px; border-bottom: 2px solid #222; }
      .r h1 { font-size: 21pt; font-weight: 600; letter-spacing: -.3px; }
      .r .headline { font-size: 11.5pt; color: #444; margin-top: 3px; }
      .r .contact { font-size: 10pt; color: #444; }
      .r h2 { font-size: 10.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px;
              color: #222; margin: 16px 0 7px; }
      .r .role { font-weight: 600; }
      .r .company { color: #333; }
    `,
  },

  executive: {
    id: 'executive',
    name: 'Executive serif',
    note: 'Larger type, wide spacing, understated headings. Suits senior and leadership applications.',
    css: `${shared}
      .r { font-family: Georgia, 'Times New Roman', serif; font-size: 11pt; line-height: 1.5; }
      .r header { margin-bottom: 16px; }
      .r h1 { font-size: 23pt; font-weight: normal; letter-spacing: .4px; }
      .r .headline { font-size: 11.5pt; color: #444; margin-top: 4px; font-style: italic; }
      .r .contact { font-size: 10pt; color: #444; }
      .r h2 { font-size: 10.5pt; letter-spacing: 2px; text-transform: uppercase; color: #555;
              margin: 20px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
      .r ul { padding-left: 18px; }
      .r li { margin: 0 0 5px; }
      .r .role { font-weight: bold; }
      .r .company { }
    `,
  },
};

export const templateList = () => Object.values(TEMPLATES);

/* ------------------------------------------------------------------ */
/* rendering                                                           */
/* ------------------------------------------------------------------ */
const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const has = (a) => Array.isArray(a) && a.length > 0;

export function resumeToHtml(resume) {
  if (!resume) return '';
  const r = resume;
  const c = r.contact || {};
  const contact = [c.location, c.phone, c.email, c.linkedin, c.website].filter(Boolean).map(esc).join('  |  ');

  const parts = [`<div class="r"><header>
    <h1>${esc(r.name || '')}</h1>
    ${r.headline ? `<div class="headline">${esc(r.headline)}</div>` : ''}
    ${contact ? `<div class="contact">${contact}</div>` : ''}
  </header>`];

  if (r.summary) {
    parts.push(`<section class="sec"><h2>Professional Summary</h2><p>${esc(r.summary)}</p></section>`);
  }

  if (has(r.skills)) {
    const rows = r.skills
      .filter((g) => has(g.items))
      .map((g) => `<p>${g.category ? `<b>${esc(g.category)}:</b> ` : ''}${g.items.map(esc).join(', ')}</p>`)
      .join('');
    parts.push(`<section class="sec"><h2>Skills</h2>${rows}</section>`);
  }

  if (has(r.experience)) {
    const jobs = r.experience.map((j) => `
      <div class="sec" style="margin-bottom:9px">
        <div class="row">
          <span><span class="role">${esc(j.role || '')}</span>${j.company ? ` — <span class="company">${esc(j.company)}</span>` : ''}</span>
          <span class="meta">${esc([j.location, [j.start, j.end].filter(Boolean).join(' – ')].filter(Boolean).join(' | '))}</span>
        </div>
        ${has(j.bullets) ? `<ul>${j.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
      </div>`).join('');
    parts.push(`<section><h2>Professional Experience</h2>${jobs}</section>`);
  }

  if (has(r.projects)) {
    const ps = r.projects.map((p) => `
      <div class="sec" style="margin-bottom:8px">
        <div class="row"><span class="role">${esc(p.name || '')}</span><span class="meta">${esc(p.stack || '')}</span></div>
        ${has(p.bullets) ? `<ul>${p.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
      </div>`).join('');
    parts.push(`<section><h2>Projects</h2>${ps}</section>`);
  }

  if (has(r.education)) {
    const eds = r.education.map((e) => `
      <div class="sec" style="margin-bottom:6px">
        <div class="row">
          <span><span class="role">${esc(e.degree || '')}</span>${e.school ? ` — <span class="company">${esc(e.school)}</span>` : ''}</span>
          <span class="meta">${esc([e.location, e.year].filter(Boolean).join(' | '))}</span>
        </div>
        ${e.details ? `<p>${esc(e.details)}</p>` : ''}
      </div>`).join('');
    parts.push(`<section><h2>Education</h2>${eds}</section>`);
  }

  if (has(r.certifications)) {
    parts.push(`<section class="sec"><h2>Certifications</h2><ul>${r.certifications.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>`);
  }

  if (has(r.additional)) {
    for (const b of r.additional) {
      if (!has(b.items)) continue;
      parts.push(`<section class="sec"><h2>${esc(b.heading || 'Additional')}</h2><ul>${b.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>`);
    }
  }

  return parts.join('\n') + '</div>';
}

export function coverLetterToHtml(letter, resume) {
  if (!letter) return '';
  const c = resume?.contact || {};
  const contact = [c.email, c.phone, c.location].filter(Boolean).map(esc).join('  |  ');
  return `<div class="r">
    <header>
      <h1>${esc(letter.name || resume?.name || '')}</h1>
      ${contact ? `<div class="contact">${contact}</div>` : ''}
    </header>
    <p>${esc(new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }))}</p>
    <p>${esc(letter.greeting || 'Dear Hiring Manager,')}</p>
    ${(letter.paragraphs || []).map((p) => `<p>${esc(p)}</p>`).join('')}
    <p style="margin-top:14px">${esc(letter.signoff || 'Sincerely,')}<br/>${esc(letter.name || resume?.name || '')}</p>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* export                                                              */
/* ------------------------------------------------------------------ */
const pageCss = `@page { size: A4; margin: 15mm 14mm; }
  body { margin: 0; -webkit-print-color-adjust: exact; }`;

export function printHtml(html, css, title) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>${pageCss}${css}</style></head><body>${html}</body></html>`);
  doc.close();
  setTimeout(() => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 2000);
  }, 300);
}

export function downloadWord(html, css, filename) {
  const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"><style>@page WordSection1 { size: 595.3pt 841.9pt; margin: 42.5pt 39.7pt; }
    div.WordSection1 { page: WordSection1; }${css}</style></head>
    <body><div class="WordSection1">${html}</div></body></html>`;
  const blob = new Blob(['\ufeff', doc], { type: 'application/msword' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith('.doc') ? filename : `${filename}.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

export function resumeToText(resume) {
  const div = document.createElement('div');
  div.innerHTML = resumeToHtml(resume)
    .replace(/<\/(p|div|li|h1|h2|section)>/g, '\n')
    .replace(/<li>/g, '• ');
  return div.textContent.replace(/\n{3,}/g, '\n\n').trim();
}
