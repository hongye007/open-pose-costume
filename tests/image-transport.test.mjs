import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'vite';

const vite = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
  appType: 'custom',
});
const { imageRequestEndpoint } = await vite.ssrLoadModule('/src/image-transport.ts');
const { default: config } = await vite.ssrLoadModule('/vite.config.ts');
const api = await vite.ssrLoadModule('/src/generation.ts');
after(() => vite.close());

test('only the two exact Atomflow edit endpoints use the development transport', () => {
  for (const [host, route] of [['atomflow.vip', 'site'], ['api.atomflow.vip', 'api']]) {
    const endpoint = `https://${host}/v1/images/edits`;
    assert.equal(imageRequestEndpoint(endpoint, true), `/__opc-image/${route}/v1/images/edits`);
    assert.equal(imageRequestEndpoint(endpoint, false), endpoint);
  }
  for (const endpoint of [
    'https://images.example/v1/images/edits',
    'https://atomflow.vip/custom/v1/images/edits',
    'https://atomflow.vip/v1/images/edits?target=other',
    'https://atomflow.vip.other.example/v1/images/edits',
  ]) assert.equal(imageRequestEndpoint(endpoint, true), endpoint);
});

test('local proxy preserves multipart bytes and auth, excludes cookies, and rejects foreign origins', async () => {
  const calls = [];
  const upstream = createHttpServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    calls.push({ url: req.url, headers: req.headers, body: Buffer.concat(chunks) });
    res.writeHead(401, { 'Content-Type': 'application/json', 'Set-Cookie': 'upstream=secret' });
    res.end(JSON.stringify({ error: { message: 'invalid test credential' } }));
  });
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  const pattern = '^/__opc-image/site/v1/images/edits$';
  const server = await createServer({
    configFile: false,
    server: {
      host: '127.0.0.1', port: 0, hmr: false, ws: false,
      proxy: { [pattern]: {
        ...config.server.proxy[pattern],
        target: `http://127.0.0.1:${upstream.address().port}`,
      } },
    },
    appType: 'custom',
  });
  try {
    await server.listen();
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    const endpoint = `${origin}/__opc-image/site/v1/images/edits`;
    const form = new FormData();
    form.set('model', 'gpt-image-2');
    form.append('image[]', new Blob(['pose-original']), 'pose.png');
    form.append('image[]', new Blob(['outfit-original']), 'outfit.png');
    const request = new Request(endpoint, { method: 'POST', body: form });
    const body = Buffer.from(await request.arrayBuffer());
    const response = await fetch(endpoint, {
      method: 'POST', body,
      headers: {
        Origin: origin, Authorization: 'Bearer local-test-only',
        Cookie: 'local-session=private', 'Content-Type': request.headers.get('Content-Type'),
      },
    });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.message, 'invalid test credential');
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/v1/images/edits');
    assert.equal(calls[0].headers.authorization, 'Bearer local-test-only');
    assert.equal(calls[0].headers.cookie, undefined);
    assert.deepEqual(calls[0].body, body);
    assert.equal((await fetch(endpoint, { method: 'POST', headers: { Origin: 'https://other.example' } })).status, 404);
    assert.equal((await fetch(endpoint)).status, 404);
    assert.equal(calls.length, 1);
  } finally {
    await server.close();
    await new Promise((resolve) => upstream.close(resolve));
  }
});

test('reference network failures are distinguished from provider connection failures without retry', async () => {
  const reference = {
    kind: 'pose', title: { zh: 'test', en: 'test' }, keywords: { zh: '', en: '' },
    variant: { id: 'pose', original: 'https://ai-pose-gallery.pages.dev/img/test.png' },
  };
  const config = { ...api.defaultImageConfig, apiKey: 'local-test-only' };
  let calls = 0;
  await assert.rejects(api.generateReferenceImage(config, [reference], 'test', new AbortController().signal, async () => {
    calls++;
    throw new TypeError('Failed to fetch');
  }), (error) => error.code === 'referenceFailed');
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(api.generateReferenceImage(config, [reference], 'test', new AbortController().signal, async (_url, options) => {
    calls++;
    if (options.method === 'POST') throw new TypeError('Failed to fetch');
    return new Response(new Blob(['test'], { type: 'image/png' }));
  }), (error) => error.code === 'networkFailed');
  assert.equal(calls, 2);
});
