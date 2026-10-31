import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
  appType: 'custom',
});
const { extractCostume, costumeExtractionPrompt } = await vite.ssrLoadModule(
  '/src/costume-extraction.ts',
);
const { defaultImageConfig, generateReferenceImage } =
  await vite.ssrLoadModule('/src/generation.ts');
after(() => vite.close());
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=',
  'base64',
);
const original = new File([png], 'private-photo.png', { type: 'image/png' });
const config = {
  ...defaultImageConfig,
  baseUrl: 'https://images.example',
  apiKey: 'test-only-key',
};

test('outfit extraction sends just the uploaded photo, then uses the extracted bytes in generation', async () => {
  const extractedBytes = Buffer.concat([png, Buffer.from('extracted-outfit')]);
  const calls = [];
  const extracted = await extractCostume(
    config,
    original,
    new AbortController().signal,
    async (url, options) => {
      calls.push({ url, options });
      return calls.length === 1
        ? Response.json({ data: [{ url: 'https://results.example/outfit.png' }] })
        : new Response(extractedBytes, { headers: { 'Content-Type': 'image/png' } });
    },
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://images.example/v1/images/edits');
  assert.equal(calls[0].options.body.get('model'), 'gpt-image-2');
  assert.equal(calls[0].options.body.get('prompt'), costumeExtractionPrompt);
  assert.equal(calls[0].options.body.getAll('image[]').length, 1);
  assert.equal(calls[0].options.body.get('image[]').name, 'costume-upload.png');
  assert.equal(calls[1].options.headers, undefined);
  assert.equal(calls[1].options.credentials, 'omit');
  assert.deepEqual(Buffer.from(await extracted.arrayBuffer()), extractedBytes);
  assert.equal(extracted.name, 'costume-extracted.png');
  await generateReferenceImage(
    config,
    [{ kind: 'costume', file: extracted, variant: { id: 'costume-upload' } }],
    'generate character',
    new AbortController().signal,
    async (_url, options) => {
      assert.deepEqual(
        Buffer.from(await options.body.get('image[]').arrayBuffer()),
        extractedBytes,
      );
      return Response.json({ data: [{ b64_json: png.toString('base64') }] });
    },
  );
});

test('failed extraction does not fall back to the unprocessed upload or silently retry', async () => {
  let calls = 0;
  await assert.rejects(
    extractCostume(config, original, new AbortController().signal, async () => {
      calls++;
      return Response.json({ error: { message: `Rejected ${config.apiKey}` } }, { status: 400 });
    }),
    (error) => error.code === 'providerFailed' && !error.message.includes(config.apiKey),
  );
  assert.equal(calls, 1);
});

test('invalid uploads and cancelled extraction never reach the provider', async () => {
  const controller = new AbortController();
  controller.abort();
  const mustNotFetch = async () => {
    throw Error('unexpected provider request');
  };
  await assert.rejects(
    extractCostume(config, original, controller.signal, mustNotFetch),
    (error) => error.code === 'cancelled',
  );
  await assert.rejects(
    extractCostume(
      config,
      new File(['text'], 'photo.png', { type: 'image/png' }),
      new AbortController().signal,
      mustNotFetch,
    ),
    (error) => error.code === 'costumeInvalid',
  );
});

test('invalid extracted images are rejected before replacing the costume', async () => {
  let calls = 0;
  await assert.rejects(
    extractCostume(config, original, new AbortController().signal, async () => {
      calls++;
      return calls === 1
        ? Response.json({ data: [{ url: 'https://results.example/not-image' }] })
        : new Response('<html/>', { headers: { 'Content-Type': 'text/html' } });
    }),
    (error) => error.code === 'invalidResult',
  );
});
