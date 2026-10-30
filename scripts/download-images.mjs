import { createHash } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifestPath = path.join(root, 'data/image-download-manifest.json');
const summaryPath = path.join(root, 'data/image-download-summary.json');
const lockPath = path.join(root, 'data/image-download.lock');
const options = process.argv.slice(2);
const concurrencyIndex = options.indexOf('--concurrency');
const concurrency = concurrencyIndex < 0 ? 8 : Number(options[concurrencyIndex + 1]);
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16)
  throw Error('--concurrency must be an integer from 1 to 16');
if (
  options.some(
    (arg, i) => concurrencyIndex < 0 || (i !== concurrencyIndex && i !== concurrencyIndex + 1),
  ) ||
  options.filter((arg) => arg === '--concurrency').length > 1
)
  throw Error('Usage: node scripts/download-images.mjs [--concurrency 8]');

const catalogBytes = await readFile(path.join(root, 'public/data/catalog.json'));
const catalog = JSON.parse(catalogBytes);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const jobs = [];
const paths = new Set();
for (const item of catalog.items) {
  // Portraits remain remote references; this command archives only poses and costumes.
  if (item.kind === 'character') continue;
  if (!['pose', 'costume'].includes(item.kind)) throw Error('Unexpected image kind');
  const origin = `https://ai-${item.kind}-gallery.pages.dev`;
  for (const variant of item.variants) {
    if (!/^[A-Za-z0-9_-]+$/.test(variant.id)) throw Error('Unsafe variant ID');
    for (const [role, field] of [
      ['covers', 'thumbnail'],
      ['originals', 'original'],
    ]) {
      const url = new URL(variant[field]);
      const extension = path.posix.extname(url.pathname).toLowerCase();
      if (url.origin !== origin || !['.jpg', '.png', '.webp'].includes(extension))
        throw Error(`Unexpected image URL: ${url.href}`);
      const relativePath = `${item.kind}/${role}/${variant.id}${extension}`;
      if (paths.has(relativePath)) throw Error(`Duplicate image path: ${relativePath}`);
      paths.add(relativePath);
      jobs.push({
        kind: item.kind,
        referenceId: item.id,
        variantId: variant.id,
        angle: variant.angle,
        role,
        url: url.href,
        path: relativePath,
      });
    }
  }
}

// Keep concurrent invocations from writing to the same archive.
try {
  const previousPid = Number(await readFile(lockPath, 'utf8'));
  if (!Number.isInteger(previousPid) || previousPid < 1) throw Error('Invalid download lock');
  try {
    process.kill(previousPid, 0);
    throw Error(`Another downloader is active (PID ${previousPid})`);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
    await unlink(lockPath);
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const lock = await open(lockPath, 'wx');
await lock.writeFile(String(process.pid));

const startedAt = new Date().toISOString();
let manifest = { version: 1, files: {} };
let cursor = 0,
  done = 0,
  downloaded = 0,
  skipped = 0;
let checkpoint = Promise.resolve();
let lastLog = 0;
const failures = [];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function validate(bytes, extension) {
  if (bytes.length < 64) throw Error('Image response is too small');
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp =
    bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!(extension === '.png' ? png : extension === '.jpg' ? jpg : webp))
    throw Error('Image signature does not match its file extension');
  if (png && bytes.toString('ascii', bytes.length - 8, bytes.length - 4) !== 'IEND')
    throw Error('Incomplete PNG image');
  if (jpg && !(bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217))
    throw Error('Incomplete JPEG image');
  if (webp && bytes.readUInt32LE(4) + 8 !== bytes.length) throw Error('Incomplete WebP image');
}

function saveManifest() {
  // Snapshot before queuing, and serialize atomic replacements.
  manifest.updatedAt = new Date().toISOString();
  const snapshot = JSON.stringify(manifest, null, 2) + '\n';
  checkpoint = checkpoint.then(async () => {
    await writeFile(`${manifestPath}.tmp`, snapshot);
    await rename(`${manifestPath}.tmp`, manifestPath);
  });
  return checkpoint;
}

async function download(job) {
  const target = path.join(root, job.path);
  const extension = path.extname(target);
  try {
    const bytes = await readFile(target);
    validate(bytes, extension);
    const hash = sha256(bytes);
    const previous = manifest.files[job.path];
    if (previous && (previous.url !== job.url || previous.sha256 !== hash))
      throw Error('Cached image differs from its download manifest');
    manifest.files[job.path] = {
      ...job,
      bytes: bytes.length,
      sha256: hash,
      downloadedAt: previous?.downloadedAt ?? startedAt,
    };
    skipped++;
    return;
  } catch (error) {
    if (error.code !== 'ENOENT') console.log(`Re-fetch ${job.path}: ${error.message}`);
  }
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(job.url, {
        signal: AbortSignal.timeout(60000),
        redirect: 'error',
        headers: { 'User-Agent': 'OpenPoseCostume/0.1 (local reference archive)' },
      });
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 429) {
          const retryAfter = Number(response.headers.get('retry-after'));
          await pause(Math.min(60000, Math.max(1000, retryAfter * 1000 || 5000)));
        }
        throw Error(`HTTP ${response.status}`);
      }
      if (!response.headers.get('content-type')?.startsWith('image/')) {
        await response.body?.cancel();
        throw Error('Server returned a non-image response');
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      validate(bytes, extension);
      await writeFile(`${target}.part`, bytes);
      await rename(`${target}.part`, target);
      manifest.files[job.path] = {
        ...job,
        bytes: bytes.length,
        sha256: sha256(bytes),
        downloadedAt: new Date().toISOString(),
      };
      downloaded++;
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 4) await pause(1000 * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}

try {
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (manifest.version !== 1 || !manifest.files) throw Error('Unsupported image manifest');
  manifest.catalogSha256 = sha256(catalogBytes);
  for (const kind of ['pose', 'costume']) {
    for (const role of ['covers', 'originals'])
      await mkdir(path.join(root, kind, role), { recursive: true });
  }
  console.log(
    `Downloading ${jobs.length} images with ${concurrency} workers. Existing valid files are reused.`,
  );
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (cursor < jobs.length) {
        const job = jobs[cursor++];
        try {
          await download(job);
        } catch (error) {
          failures.push({ ...job, error: error.message });
          console.error(`Failed ${job.path}: ${error.message}`);
        }
        done++;
        if (done % 25 === 0) await saveManifest();
        if (Date.now() - lastLog > 10000 || done === jobs.length) {
          console.log(
            `${done}/${jobs.length} processed; ${downloaded} downloaded; ${skipped} reused; ${failures.length} failed`,
          );
          lastLog = Date.now();
        }
      }
    }),
  );
  manifest.failures = failures;
  await saveManifest();
  const groups = {};
  for (const kind of ['pose', 'costume']) {
    groups[kind] = {};
    for (const role of ['covers', 'originals']) {
      const selected = jobs.filter((job) => job.kind === kind && job.role === role);
      const successful = selected.filter(
        (job) => !failures.some((failure) => failure.path === job.path),
      );
      groups[kind][role] = {
        expected: selected.length,
        available: successful.length,
        bytes: successful.reduce((sum, job) => sum + manifest.files[job.path].bytes, 0),
      };
    }
  }
  const summary = {
    startedAt,
    finishedAt: new Date().toISOString(),
    expected: jobs.length,
    downloaded,
    reused: skipped,
    failed: failures.length,
    groups,
    failures,
  };
  await writeFile(summaryPath, JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {
  await checkpoint;
  await lock.close();
  await unlink(lockPath);
}
