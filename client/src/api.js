const base = '/api';

async function req(path, options = {}) {
  const res = await fetch(base + path, {
    headers: options.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    ...options,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  modes: () => req('/modes'),
  promptDefaults: () => req('/prompts/defaults'),
  getSettings: () => req('/settings'),
  saveSettings: (body) => req('/settings', { method: 'PUT', body: JSON.stringify(body) }),
  testConnection: (body) => req('/settings/test', { method: 'POST', body: JSON.stringify(body) }),

  getMaster: () => req('/master'),
  saveMaster: (body) => req('/master', { method: 'PUT', body: JSON.stringify(body) }),
  deleteMaster: () => req('/master', { method: 'DELETE' }),

  extract: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return req('/extract', { method: 'POST', body: fd });
  },

  tailor: (body) => req('/tailor', { method: 'POST', body: JSON.stringify(body) }),
  retryCoverLetter: (id) => req(`/tailorings/${id}/cover-letter`, { method: 'POST' }),

  /* real file download — the server returns a PDF with selectable text */
  downloadPdf: async ({ kind, resume, cover_letter, template, filename }) => {
    const res = await fetch(base + '/export/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, resume, cover_letter, template, filename }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(JSON.parse(t || '{}').error || 'PDF export failed.');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  },

  history: () => req('/history'),
  getTailoring: (id) => req(`/history/${id}`),
  updateTailoring: (id, body) => req(`/history/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteTailoring: (id) => req(`/history/${id}`, { method: 'DELETE' }),
};
