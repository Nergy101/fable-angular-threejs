export interface SketchfabThumbnail {
  url: string;
  width: number;
  height: number;
}

export interface SketchfabUser {
  username: string;
  displayName: string;
  profileUrl: string;
  avatar?: { images: SketchfabThumbnail[] };
}

export interface SketchfabModel {
  uid: string;
  name: string;
  description?: string;
  viewerUrl: string;
  embedUrl: string;
  isDownloadable: boolean;
  likeCount: number;
  viewCount: number;
  faceCount: number;
  vertexCount: number;
  animationCount?: number;
  publishedAt?: string;
  user: SketchfabUser;
  thumbnails: { images: SketchfabThumbnail[] };
  license?: { label: string; slug?: string; requirements?: string; url?: string };
  categories?: { name: string; slug: string }[];
  tags?: { name: string; slug: string }[];
  archives?: Record<string, { size?: number; faceCount?: number; textureCount?: number } | null>;
}

export interface SketchfabSearchResponse {
  results: SketchfabModel[];
  next: string | null;
  previous: string | null;
}

export interface SketchfabArchive {
  url: string;
  size: number;
  expires: number;
}

/** Response of GET /v3/models/{uid}/download (requires API token). */
export interface SketchfabDownloadResponse {
  gltf?: SketchfabArchive;
  glb?: SketchfabArchive;
  usdz?: SketchfabArchive;
  source?: SketchfabArchive;
}

export interface SketchfabCategory {
  name: string;
  slug: string;
}

export const SKETCHFAB_CATEGORIES: SketchfabCategory[] = [
  { name: 'Animals & Pets', slug: 'animals-pets' },
  { name: 'Architecture', slug: 'architecture' },
  { name: 'Art & Abstract', slug: 'art-abstract' },
  { name: 'Cars & Vehicles', slug: 'cars-vehicles' },
  { name: 'Characters & Creatures', slug: 'characters-creatures' },
  { name: 'Cultural Heritage', slug: 'cultural-heritage-history' },
  { name: 'Electronics & Gadgets', slug: 'electronics-gadgets' },
  { name: 'Fashion & Style', slug: 'fashion-style' },
  { name: 'Food & Drink', slug: 'food-drink' },
  { name: 'Furniture & Home', slug: 'furniture-home' },
  { name: 'Music', slug: 'music' },
  { name: 'Nature & Plants', slug: 'nature-plants' },
  { name: 'People', slug: 'people' },
  { name: 'Places & Travel', slug: 'places-travel' },
  { name: 'Science & Technology', slug: 'science-technology' },
  { name: 'Sports & Fitness', slug: 'sports-fitness' },
  { name: 'Weapons & Military', slug: 'weapons-military' },
];

export type SketchfabSort = '-likeCount' | '-viewCount' | '-publishedAt' | 'relevance';
