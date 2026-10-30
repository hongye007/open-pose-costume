export type Lang = 'zh' | 'en';
export type Localized = Record<Lang, string>;
export type Kind = 'pose' | 'costume' | 'character';
export interface Variant {
  id: string;
  angle: string;
  label: Localized;
  thumbnail: string;
  image: string;
  original: string;
}
export interface Reference {
  id: string;
  kind: Kind;
  code: string;
  title: Localized;
  category: Localized & { id: string };
  series: Localized;
  extended: boolean;
  keywords: Localized;
  source: string;
  portrait?: { section: 'face' | 'styling'; hair: string };
  variants: Variant[];
}
export interface Catalog {
  items: Reference[];
  stats: {
    poseGroups: number;
    poseImages: number;
    costumes: number;
    characters: number;
    references: number;
    images: number;
  };
}
