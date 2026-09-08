/**
 * DeepSeek client. The API is OpenAI-compatible, so base_url can also point at
 * any other OpenAI-style endpoint if you ever want to swap providers.
 */

const DEFAULT_BASE = 'https://api.deepseek.com';

function endpoint(baseUrl) {
  const base = (baseUrl || DEFAULT_BASE).replace(/\/+$/, '');
  return base.endsWith('/v1') || base.endsWith('/chat/completions')
    ? `${base.replace(/\/chat\/completions$/, '')}/chat/completions`
    : `${base}/chat/completions`;
}

async function request({ apiKey, baseUrl, body, timeoutMs = 180000 }) {
  if (!apiKey) {
    const err = new Error('No DeepSeek API key saved. Add one in Settings, then test the connection.');
    err.status = 400;
    throw err;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(endpoint(baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    const err = new Error(
      e.name === 'AbortError'
        ? 'DeepSeek took too long to respond. Try again, or use a shorter job description.'
        : `Could not reach DeepSeek: ${e.message}`
    );
    err.status = 504;
    throw err;
  }
  clearTimeout(timer);

  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 400);
    try { detail = JSON.parse(text)?.error?.message || detail; } catch { /* keep raw */ }
    const err = new Error(
      res.status === 401 ? 'DeepSeek rejected the API key. Check it in Settings.'
      : res.status === 402 ? 'DeepSeek reports insufficient balance on this account.'
      : res.status === 429 ? 'DeepSeek rate limit hit. Wait a moment and try again.'
      : `DeepSeek returned ${res.status}: ${detail}`
    );
    err.status = res.status === 401 ? 401 : 502;
    throw err;
  }
  return JSON.parse(text);
}

export async function testConnection({ apiKey, baseUrl, model }) {
  const started = Date.now();
  const data = await request({
    apiKey,
    baseUrl,
    timeoutMs: 30000,
    body: {
      model: model || 'deepseek-chat',
      max_tokens: 8,
      messages: [{ role: 'user', content: 'Reply with the single word: ready' }],
    },
  });
  return {
    ok: true,
    model: data.model || model,
    reply: data.choices?.[0]?.message?.content?.trim() || '',
    latencyMs: Date.now() - started,
  };
}

export async function chatJSON({ apiKey, baseUrl, model, prompt, temperature = 0.4, maxTokens = 8000 }) {
  const data = await request({
    apiKey,
    baseUrl,
    body: {
      model: model || 'deepseek-chat',
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a precise assistant that replies with valid JSON only. Never wrap the JSON in markdown fences.' },
        { role: 'user', content: prompt },
      ],
    },
  });

  const raw = data.choices?.[0]?.message?.content || '';
  const finish = data.choices?.[0]?.finish_reason;
  try {
    return { parsed: parseJson(raw), usage: data.usage, finish };
  } catch {
    const err = new Error(
      finish === 'length'
        ? 'The model ran out of output space. Try a shorter resume or job description.'
        : 'The model did not return usable JSON. Try again.'
    );
    err.status = 502;
    throw err;
  }
}

function parseJson(raw) {
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no json');
  return JSON.parse(cleaned.slice(start, end + 1));
}
