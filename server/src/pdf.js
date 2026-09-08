import PDFDocument from 'pdfkit';

/**
 * Renders the structured resume JSON straight to PDF. The text stays real text
 * (not an image), which is what an ATS needs in order to parse the file at all.
 * Each template maps to a typography config rather than a separate renderer.
 */

const STYLES = {
  classic: {
    margin: 44,
    body: 'Times-Roman', bold: 'Times-Bold', italic: 'Times-Italic',
    bodySize: 10.8, lineGap: 1.6,
    nameSize: 20, nameFont: 'Times-Bold', nameSpacing: 0.4, headerAlign: 'center',
    headSize: 10.5, headFont: 'Times-Bold', headUpper: true, headSpacing: 1,
    headColor: '#000', rule: true, ruleColor: '#000', ruleWidth: 0.8,
    sectionGap: 12, ruleGap: 6,
  },
  compact: {
    margin: 36,
    body: 'Helvetica', bold: 'Helvetica-Bold', italic: 'Helvetica-Oblique',
    bodySize: 9.6, lineGap: 0.8,
    nameSize: 16, nameFont: 'Helvetica-Bold', nameSpacing: 0, headerAlign: 'left',
    headSize: 9, headFont: 'Helvetica-Bold', headUpper: true, headSpacing: .8,
    headColor: '#000', rule: true, ruleColor: '#bbb', ruleWidth: 0.6,
    sectionGap: 8, ruleGap: 4,
  },
  modern: {
    margin: 46,
    body: 'Helvetica', bold: 'Helvetica-Bold', italic: 'Helvetica-Oblique',
    bodySize: 10.6, lineGap: 2.2,
    nameSize: 21, nameFont: 'Helvetica-Bold', nameSpacing: -.2, headerAlign: 'left',
    headSize: 10, headFont: 'Helvetica-Bold', headUpper: true, headSpacing: 1.2,
    headColor: '#222', rule: false, headerRule: true,
    sectionGap: 14, ruleGap: 6,
  },
  executive: {
    margin: 52,
    body: 'Times-Roman', bold: 'Times-Bold', italic: 'Times-Italic',
    bodySize: 11, lineGap: 3,
    nameSize: 23, nameFont: 'Times-Roman', nameSpacing: .4, headerAlign: 'left',
    headSize: 10, headFont: 'Times-Roman', headUpper: true, headSpacing: 2,
    headColor: '#555', rule: true, ruleColor: '#ddd', ruleWidth: 0.6,
    sectionGap: 16, ruleGap: 7,
  },
};

const has = (a) => Array.isArray(a) && a.length > 0;
const width = (doc) => doc.page.width - doc.page.margins.left - doc.page.margins.right;

function newDoc(styleId) {
  const s = STYLES[styleId] || STYLES.classic;
  const doc = new PDFDocument({ size: 'A4', margin: s.margin, bufferPages: true });
  return { doc, s };
}

function toBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

/* keep a heading from stranding at the foot of a page */
function room(doc, needed = 46) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) doc.addPage();
}

function heading(doc, s, text) {
  room(doc, 60);
  doc.moveDown(0);
  doc.y += s.sectionGap;
  doc.font(s.headFont).fontSize(s.headSize).fillColor(s.headColor)
    .text(s.headUpper ? text.toUpperCase() : text, { characterSpacing: s.headSpacing, lineGap: 0 });
  if (s.rule) {
    const y = doc.y + 2.5;
    doc.moveTo(doc.page.margins.left, y)
      .lineTo(doc.page.width - doc.page.margins.right, y)
      .lineWidth(s.ruleWidth).strokeColor(s.ruleColor).stroke();
    doc.y = y + s.ruleGap;
  } else {
    doc.y += 4;
  }
  doc.fillColor('#111');
}

function body(doc, s, text, opts = {}) {
  doc.font(s.body).fontSize(s.bodySize).fillColor('#111')
    .text(text, { width: width(doc), lineGap: s.lineGap, ...opts });
}

/* left-aligned title with right-aligned dates on the same baseline */
function titleRow(doc, s, left, right, secondary) {
  room(doc, 42);
  const y = doc.y;
  const w = width(doc);

  // title first, so an ATS reads "Role — Company" ahead of the dates
  doc.font(s.bold).fontSize(s.bodySize).fillColor('#111')
    .text(left || '', doc.page.margins.left, y, { width: w * 0.72, continued: Boolean(secondary), lineGap: 0 });
  if (secondary) {
    doc.font(s.body).fillColor('#222').text(` — ${secondary}`, { lineGap: 0 });
  }
  const afterTitle = doc.y;

  if (right) {
    doc.y = y;
    doc.font(s.body).fontSize(s.bodySize - 0.4).fillColor('#444')
      .text(right, doc.page.margins.left, y, { width: w, align: 'right', lineGap: 0 });
  }
  doc.y = Math.max(afterTitle, doc.y) + 2;
}

function bullets(doc, s, items) {
  if (!has(items)) return;
  doc.font(s.body).fontSize(s.bodySize).fillColor('#111');
  doc.list(items.filter(Boolean), {
    width: width(doc),
    bulletRadius: 1.3,
    textIndent: 10,
    bulletIndent: 2,
    lineGap: s.lineGap,
    paragraphGap: s.lineGap + 1,
  });
}

/* ------------------------------------------------------------------ */
export async function resumePdf(resume, templateId) {
  const { doc, s } = newDoc(templateId);
  const r = resume || {};
  const c = r.contact || {};
  const align = s.headerAlign;
  const w = width(doc);

  doc.font(s.nameFont).fontSize(s.nameSize).fillColor('#111')
    .text(r.name || '', { align, characterSpacing: s.nameSpacing, lineGap: 0 });

  if (r.headline) {
    doc.font(s.body).fontSize(s.bodySize + 0.4).fillColor('#333')
      .text(r.headline, { align, lineGap: 0 });
  }

  const contact = [c.location, c.phone, c.email, c.linkedin, c.website].filter(Boolean).join('  |  ');
  if (contact) {
    doc.font(s.body).fontSize(s.bodySize - 0.8).fillColor('#444')
      .text(contact, { align, lineGap: 0 });
  }

  if (s.headerRule) {
    const y = doc.y + 6;
    doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + w, y)
      .lineWidth(1.6).strokeColor('#222').stroke();
    doc.y = y;
  }

  if (r.summary) {
    heading(doc, s, 'Professional Summary');
    body(doc, s, r.summary);
  }

  if (has(r.skills)) {
    heading(doc, s, 'Skills');
    for (const g of r.skills) {
      if (!has(g.items)) continue;
      doc.font(s.bold).fontSize(s.bodySize).fillColor('#111')
        .text(g.category ? `${g.category}: ` : '', { continued: Boolean(g.category), width: w, lineGap: s.lineGap });
      doc.font(s.body).text(g.items.join(', '), { width: w, lineGap: s.lineGap });
      doc.y += 1.5;
    }
  }

  if (has(r.experience)) {
    heading(doc, s, 'Professional Experience');
    r.experience.forEach((j, i) => {
      const dates = [j.start, j.end].filter(Boolean).join(' – ');
      titleRow(doc, s, j.role, [j.location, dates].filter(Boolean).join('  |  '), j.company);
      bullets(doc, s, j.bullets);
      if (i < r.experience.length - 1) doc.y += 5;
    });
  }

  if (has(r.projects)) {
    heading(doc, s, 'Projects');
    r.projects.forEach((p) => {
      titleRow(doc, s, p.name, p.stack);
      bullets(doc, s, p.bullets);
      doc.y += 4;
    });
  }

  if (has(r.education)) {
    heading(doc, s, 'Education');
    r.education.forEach((e) => {
      titleRow(doc, s, e.degree, [e.location, e.year].filter(Boolean).join('  |  '), e.school);
      if (e.details) body(doc, s, e.details);
      doc.y += 4;
    });
  }

  if (has(r.certifications)) {
    heading(doc, s, 'Certifications');
    bullets(doc, s, r.certifications);
  }

  if (has(r.additional)) {
    for (const block of r.additional) {
      if (!has(block.items)) continue;
      heading(doc, s, block.heading || 'Additional');
      bullets(doc, s, block.items);
    }
  }

  return toBuffer(doc);
}

export async function coverLetterPdf(letter, resume, templateId) {
  const { doc, s } = newDoc(templateId);
  const l = letter || {};
  const c = resume?.contact || {};
  const name = l.name || resume?.name || '';

  doc.font(s.nameFont).fontSize(s.nameSize - 2).fillColor('#111')
    .text(name, { align: s.headerAlign, characterSpacing: s.nameSpacing, lineGap: 0 });

  const contact = [c.email, c.phone, c.location].filter(Boolean).join('  |  ');
  if (contact) {
    doc.font(s.body).fontSize(s.bodySize - 0.8).fillColor('#444')
      .text(contact, { align: s.headerAlign, lineGap: 0 });
  }

  doc.y += 20;
  body(doc, s, new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }));
  doc.y += 12;
  body(doc, s, l.greeting || 'Dear Hiring Manager,');
  doc.y += 8;

  for (const p of l.paragraphs || []) {
    if (!p) continue;
    body(doc, s, p);
    doc.y += 9;
  }

  doc.y += 8;
  body(doc, s, l.signoff || 'Sincerely,');
  doc.y += 4;
  body(doc, s, name);

  return toBuffer(doc);
}
