import { test, after } from 'node:test';
import assert from 'node:assert/strict';
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
    const legacy = JSON.parse(localStorage.getItem('opc-image-settings'));
    localStorage.setItem(
      'opc-image-settings',
      JSON.stringify({ ...legacy, model: 'grok-imagine-image-2.0' }),
    );
    assert.equal(api.loadImageConfig().model, 'gpt-image-2');
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
  assert.equal(request.options.headers['Content-Type'], undefined);
  assert.equal(request.options.body.getAll('image[]').length, 2);
  assert.equal(request.options.body.get('model'), 'gpt-image-2');
  assert.equal(request.options.body.get('prompt'), 'draw a character');
  assert.equal(request.options.body.get('input_fidelity'), null);
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

const characterReference = {
  kind: 'character',
  title: { zh: '人物参考', en: 'Character reference' },
  keywords: { zh: '保留人物身份与画风', en: 'Preserve character identity and visual style' },
  file: new File([Buffer.from(png, 'base64')], 'private-personal-name.png', { type: 'image/png' }),
  variant: {
    id: 'character-upload',
    image: 'blob:local-preview',
    thumbnail: 'blob:local-preview',
    original: 'blob:local-preview',
  },
};

test('optional character is a third original file without fetching its preview or exposing its filename', async () => {
  const refs = [...references, characterReference];
  const calls = [];
  await api.generateReferenceImage(
    config,
    refs,
    api.referencePrompt(refs, 'en'),
    new AbortController().signal,
    async (url, options) => {
      calls.push({ url, options });
      return calls.length <= 2
        ? new Response(Buffer.from(png, 'base64'), { headers: { 'Content-Type': 'image/png' } })
        : Response.json({ data: [{ b64_json: png }] });
    },
  );
  assert.equal(calls.length, 3);
  assert.deepEqual(
    calls.slice(0, 2).map((call) => call.url),
    references.map((ref) => ref.variant.original),
  );
  assert.ok(calls.slice(0, 2).every((call) => call.options.headers === undefined));
  const form = calls[2].options.body;
  const files = form.getAll('image[]');
  assert.equal(files.length, 3);
  assert.equal(files[2].name, 'character-upload.png');
  assert.deepEqual(Buffer.from(await files[2].arrayBuffer()), Buffer.from(png, 'base64'));
  assert.match(form.get('prompt'), /Reference 3 \(character\)/);
  assert.match(form.get('prompt'), /identity and visual style/);
  assert.ok(!form.get('prompt').includes(characterReference.file.name));
});

test('character prompts describe actual role order in both languages without changing the two-reference workflow', () => {
  const refs = [references[1], references[0], characterReference];
  const en = api.referencePrompt(refs, 'en');
  assert.match(en, /Reference 1 \(costume\)/);
  assert.match(en, /Reference 2 \(pose\)/);
  assert.match(en, /Reference 3 \(character\)/);
  const zh = api.referencePrompt(refs, 'zh');
  assert.match(zh, /参考图 1（服装）/);
  assert.match(zh, /参考图 3（人物）/);
  assert.match(zh, /保留其五官/);
  const original = api.referencePrompt(references, 'en');
  assert.match(original, /^Create a finished character illustration/);
  assert.ok(!original.includes('character reference'));
});

test('invalid character uploads are rejected before making any network request', async () => {
  const invalid = [
    [new File(['<svg/>'], 'spoof.png', { type: 'image/png' }), 'characterInvalid'],
    [new File([], 'empty.png', { type: 'image/png' }), 'characterInvalid'],
    [
      new File([Buffer.from(png, 'base64')], 'wrong.jpg', { type: 'image/jpeg' }),
      'characterInvalid',
    ],
    [
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }),
      'characterTooLarge',
    ],
  ];
  for (const [file, code] of invalid) {
    let calls = 0;
    await assert.rejects(
      api.generateReferenceImage(
        config,
        [...references, { ...characterReference, file }],
        'draw',
        new AbortController().signal,
        async () => {
          calls++;
        },
      ),
      (error) => error.code === code,
    );
    assert.equal(calls, 0);
  }
});

test('adding a character does not relax the gallery origin restriction', async () => {
  let calls = 0;
  const untrusted = {
    ...references[0],
    variant: { ...references[0].variant, original: 'https://untrusted.example/pose.png' },
  };
  await assert.rejects(
    api.generateReferenceImage(
      config,
      [untrusted, references[1], characterReference],
      'draw',
      new AbortController().signal,
      async () => {
        calls++;
      },
    ),
    (error) => error.code === 'referenceFailed',
  );
  assert.equal(calls, 0);
});

test('library character is fetched as a third original and uploaded with no API key sent to the source', async () => {
  const galleryCharacter = {
    kind: 'character',
    title: { zh: '人物', en: 'Character' },
    keywords: { zh: '保留人物身份', en: 'Preserve identity' },
    variant: { id: 'f123', original: 'https://ai-portrait-gallery.pages.dev/img/full/f123.png' },
  };
  const refs = [...references, galleryCharacter];
  const calls = [];
  await api.generateReferenceImage(
    config,
    refs,
    api.referencePrompt(refs, 'en'),
    new AbortController().signal,
    async (url, options) => {
      calls.push({ url, options });
      return calls.length <= 3
        ? new Response(Buffer.from(png, 'base64'), { headers: { 'Content-Type': 'image/png' } })
        : Response.json({ data: [{ b64_json: png }] });
    },
  );
  assert.deepEqual(
    calls.slice(0, 3).map((call) => call.url),
    refs.map((ref) => ref.variant.original),
  );
  assert.ok(calls.slice(0, 3).every((call) => call.options.headers === undefined));
  const form = calls[3].options.body;
  assert.equal(form.getAll('image[]').length, 3);
  assert.equal(form.getAll('image[]')[2].name, 'f123.png');
  assert.match(form.get('prompt'), /Reference 3 \(character\)/);
  galleryCharacter.variant.original = 'https://other.example/person.png';
  await assert.rejects(
    api.generateReferenceImage(
      config,
      [galleryCharacter],
      'draw',
      new AbortController().signal,
      async () => {
        throw Error('Must not fetch an untrusted origin');
      },
    ),
    (error) => error.code === 'referenceFailed',
  );
});

test('depth pose uploads the selected depth original and explains depth without granting other kinds access', async () => {
  const pose = {
    ...references[0],
    variant: {
      ...references[0].variant,
      original: 'https://ai-pose-depth-gallery.pages.dev/img/full_single_P001_side.png',
    },
  };
  const refs = [pose, references[1]];
  assert.match(api.referencePrompt(refs, 'zh'), /此图为深度图/);
  assert.match(api.referencePrompt(refs, 'en'), /This is a depth map/);
  const calls = [];
  await api.generateReferenceImage(
    config,
    refs,
    api.referencePrompt(refs, 'en'),
    new AbortController().signal,
    async (url, options) => {
      calls.push({ url, options });
      return calls.length <= 2
        ? new Response(Buffer.from(png, 'base64'), { headers: { 'Content-Type': 'image/png' } })
        : Response.json({ data: [{ b64_json: png }] });
    },
  );
  assert.equal(calls[0].url, pose.variant.original);
  assert.equal(calls[0].options.headers, undefined);
  assert.equal(calls[0].options.credentials, 'omit');
  const files = calls[2].options.body.getAll('image[]');
  assert.equal(files.length, 2);
  assert.deepEqual(Buffer.from(await files[0].arrayBuffer()), Buffer.from(png, 'base64'));
  for (const kind of ['costume', 'character']) {
    await assert.rejects(
      api.generateReferenceImage(
        config,
        [{ ...pose, kind }],
        'draw',
        new AbortController().signal,
        async () => {
          throw Error('Must not fetch a depth image as a non-pose reference');
        },
      ),
      (error) => error.code === 'referenceFailed',
    );
  }
});

test('uploaded costumes are sent as a file alongside the pose, without fetching previews or leaking local names', async () => {
  const outfit = {
    ...characterReference,
    kind: 'costume',
    title: { zh: '上传的服饰', en: 'Uploaded costume' },
    keywords: { zh: '采用服饰配色与材质', en: 'Use the outfit colors and materials' },
    variant: { ...characterReference.variant, id: 'costume-upload' },
    file: new File([Buffer.from(png, 'base64')], 'private-outfit-name.png', { type: 'image/png' }),
  };
  const refs = [references[0], outfit, characterReference];
  const calls = [];
  await api.generateReferenceImage(
    config,
    refs,
    api.referencePrompt(refs, 'en'),
    new AbortController().signal,
    async (url, options) => {
      calls.push({ url, options });
      return calls.length === 1
        ? new Response(Buffer.from(png, 'base64'), { headers: { 'Content-Type': 'image/png' } })
        : Response.json({ data: [{ b64_json: png }] });
    },
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, references[0].variant.original);
  assert.equal(calls[0].options.headers, undefined);
  const files = calls[1].options.body.getAll('image[]');
  assert.equal(files.length, 3);
  assert.equal(files[1].name, 'costume-upload.png');
  assert.equal(files[2].name, 'character-upload.png');
  assert.deepEqual(Buffer.from(await files[1].arrayBuffer()), Buffer.from(png, 'base64'));
  assert.match(calls[1].options.body.get('prompt'), /Reference 2 \(costume\)/);
  assert.ok(!calls[1].options.body.get('prompt').includes(outfit.file.name));
});

test('invalid and oversized costume uploads fail before any reference or provider request', async () => {
  for (const [file, code] of [
    [new File(['<svg/>'], 'outfit.png', { type: 'image/png' }), 'costumeInvalid'],
    [
      new File([Buffer.from(png, 'base64')], 'outfit.jpg', { type: 'image/jpeg' }),
      'costumeInvalid',
    ],
    [
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'outfit.png', { type: 'image/png' }),
      'costumeTooLarge',
    ],
  ]) {
    let calls = 0;
    await assert.rejects(
      api.generateReferenceImage(
        config,
        [references[0], { ...characterReference, kind: 'costume', file }],
        'draw',
        new AbortController().signal,
        async () => {
          calls++;
        },
      ),
      (error) => error.code === code,
    );
    assert.equal(calls, 0);
  }
});
