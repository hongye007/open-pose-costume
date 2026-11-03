/** Never include request bodies, credentials, query values or image responses. */
export function redactDiagnostic(value: string, secret = ''): string {
  let text = secret ? value.split(secret).join('[redacted]') : value;
  return text.replace(/Bearer\s+[^\s"<>]+/gi, 'Bearer [redacted]')
    .replace(/\bsk-[\w-]+/g, '[redacted]')
    .replace(/data:image\/[^\s"<>]+/gi, '[image omitted]')
    .replace(/([?&][\w-]+=)[^\s&#"<>]*/g, '$1[redacted]')
    .replace(/[\u0000-\u001f]/g, ' ').slice(0, 800);
}
export async function readImageResponse(response: Response, stage: string, endpoint: string, secret = '') {
  let payload: any = null;
  // Inspect a bounded prefix for errors; never retain successful image payloads in diagnostics.
  if (response.ok) return { payload: await response.json().catch(() => null), diagnostic: '' };
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let body = '';
  try {
    while (reader && body.length < 4096) {
      const part = await reader.read();
      if (part.done) break;
      body += decoder.decode(part.value.subarray(0, 4096), { stream: true });
    }
  } finally { await reader?.cancel().catch(() => undefined); }
  try { payload = JSON.parse(body); } catch { /* HTML and text errors remain readable. */ }
  const url = new URL(endpoint, typeof location === 'undefined' ? 'http://localhost' : location.origin);
  const requestId = response.headers.get('x-request-id') || response.headers.get('x-oneapi-request-id') || response.headers.get('cf-ray') || '';
  const diagnostic = JSON.stringify({ time: new Date().toISOString(), stage, endpoint: url.origin + url.pathname, status: response.status,
    contentType: redactDiagnostic(response.headers.get('content-type') || '', secret), requestId: redactDiagnostic(requestId, secret),
    response: redactDiagnostic(body.replace(/<[^>]*>/g, ' '), secret) }, null, 2);
  return { payload, diagnostic };
}
