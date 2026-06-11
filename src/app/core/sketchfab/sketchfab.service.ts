import { Injectable, signal } from '@angular/core';
import {
  SketchfabDownloadResponse,
  SketchfabModel,
  SketchfabSearchResponse,
  SketchfabSort,
} from './sketchfab.types';

const API = 'https://api.sketchfab.com/v3';
const TOKEN_KEY = 'vector-atelier.sketchfab-token';

export interface SearchQuery {
  q?: string;
  categories?: string;
  sort?: SketchfabSort;
  animated?: boolean;
  staffpicked?: boolean;
}

/**
 * Thin client for the public Sketchfab Data API.
 *
 * Search and model metadata are public (no auth, CORS-enabled).
 * Downloading the actual archives requires a personal API token —
 * free on any Sketchfab account under Settings → Password & API.
 */
@Injectable({ providedIn: 'root' })
export class SketchfabService {
  /** Personal API token, persisted locally. Only needed for downloads. */
  readonly token = signal<string>(localStorage.getItem(TOKEN_KEY) ?? '');

  private readonly modelCache = new Map<string, SketchfabModel>();

  setToken(token: string): void {
    this.token.set(token.trim());
    if (token.trim()) localStorage.setItem(TOKEN_KEY, token.trim());
    else localStorage.removeItem(TOKEN_KEY);
  }

  async search(query: SearchQuery): Promise<SketchfabSearchResponse> {
    const params = new URLSearchParams({
      type: 'models',
      downloadable: 'true',
      archives_flavours: 'false',
    });
    if (query.q) params.set('q', query.q);
    if (query.categories) params.set('categories', query.categories);
    if (query.sort && query.sort !== 'relevance') params.set('sort_by', query.sort);
    if (query.animated) params.set('animated', 'true');
    if (query.staffpicked) params.set('staffpicked', 'true');

    return this.fetchPage(`${API}/search?${params}`);
  }

  /** Follow a `next` cursor URL returned by a previous search. */
  async fetchPage(url: string): Promise<SketchfabSearchResponse> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Sketchfab search failed (${res.status})`);
    const data = (await res.json()) as SketchfabSearchResponse;
    for (const model of data.results) this.modelCache.set(model.uid, model);
    return data;
  }

  async getModel(uid: string): Promise<SketchfabModel> {
    const cached = this.modelCache.get(uid);
    if (cached) return cached;
    const res = await fetch(`${API}/models/${uid}`);
    if (!res.ok) throw new Error(`Could not load model ${uid} (${res.status})`);
    const model = (await res.json()) as SketchfabModel;
    this.modelCache.set(uid, model);
    return model;
  }

  /**
   * Request temporary download URLs for a model's archives.
   * Requires the personal API token.
   */
  async getDownloadUrls(uid: string): Promise<SketchfabDownloadResponse> {
    const token = this.token();
    if (!token) throw new Error('NO_TOKEN');
    const res = await fetch(`${API}/models/${uid}/download`, {
      headers: { Authorization: `Token ${token}` },
    });
    if (res.status === 401) throw new Error('BAD_TOKEN');
    if (!res.ok) throw new Error(`Download request failed (${res.status})`);
    return (await res.json()) as SketchfabDownloadResponse;
  }
}
