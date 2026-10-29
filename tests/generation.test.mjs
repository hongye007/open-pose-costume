import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'vite';

const vite = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
  appType: 'custom',
});
const api = await vite.ssrLoadModule('/src/generation.ts');
after(() => vite.close());
const png =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=';
const config = {
  ...api.defaultImageConfig,
  model: 'gpt-image-2',
  baseUrl: 'https://images.example/v1',
  apiKey: 'test-only-key',
};
const references = ['pose', 'costume'].map((kind) => ({
  kind,
  title: { zh: kind, en: kind },
  keywords: { zh: kind, en: kind },
  variant: {
    id: kind,
    image: '',
    thumbnail: '',
    original: `https://ai-${kind}-gallery.pages.dev/img/${kind}.png`,
  },
}));

test('endpoint normalization accepts compatible bases and rejects credential-bearing URLs', () => {
  for (const base of [
    'https://images.example',
    'https://images.example/v1/',
    'https://images.example/v1/images/edits',
  ])
    assert.equal(api.imageEndpoint(base), 'https://images.example/v1/images/edits');
  assert.equal(
    api.imageEndpoint('http://127.0.0.1:6000/v1'),
    'http://127.0.0.1:6000/v1/images/edits',
  );
  for (const base of [
    'http://images.example',
    'https://u:p@images.example',
    'https://images.example?key=value',
    'javascript:alert(1)',
  ])
    assert.throws(() => api.imageEndpoint(base));
});

test('keys are session-only by default, optional persistent storage can be cleared', () => {
  const storage = () => {
    const values = new Map();
    return {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    };
  };
  globalThis.localStorage = storage();
  globalThis.sessionStorage = storage();
  try {
    api.saveImageConfig(config);
    assert.ok(!localStorage.getItem('opc-image-settings').includes(config.apiKey));
    assert.equal(api.loadImageConfig().apiKey, config.apiKey);
    sessionStorage.removeItem('opc-image-session-key');
    assert.equal(api.loadImageConfig().apiKey, '');
    assert.equal(api.loadImageConfig().baseUrl, config.baseUrl);
    api.saveImageConfig({ ...config, rememberKey: true });
    assert.equal(api.loadImageConfig().apiKey, config.apiKey);
    api.saveImageConfig(config);
    assert.ok(!localStorage.getItem('opc-image-settings').includes(config.apiKey));
    api.clearImageConfig();
    assert.equal(api.loadImageConfig().apiKey, '');
    assert.equal(sessionStorage.getItem('opc-image-session-key'), null);
  } finally {
    delete globalThis.localStorage;
    delete globalThis.sessionStorage;
  }
});

test('image edit request attaches both original files and keeps auth off image sources', async () => {
  const calls = [];
  const result = await api.generateReferenceImage(
    config,
    references,
    'draw a character',
    new AbortController().signal,
    async (url, options) => {
      calls.push({ url, options });
      return calls.length <= 2
        ? new Response(Buffer.from(png, 'base64'), { headers: { 'Content-Type': 'image/png' } })
        : Response.json({ data: [{ b64_json: png }] });
    },
  );
  assert.equal(result, `data:image/png;base64,${png}`);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].options.headers, undefined);
  assert.equal(calls[1].options.headers, undefined);
  const request = calls[2];
  assert.equal(request.url, 'https://images.example/v1/images/edits');
  assert.equal(request.options.headers.Authorization, `Bearer ${config.apiKey}`);
  assert.equal(request.options.body.getAll('image[]').length, 2);
  assert.equal(request.options.body.get('model'), 'gpt-image-2');
  assert.equal(request.options.body.get('prompt'), 'draw a character');
  assert.equal(request.options.body.get('input_fidelity'), null);
});

test('Grok sends both original URLs as JSON over HTTP, without multipart or GPT-only options', async () => {
  const requests = [];
  const server = createHttpServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    requests.push({ path: request.url, headers: request.headers, payload: JSON.parse(body) });
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ data: [{ b64_json: png }] }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    for (const [size, ratio] of [
      ['1024x1536', '2:3'],
      ['1536x1024', '3:2'],
      ['2048x2048', '1:1'],
      ['auto', undefined],
    ]) {
      const result = await api.generateReferenceImage(
        {
          ...config,
          model: 'grok-imagine-image-2.0',
          size,
          baseUrl: `http://127.0.0.1:${server.address().port}`,
        },
        references,
        'combine these references',
        new AbortController().signal,
      );
      assert.equal(result, `data:image/png;base64,${png}`);
      const request = requests.at(-1);
      assert.equal(request.path, '/v1/images/edits');
      assert.equal(request.headers['content-type'], 'application/json');
      assert.equal(request.headers.authorization, `Bearer ${config.apiKey}`);
      assert.deepEqual(request.payload, {
        model: 'grok-imagine-image-2.0',
        prompt: 'combine these references',
        n: 1,
        images: references.map((reference) => ({
          type: 'image_url',
          url: reference.variant.original,
        })),
        ...(ratio ? { aspect_ratio: ratio } : {}),
      });
    }
    assert.equal(requests.length, 4);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Grok validates reference origins and never auto-retries a failed JSON request', async () => {
  const grokConfig = { ...config, model: 'grok-imagine-image-2.0' };
  let calls = 0;
  const fail = async () => {
    calls++;
    return Response.json(
      { error: { message: `Invalid request ${config.apiKey}` } },
      { status: 400 },
    );
  };
  await assert.rejects(
    api.generateReferenceImage(
      grokConfig,
      [
        {
          ...references[0],
          variant: { ...references[0].variant, original: 'https://untrusted.example/private.png' },
        },
      ],
      'draw',
      new AbortController().signal,
      fail,
    ),
    (error) => error.code === 'referenceFailed',
  );
  assert.equal(calls, 0);
  await assert.rejects(
    api.generateReferenceImage(grokConfig, references, 'draw', new AbortController().signal, fail),
    (error) => error.code === 'providerFailed' && !error.message.includes(config.apiKey),
  );
  assert.equal(calls, 1);
});

test('a relay dropping Grok references produces a specific diagnostic without auto-retry', async () => {
  let calls = 0;
  await assert.rejects(
    api.generateReferenceImage(
      { ...config, model: 'grok-imagine-image-2.0' },
      references,
      'combine references',
      new AbortController().signal,
      async (_url, options) => {
        calls++;
        const sent = JSON.parse(options.body);
        assert.equal(sent.images.length, 2);
        // New API's xAI adapter projects only these fields unless body passthrough is enabled.
        const relayed = { model: sent.model, prompt: sent.prompt, n: sent.n };
        assert.equal(relayed.images, undefined);
        return Response.json(
          { error: { message: 'image 或 images 数量必须在 1 到 8 之间' } },
          { status: 400 },
        );
      },
    ),
    (error) => error.code === 'referencesRejected' && error.message.includes('HTTP 400'),
  );
  assert.equal(calls, 1);
});

test('provider errors are redacted and not retried automatically', async () => {
  let calls = 0;
  await assert.rejects(
    api.generateReferenceImage(
      config,
      [references[0]],
      'draw',
      new AbortController().signal,
      async () => {
        calls++;
        return calls === 1
          ? new Response(Buffer.from(png, 'base64'), { headers: { 'Content-Type': 'image/png' } })
          : Response.json({ error: { message: `Rejected ${config.apiKey}` } }, { status: 401 });
      },
    ),
    (error) => error.code === 'providerFailed' && !error.message.includes(config.apiKey),
  );
  assert.equal(calls, 2);
});

test('invalid results and non-image references fail instead of displaying arbitrary content', async () => {
  for (const payload of [
    null,
    {},
    { data: [{ b64_json: 'x' }] },
    { data: [{ url: 'javascript:alert(1)' }] },
    { data: [{ url: 'data:image/svg+xml,test' }] },
  ])
    assert.throws(() => api.imageResult(payload));
  assert.equal(
    api.imageResult({ data: [{ url: 'https://images.example/result.png' }] }),
    'https://images.example/result.png',
  );
  let calls = 0;
  await assert.rejects(
    api.generateReferenceImage(
      config,
      [references[0]],
      'draw',
      new AbortController().signal,
      async () => {
        calls++;
        return new Response('<html>error</html>', { headers: { 'Content-Type': 'text/html' } });
      },
    ),
    (error) => error.code === 'referenceFailed',
  );
  assert.equal(calls, 1);
});

test('cancelled requests are distinct from network errors and never continue to the provider', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    api.generateReferenceImage(
      config,
      references,
      'draw',
      controller.signal,
      async (_url, options) => {
        options.signal.throwIfAborted();
      },
    ),
    (error) => error.code === 'cancelled',
  );
  const prompt = api.referencePrompt(references, 'en');
  assert.ok(prompt.includes('Reference 1 (pose)'));
  assert.ok(prompt.includes('Reference 2 (costume)'));
});
