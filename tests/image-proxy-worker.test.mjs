import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
  appType: 'custom',
});
const { handleImageProxy } = await vite.ssrLoadModule('/worker/src/index.ts');
after(() => vite.close());

const workerUrl = 'https://proxy.example/site/v1/images/edits';
const allowedOrigin = 'https://hongye007.github.io';

test('worker preflight explicitly permits authorization from the production site', async () => {
  const response = await handleImageProxy(
    new Request(workerUrl, { method: 'OPTIONS', headers: { Origin: allowedOrigin } }),
  );
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), allowedOrigin);
  assert.equal(response.headers.get('Access-Control-Allow-Headers'), 'Authorization, Content-Type');
  assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
});

test('worker rejects unknown routes, foreign origins and oversized requests', async () => {
  assert.equal(
    (
      await handleImageProxy(
        new Request('https://proxy.example/other', {
          method: 'OPTIONS',
          headers: { Origin: allowedOrigin },
        }),
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await handleImageProxy(
        new Request(workerUrl, {
          method: 'OPTIONS',
          headers: { Origin: 'https://attacker.example' },
        }),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await handleImageProxy(
        new Request(workerUrl, {
          method: 'POST',
          headers: {
            Origin: allowedOrigin,
            Authorization: 'Bearer test-only',
            'Content-Type': 'multipart/form-data; boundary=test',
            'Content-Length': String(97 * 1024 * 1024),
          },
          body: '--test--',
        }),
      )
    ).status,
    413,
  );
});

test('worker streams multipart bytes to a fixed upstream without cookies', async () => {
  const form = new FormData();
  form.set('model', 'gpt-image-2');
  form.append('image[]', new Blob(['pose-original']), 'pose.png');
  const clientRequest = new Request(workerUrl, {
    method: 'POST',
    headers: {
      Origin: allowedOrigin,
      Authorization: 'Bearer test-only',
      Cookie: 'client-session=private',
    },
    body: form,
  });
  const expectedBytes = Buffer.from(await clientRequest.clone().arrayBuffer());
  let forwarded;
  const response = await handleImageProxy(clientRequest, async (input, init) => {
    forwarded = {
      url: String(input),
      headers: new Headers(init.headers),
      bytes: Buffer.from(await new Response(init.body).arrayBuffer()),
    };
    return Response.json(
      { error: { message: 'invalid test credential' } },
      {
        status: 401,
        headers: {
          'Set-Cookie': 'upstream=secret',
          'X-Oneapi-Request-Id': 'test-request-id',
        },
      },
    );
  });

  assert.equal(forwarded.url, 'https://atomflow.vip/v1/images/edits');
  assert.equal(forwarded.headers.get('Authorization'), 'Bearer test-only');
  assert.match(forwarded.headers.get('Content-Type'), /^multipart\/form-data; boundary=/);
  assert.equal(forwarded.headers.get('Cookie'), null);
  assert.deepEqual(forwarded.bytes, expectedBytes);
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('Set-Cookie'), null);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), allowedOrigin);
  assert.equal(response.headers.get('X-Oneapi-Request-Id'), 'test-request-id');
  assert.deepEqual(await response.json(), { error: { message: 'invalid test credential' } });
});
