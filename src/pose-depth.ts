import type { Reference, Variant } from './types';

const poseOrigin = 'https://ai-pose-gallery.pages.dev';
export const poseDepthOrigin = 'https://ai-pose-depth-gallery.pages.dev';

export function isDepthVariant(variant: Variant): boolean {
  return new URL(variant.original).origin === poseDepthOrigin;
}

export function withPoseDepth(item: Reference): Reference {
  if (item.kind !== 'pose') return item;
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
