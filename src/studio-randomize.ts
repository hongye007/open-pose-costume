import type { ImageReference } from './generation';
import type { Reference } from './types';

type SubjectGender = 'female' | 'male';

function subjectGender(item?: Reference): SubjectGender | undefined {
  const id = item?.tags?.find((tag) => tag.id === 'female' || tag.id === 'male')?.id;
  return id === 'female' || id === 'male' ? id : undefined;
}

function referenceItem(reference: ImageReference, items: Reference[]): Reference | undefined {
  return items.find(
    (item) =>
      item.kind === reference.kind &&
      item.variants.some(
        (variant) =>
          variant.id === reference.variant.id || variant.original === reference.variant.original,
      ),
  );
}

function referenceGender(
  items: Reference[],
  references: ImageReference[],
  currentPose?: Reference,
): SubjectGender | undefined {
  for (const kind of ['character', 'costume', 'pose'] as const) {
    const reference = references.find((candidate) => candidate.kind === kind);
    const gender = reference && subjectGender(referenceItem(reference, items));
    if (gender) return gender;
  }
  return subjectGender(currentPose);
}

export function compatiblePoseAlternatives(
  items: Reference[],
  references: ImageReference[],
  currentPose?: Reference,
): Reference[] {
  const gender = referenceGender(items, references, currentPose);
  return items.filter(
    (item) =>
      item.kind === 'pose' &&
      item.id !== currentPose?.id &&
      (!gender || subjectGender(item) === gender),
  );
}
