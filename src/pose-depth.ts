import type { Reference, Variant } from './types';

const poseOrigin = 'https://ai-pose-gallery.pages.dev';
export const poseDepthOrigin = 'https://ai-pose-depth-gallery.pages.dev';

export function hasPoseDepth(item: Reference): boolean {
  return (
    item.kind === 'pose' &&
    item.variants.length > 0 &&
    item.variants.every((variant) => {
      if (item.collection === 'custom') return !!variant.depth;
      const origin = new URL(variant.original).origin;
      return origin === poseOrigin || origin === poseDepthOrigin;
    })
  );
}

export function isDepthVariant(variant: Variant): boolean {
  if (variant.depthMap) return true;
  try {
    return new URL(variant.original).origin === poseDepthOrigin;
  } catch {
    return false;
  }
}

export function withPoseDepth(item: Reference): Reference {
  if (!hasPoseDepth(item)) return item;
  if (item.collection === 'custom')
    return {
      ...item,
      variants: item.variants.map((variant) => ({ ...variant, ...variant.depth!, depthMap: true })),
    };
  const depthUrl = (value: string) => {
    const url = new URL(value);
    return url.origin === poseOrigin ? `${poseDepthOrigin}${url.pathname}` : value;
  };
  return {
    ...item,
    source: `${poseDepthOrigin}/`,
    variants: item.variants.map((variant) => ({
      ...variant,
      thumbnail: depthUrl(variant.thumbnail),
      image: depthUrl(variant.image),
      original: depthUrl(variant.original),
    })),
  };
}
