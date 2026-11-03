import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
  appType: 'custom',
});
const { compatiblePoseAlternatives } = await vite.ssrLoadModule('/src/studio-randomize.ts');
after(() => vite.close());

const localized = (value) => ({ zh: value, en: value });
const item = (id, kind, gender) => ({
  id,
  kind,
  code: id,
  title: localized(id),
  category: { id: 'test', ...localized('test') },
  series: localized('test'),
  extended: false,
  keywords: localized(id),
  source: 'test',
  tags: [{ id: gender, ...localized(gender) }],
  variants: [
    {
      id: `${id}-front`,
      angle: 'front',
      label: localized('front'),
      thumbnail: `${id}.webp`,
      image: `${id}.webp`,
      original: `${id}.png`,
    },
  ],
});
const reference = (value) => ({
  kind: value.kind,
  title: value.title,
  keywords: value.keywords,
  variant: value.variants[0],
});

test('random pose alternatives follow character gender before costume and exclude current pose', () => {
  const femaleCharacter = item('female-character', 'character', 'female');
  const maleCostume = item('male-costume', 'costume', 'male');
  const currentPose = item('female-current', 'pose', 'female');
  const femalePose = item('female-next', 'pose', 'female');
  const malePose = item('male-next', 'pose', 'male');
  const items = [femaleCharacter, maleCostume, currentPose, femalePose, malePose];

  assert.deepEqual(
    compatiblePoseAlternatives(
      items,
      [reference(currentPose), reference(maleCostume), reference(femaleCharacter)],
      currentPose,
    ).map(({ id }) => id),
    ['female-next'],
  );
});

test('uploaded references fall back to the current pose gender', () => {
  const currentPose = item('male-current', 'pose', 'male');
  const malePose = item('male-next', 'pose', 'male');
  const femalePose = item('female-next', 'pose', 'female');
  const uploadedCharacter = {
    ...reference(item('upload', 'character', 'female')),
    file: new File([], 'character.png', { type: 'image/png' }),
    variant: {
      ...reference(item('upload', 'character', 'female')).variant,
      id: 'character-upload',
      original: 'blob:character',
    },
  };

  assert.deepEqual(
    compatiblePoseAlternatives(
      [currentPose, malePose, femalePose],
      [reference(currentPose), uploadedCharacter],
      currentPose,
    ).map(({ id }) => id),
    ['male-next'],
  );
});
